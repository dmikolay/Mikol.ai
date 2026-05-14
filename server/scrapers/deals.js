'use strict'
// VC deal RSS scraper
// Sources: TechCrunch /tag/funding, TechCrunch /category/venture, Crunchbase News
// Parses stage, amount, and lead investor from title + content via heuristics.
// Writes to both `items` (category='deal', picked up by Gemini summarizer)
// and `deals` table (structured fields for the deals API).
// Deduplication: INSERT OR IGNORE on items.url (UNIQUE) + idx_deals_dedup on deals.

const axios  = require('axios')
const xml2js = require('xml2js')
const { getDb } = require('../db/db')

const UA = 'Mikol.ai/1.0 (research aggregator; contact: mikolayd3@gmail.com)'

const SOURCES = [
  {
    name: 'tc-funding',
    url:  'https://techcrunch.com/tag/funding/feed/',
    // All items on this feed are deal-relevant
    filter: () => true,
  },
  {
    name: 'crunchbase-news',
    url:  'https://news.crunchbase.com/feed/',
    filter: () => true,
  },
  {
    name: 'tc-venture',
    url:  'https://techcrunch.com/category/venture/feed/',
    // This feed mixes deals with event/opinion posts — only keep items that look
    // like funding announcements based on title keywords.
    filter: (title) => /raises?|funding|invest|round|series [a-e]|seed|backed|valuation|ipo|acqui/i.test(title),
  },
]

// ── Amount extraction ─────────────────────────────────────────────────────────
// Matches: $250M, $1.2B, $500 million, $2 billion, $45k, etc.
const AMOUNT_RE = /\$\s*([\d,.]+)\s*(billion|million|[bm]k?)\b/gi

function parseAmountUsd(text) {
  if (!text) return null
  // Reset lastIndex since we reuse the regex with /g
  AMOUNT_RE.lastIndex = 0
  const matches = [...text.matchAll(AMOUNT_RE)]
  if (matches.length === 0) return null

  // Use the FIRST amount in the text — in a funding headline this is almost always
  // the raise amount, not a valuation or ARR figure that appears later in the body.
  const m   = matches[0]
  const num  = parseFloat(m[1].replace(/,/g, ''))
  const unit = m[2].toLowerCase()
  let usd = num
  if (unit === 'billion' || unit === 'b') usd = num * 1_000_000_000
  else if (unit === 'million' || unit === 'm') usd = num * 1_000_000
  else if (unit === 'k') usd = num * 1_000
  return usd > 0 ? Math.round(usd) : null
}

// ── Stage extraction ──────────────────────────────────────────────────────────
const STAGE_PATTERNS = [
  [/\bpre[\s-]seed\b/i,                    'pre-seed'],
  [/\bseries\s+[Ee]\b/i,                   'series-e'],
  [/\bseries\s+[Dd]\b/i,                   'series-d'],
  [/\bseries\s+[Cc]\b/i,                   'series-c'],
  [/\bseries\s+[Bb]\b/i,                   'series-b'],
  [/\bseries\s+[Aa]\b/i,                   'series-a'],
  [/\bgrowth[\s-]round\b|\bgrowth\s+equity\b/i, 'growth'],
  [/\bseed[\s-]round\b|\bseed\s+fund/i,    'seed'],
  [/\bseed\b/i,                            'seed'],
  [/\bipo\b/i,                             'ipo'],
  [/\bacquisition\b|\bacquired\b/i,        'acquisition'],
]

function parseStage(text) {
  if (!text) return null
  for (const [re, label] of STAGE_PATTERNS) {
    if (re.test(text)) return label
  }
  return null
}

// ── Investor extraction ───────────────────────────────────────────────────────
// Picks up "led by X" or "X led the round" patterns.
const LED_BY_RE = /(?:led\s+by|lead\s+investor[:\s]+|led\s+the\s+round[,\s]+(?:with\s+)?)\s*([A-Z][^\n,\.]{2,60}?)(?:\s*[,\.\n]|$)/im
const LED_ROUND_RE = /([A-Z][^\n,\.]{2,40}?)\s+(?:led|is\s+leading)\s+(?:the\s+)?(?:round|investment|funding)/im

function parseLeadInvestor(text) {
  if (!text) return null
  const m = text.match(LED_BY_RE) || text.match(LED_ROUND_RE)
  if (!m) return null
  return m[1].trim().slice(0, 200)
}

// ── RSS parsing (same logic as rss.js) ───────────────────────────────────────
const xmlParser = new xml2js.Parser({ explicitArray: false, trim: true })

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
    headers: { 'User-Agent': UA },
    responseType: 'text',
  })
  const parsed = await xmlParser.parseStringPromise(res.data)

  if (parsed.rss?.channel) {
    const ch  = parsed.rss.channel
    const raw = ch.item ? (Array.isArray(ch.item) ? ch.item : [ch.item]) : []
    return raw.map(it => ({
      title:     extractText(it.title),
      url:       extractUrl(it.link),
      content:   extractText(it['content:encoded'] || it.description),
      author:    extractText(it['dc:creator'] || it.author),
      published: it.pubDate || null,
    }))
  }

  if (parsed.feed) {
    const raw = parsed.feed.entry
      ? (Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry])
      : []
    return raw.map(e => {
      const links = Array.isArray(e.link) ? e.link : (e.link ? [e.link] : [])
      const alt   = links.find(l => !l.$?.rel || l.$?.rel === 'alternate') || links[0]
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

// ── Main ingest function ──────────────────────────────────────────────────────

async function ingestDeals() {
  const db = getDb()

  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO items
      (source, category, title, url, raw_content, published_at, metadata)
    VALUES
      (@source, @category, @title, @url, @raw_content, @published_at, @metadata)
  `)

  const insertDeal = db.prepare(`
    INSERT OR IGNORE INTO deals
      (company_name, stage, amount_usd, lead_investor, co_investors,
       announced_at, sector_tags, description, source, source_url)
    VALUES
      (@company_name, @stage, @amount_usd, @lead_investor, NULL,
       @announced_at, @sector_tags, @description, @source, @source_url)
  `)

  let totalNewItems = 0
  let totalNewDeals = 0

  for (const src of SOURCES) {
    let entries
    try {
      entries = await fetchFeed(src.url)
    } catch (err) {
      console.error(`[deals] ${src.name} FAILED:`, err.message)
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    let newItems = 0
    let newDeals = 0

    for (const e of entries) {
      if (!e.url || !e.title) continue
      if (!src.filter(e.title)) continue

      const plain = e.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

      // Parse structured fields from title + content combined
      const combined  = `${e.title} ${plain}`
      const amountUsd = parseAmountUsd(combined)
      const stage     = parseStage(combined)
      const leadInv   = parseLeadInvestor(plain)  // content only — titles rarely have this

      // Derive company name: for deal-tagged articles, the company is usually
      // the grammatical subject before "raises" / "secures" / "closes" in the title.
      const companyName = extractCompanyFromTitle(e.title)

      const publishedAt = e.published ? new Date(e.published).toISOString() : null

      const metadata = JSON.stringify({
        author:      e.author || null,
        amount_usd:  amountUsd,
        stage,
        lead_investor: leadInv,
      })

      const itemResult = insertItem.run({
        source:       src.name,
        category:     'deal',
        title:        e.title.slice(0, 500),
        url:          e.url.slice(0, 2000),
        raw_content:  plain.slice(0, 10000),
        published_at: publishedAt,
        metadata,
      })
      if (itemResult.changes > 0) newItems++

      // Only write a deals row when we have a company name — avoids polluting
      // the deals table with generic "VC funding round" entries.
      if (companyName) {
        const dealResult = insertDeal.run({
          company_name:  companyName.slice(0, 500),
          stage,
          amount_usd:    amountUsd,
          lead_investor: leadInv ? leadInv.slice(0, 500) : null,
          announced_at:  publishedAt ? publishedAt.slice(0, 10) : null,
          sector_tags:   '["AI","Tech"]',
          description:   plain.slice(0, 5000),
          source:        src.name,
          source_url:    e.url.slice(0, 2000),
        })
        if (dealResult.changes > 0) newDeals++
      }
    }

    console.log(`[deals] ${src.name}: +${newItems} items, +${newDeals} deals (${entries.length} fetched)`)
    totalNewItems += newItems
    totalNewDeals += newDeals

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`[deals] ingest complete — +${totalNewItems} items, +${totalNewDeals} deals total`)
  return totalNewItems
}

// ── Company name extraction from title ───────────────────────────────────────
// Patterns like: "Acme AI raises $50M Series B"
//                "Acme raises $10M in seed funding"
//                "Acme secures $200M led by a16z"
//                "Acme closes $30M round"
const COMPANY_FROM_TITLE_RE = /^(.+?)\s+(?:raises?|secures?|closes?|lands?|gets?|bags?|nets?|announces?|hauls?)\s+\$[\d]/i

function extractCompanyFromTitle(title) {
  if (!title) return null
  const m = title.match(COMPANY_FROM_TITLE_RE)
  if (!m) return null

  let name = m[1].trim()

  // Strip common Crunchbase-style prefixes before the actual company name:
  // "Exclusive: Physician-Founded Acme" → "Acme"
  // "Exclusive: " prefix
  name = name.replace(/^exclusive\s*:\s*/i, '')
  // "Adjective-Founded/Backed/Owned CompanyName" — keep only from the last capital word
  name = name.replace(/^[\w\s-]+-(?:founded|backed|led|owned|powered)\s+/i, '')

  return name.trim() || null
}

module.exports = { ingestDeals }
