'use strict'
const axios  = require('axios')
const xml2js = require('xml2js')
const { getDb } = require('../db/db')

// RSS 2.0 and Atom feeds — all freely available, no auth required.
// Paywalled sources are listed but disabled (see comments below).
const SOURCES = [
  { name: 'techcrunch',  category: 'news', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'venturebeat', category: 'news', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'arstechnica', category: 'news', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'mit-tr',      category: 'news', url: 'https://www.technologyreview.com/feed/' },
  { name: 'wired',       category: 'news', url: 'https://www.wired.com/feed/rss' },
  // Reuters shut down feeds.reuters.com — proxy via Google News RSS instead
  { name: 'reuters',     category: 'news', url: 'https://news.google.com/rss/search?q=source:reuters.com+technology&hl=en-US&gl=US&ceid=US:en' },
  { name: 'huggingface', category: 'news', url: 'https://huggingface.co/blog/feed.xml' },
  // PAYWALLED — requires subscription credentials to get non-truncated content:
  // { name: 'the-information', category: 'news', url: 'https://www.theinformation.com/feed' },
  // { name: 'bloomberg',       category: 'news', url: 'https://feeds.bloomberg.com/technology/news.rss' },
]

const parser = new xml2js.Parser({ explicitArray: false, trim: true })

// Handles RSS 2.0 (<link> text node), Atom (<link href="..."/>), and xml2js mixed shapes.
function extractUrl(link) {
  if (!link) return ''
  if (typeof link === 'string') return link.trim()
  if (link.$?.href) return link.$.href.trim()
  if (link._) return link._.trim()
  return ''
}

function extractText(field) {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (field._) return field._
  return String(field)
}

async function fetchFeed(url) {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: { 'User-Agent': 'Mikol.ai/1.0 (research aggregator; contact: mikolayd3@gmail.com)' },
    responseType: 'text',
  })

  const parsed = await parser.parseStringPromise(res.data)

  // RSS 2.0
  if (parsed.rss?.channel) {
    const ch = parsed.rss.channel
    const raw = ch.item ? (Array.isArray(ch.item) ? ch.item : [ch.item]) : []
    return raw.map(it => ({
      title:     extractText(it.title),
      url:       extractUrl(it.link),
      content:   extractText(it['content:encoded'] || it.description),
      author:    extractText(it['dc:creator'] || it.author),
      published: it.pubDate || null,
    }))
  }

  // Atom 1.0
  if (parsed.feed) {
    const raw = parsed.feed.entry
      ? (Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry])
      : []
    return raw.map(e => {
      const links = Array.isArray(e.link) ? e.link : (e.link ? [e.link] : [])
      const alt = links.find(l => !l.$?.rel || l.$?.rel === 'alternate') || links[0]
      return {
        title:     extractText(e.title),
        url:       alt ? extractUrl(alt) : '',
        content:   extractText(e.content || e.summary),
        author:    extractText(e.author?.name || e.author),
        published: e.published || e.updated || null,
      }
    })
  }

  return []
}

async function ingestAll() {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO items (source, category, title, url, raw_content, published_at, metadata)
    VALUES (@source, @category, @title, @url, @raw_content, @published_at, @metadata)
  `)

  let totalNew = 0

  for (const src of SOURCES) {
    try {
      const entries = await fetchFeed(src.url)
      let newCount = 0

      for (const e of entries) {
        if (!e.url || !e.title) continue
        const plain = e.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const r = insert.run({
          source:       src.name,
          category:     src.category,
          title:        e.title.slice(0, 500),
          url:          e.url.slice(0, 2000),
          raw_content:  plain.slice(0, 10000),
          published_at: e.published ? new Date(e.published).toISOString() : null,
          metadata:     JSON.stringify({ author: e.author || null }),
        })
        if (r.changes > 0) newCount++
      }

      console.log(`[rss] ${src.name}: +${newCount} new (${entries.length} fetched)`)
      totalNew += newCount
    } catch (err) {
      console.error(`[rss] ${src.name} FAILED:`, err.message)
    }

    // 300ms between sources — polite rate-limiting
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`[rss] ingest complete — ${totalNew} new items total`)
  return totalNew
}

module.exports = { fetchFeed, ingestAll }
