'use strict'
const express = require('express')
const router  = express.Router()
const { getDb } = require('../db/db')

// GET /api/deals/stats    — aggregate counts (must be before /:id to avoid route collision)
// GET /api/deals/investor — per-firm view: matched deals + news mentions
// GET /api/deals/edgar    — Form D filings from items table
// GET /api/deals/funds    — news items mentioning new fund announcements
// GET /api/deals          — paginated deal list (deals table + deal-category items merged)

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const db = getDb()

    const { total }        = db.prepare('SELECT count(*) AS total FROM deals').get()
    const { with_amount }  = db.prepare('SELECT count(*) AS with_amount FROM deals WHERE amount_usd IS NOT NULL').get()
    const { total_raised } = db.prepare('SELECT sum(amount_usd) AS total_raised FROM deals WHERE amount_usd IS NOT NULL').get()
    const { filing_count } = db.prepare("SELECT count(*) AS filing_count FROM items WHERE category = 'filing'").get()

    // Most active investor (by deal count)
    const topInvestor = db.prepare(`
      SELECT lead_investor, count(*) AS cnt
      FROM deals
      WHERE lead_investor IS NOT NULL
      GROUP BY lead_investor
      ORDER BY cnt DESC
      LIMIT 1
    `).get()

    // By stage breakdown
    const byStage = db.prepare(`
      SELECT stage, count(*) AS cnt, sum(amount_usd) AS total
      FROM deals
      WHERE stage IS NOT NULL
      GROUP BY stage
      ORDER BY cnt DESC
    `).all()

    // Latest filing date
    const latest = db.prepare(`
      SELECT max(announced_at) AS latest FROM deals WHERE source = 'edgar'
    `).get()

    res.json({
      total_deals:    total,
      with_amount,
      total_raised:   total_raised || 0,
      filing_count,
      top_investor:   topInvestor || null,
      by_stage:       byStage,
      latest_filing:  latest?.latest || null,
    })
  } catch (err) {
    console.error('[deals/stats]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Investor per-firm view ────────────────────────────────────────────────────
// GET /api/deals/investor?aliases=a16z,Andreessen+Horowitz&days=365
// aliases — comma-separated list of name variants to match against
// Returns: { deals: [...], news: [...] }
//   deals — rows from the deals table where lead_investor OR description matches any alias
//   news  — rows from items (any category) where title OR raw_content matches any alias
router.get('/investor', (req, res) => {
  try {
    const db = getDb()
    const days    = parseInt(req.query.days) || 365
    const rawAliases = req.query.aliases || ''
    const aliases = rawAliases.split(',').map(s => s.trim()).filter(Boolean)

    if (aliases.length === 0) {
      return res.json({ deals: [], news: [] })
    }

    // Build LIKE clauses — one per alias, ORed together.
    // SQLite doesn't support parameterised LIKE lists elegantly, so we build
    // the clause dynamically.  Aliases come from a fixed server-side list
    // (VC_FIRMS in the frontend), never from unsanitised user text.
    const likeClauses = aliases.map(() => '?').join(', ')  // placeholder count
    const likeParams  = aliases.map(a => `%${a}%`)

    // Deals: match lead_investor or co_investors or description
    const dealClauses = aliases.map(() =>
      '(lead_investor LIKE ? OR co_investors LIKE ? OR description LIKE ?)'
    ).join(' OR ')
    const dealParams = aliases.flatMap(a => [`%${a}%`, `%${a}%`, `%${a}%`])

    const dealRows = db.prepare(`
      SELECT
        id, company_name, stage, amount_usd, lead_investor, co_investors,
        announced_at, sector_tags, description, ai_summary, source_url AS url, source, ingested_at,
        announced_at AS published_at, 'deal_row' AS row_type
      FROM deals
      WHERE (${dealClauses})
        AND announced_at >= date('now', '-${days} days')
      ORDER BY announced_at DESC
      LIMIT 40
    `).all(...dealParams)

    // News: broad LIKE fetch, then post-filter with word-boundary regex so
    // "Benchmark" doesn't match "benchmarking" or "benchmark suite".
    const newsClauses = aliases.map(() =>
      '(title LIKE ? OR raw_content LIKE ?)'
    ).join(' OR ')
    const newsParams = aliases.flatMap(a => [`%${a}%`, `%${a}%`])

    // Build match functions per alias.
    // For single-word aliases (e.g. "Benchmark", "Sequoia"), require that the word
    // is NOT preceded by an article (a/an/the) which indicates it's a common noun,
    // not a proper noun / firm name. Multi-word aliases ("Drive Capital") use simple
    // word-boundary matching — the phrase itself is specific enough.
    const aliasMatchers = aliases.map(a => {
      const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const isSingleWord = !a.includes(' ')
      if (isSingleWord) {
        // Reject matches like "a Benchmark", "the Benchmark", "an Benchmark"
        const re = new RegExp(`(?<!\\b(?:a|an|the)\\s)\\b${escaped}\\b`, 'i')
        return (text) => re.test(text)
      }
      const re = new RegExp(`\\b${escaped}\\b`, 'i')
      return (text) => re.test(text)
    })

    const newsRowsRaw = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
      FROM items
      WHERE (${newsClauses})
        AND published_at >= date('now', '-${days} days')
      ORDER BY published_at DESC
      LIMIT 100
    `).all(...newsParams)

    // Post-filter: at least one alias must match as a proper-noun usage in title or summary
    const newsRows = newsRowsRaw.filter(r =>
      aliasMatchers.some(fn => fn(r.title) || fn(r.ai_summary || ''))
    ).slice(0, 40)

    // Parse JSON fields on deals
    const deals = dealRows.map(r => ({
      ...r,
      sector_tags:  r.sector_tags  ? tryParseJson(r.sector_tags)  : null,
      co_investors: r.co_investors ? tryParseJson(r.co_investors) : null,
    }))

    res.json({ deals, news: newsRows })
  } catch (err) {
    console.error('[deals/investor]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── EDGAR Form D feed ──────────────────────────────────────────────────────────
router.get('/edgar', (req, res) => {
  try {
    const db   = getDb()
    const days = parseInt(req.query.days) || 30
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)

    const rows = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, metadata
      FROM items
      WHERE category = 'filing'
        AND (published_at >= date('now', '-' || ? || ' days') OR ? >= 365)
      ORDER BY published_at DESC
      LIMIT ?
    `).all(days, days, limit)

    // Parse metadata JSON inline
    const filings = rows.map(r => {
      let meta = {}
      try { meta = JSON.parse(r.metadata || '{}') } catch {}
      return { ...r, metadata: meta }
    })

    res.json({ filings, total: filings.length })
  } catch (err) {
    console.error('[deals/edgar]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Fund announcements ──────────────────────────────────────────────────────────
router.get('/funds', (req, res) => {
  try {
    const db    = getDb()
    const days  = parseInt(req.query.days) || 90
    const limit = Math.min(parseInt(req.query.limit) || 40, 200)

    // Pull news items that mention fund announcements
    const rows = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new
      FROM items
      WHERE category = 'news'
        AND (
          title LIKE '%new fund%' OR title LIKE '%fund announce%'
          OR title LIKE '%raises fund%' OR title LIKE '% fund close%'
          OR title LIKE '%billion fund%' OR title LIKE '%million fund%'
          OR title LIKE '%venture fund%' OR title LIKE '%growth fund%'
          OR title LIKE '%fund II%' OR title LIKE '%fund III%'
          OR title LIKE '%LP commit%' OR title LIKE '%limited partner%'
        )
        AND published_at >= date('now', '-' || ? || ' days')
      ORDER BY published_at DESC
      LIMIT ?
    `).all(days, limit)

    res.json({ items: rows, total: rows.length })
  } catch (err) {
    console.error('[deals/funds]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Deal list (main) ───────────────────────────────────────────────────────────
// Merges the `deals` table (structured) with `items WHERE category='deal'` (RSS articles).
// Returns a unified shape so the frontend only deals with one object type.
router.get('/', (req, res) => {
  try {
    const db = getDb()

    // Query params
    const stage      = req.query.stage  || null  // e.g. 'seed', 'series-a'
    const source     = req.query.source || null  // e.g. 'edgar', 'tc-funding'
    const minAmount  = parseInt(req.query.min_amount) || null
    const maxAmount  = parseInt(req.query.max_amount) || null
    const days       = parseInt(req.query.days)  || 90
    const limit      = Math.min(parseInt(req.query.limit)  || 60, 200)
    const offset     = parseInt(req.query.offset) || 0

    // ── Part 1: structured deals table ───────────────────────────────────────
    let dealWhere = [`announced_at >= date('now', '-' || ${days} || ' days')`]
    const dealParams = []

    if (stage) { dealWhere.push('stage = ?'); dealParams.push(stage) }
    if (source) { dealWhere.push('source = ?'); dealParams.push(source) }
    if (minAmount != null) { dealWhere.push('amount_usd >= ?'); dealParams.push(minAmount) }
    if (maxAmount != null) { dealWhere.push('amount_usd <= ?'); dealParams.push(maxAmount) }

    const dealRows = db.prepare(`
      SELECT
        id,
        company_name,
        stage,
        amount_usd,
        lead_investor,
        co_investors,
        announced_at AS published_at,
        sector_tags,
        description AS raw_content,
        ai_summary,
        source_url  AS url,
        source,
        ingested_at,
        'deal_row' AS row_type
      FROM deals
      WHERE ${dealWhere.join(' AND ')}
      ORDER BY announced_at DESC
    `).all(...dealParams)

    // ── Part 2: items table (deal-category RSS articles not already in deals) ─
    // Include all deal-category items; de-overlap with deals table by source_url.
    const dealUrls = new Set(dealRows.map(r => r.url).filter(Boolean))

    let itemWhere = [`category = 'deal'`, `published_at >= date('now', '-' || ${days} || ' days')`]
    const itemParams = []

    if (source && source !== 'edgar') { itemWhere.push('source = ?'); itemParams.push(source) }

    const itemRows = db.prepare(`
      SELECT
        id,
        NULL        AS company_name,
        NULL        AS stage,
        NULL        AS amount_usd,
        NULL        AS lead_investor,
        NULL        AS co_investors,
        published_at,
        NULL        AS sector_tags,
        raw_content,
        ai_summary,
        url,
        source,
        ingested_at,
        'item_row'  AS row_type
      FROM items
      WHERE ${itemWhere.join(' AND ')}
      ORDER BY published_at DESC
    `).all(...itemParams)

    // Merge: structured deal rows first, then item rows not already covered by a deal row
    // Use url as the overlap key.
    const merged = [
      ...dealRows,
      ...itemRows.filter(r => !dealUrls.has(r.url)),
    ]

    // Apply amount filters to merged set (item rows don't have amount_usd, they pass through)
    const filtered = merged.filter(r => {
      if (minAmount != null && r.amount_usd != null && r.amount_usd < minAmount) return false
      if (maxAmount != null && r.amount_usd != null && r.amount_usd > maxAmount) return false
      return true
    })

    // Sort merged set by date descending
    filtered.sort((a, b) => {
      const da = new Date(a.published_at || 0).getTime()
      const db2 = new Date(b.published_at || 0).getTime()
      return db2 - da
    })

    const total   = filtered.length
    const results = filtered.slice(offset, offset + limit).map(r => ({
      ...r,
      sector_tags:  r.sector_tags  ? tryParseJson(r.sector_tags)  : null,
      co_investors: r.co_investors ? tryParseJson(r.co_investors) : null,
    }))

    res.json({ deals: results, total, offset, limit })
  } catch (err) {
    console.error('[deals]', err.message)
    res.status(500).json({ error: err.message })
  }
})

function tryParseJson(val) {
  try { return JSON.parse(val) } catch { return val }
}

module.exports = router
