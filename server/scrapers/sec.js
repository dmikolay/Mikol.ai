'use strict'
// SEC EDGAR Form D scraper — free REST API, no auth required
// Searches full-text for AI/ML keywords on Form D filings from the last 30 days.
// Writes to both `items` (for Gemini summarization) and `deals` tables.
//
// EDGAR fair-use: 10 req/sec max. We make 3 search calls per run with 150ms gaps.
// Offering amounts are NOT fetched (would require per-filing XML download).
// Gemini summarizes from entity name + state + exemption codes instead.

const axios  = require('axios')
const { getDb } = require('../db/db')

const BASE_URL = 'https://efts.sec.gov/LATEST/search-index'
const USER_AGENT = 'Mikol.ai/1.0 (research aggregator; contact: mikolayd3@gmail.com)'

// Exemption code → human-readable label
const EXEMPTION_LABELS = {
  '04':  'Rule 504',
  '06B': 'Rule 506(b)',
  '06C': 'Rule 506(c)',
  '06D': 'Rule 506(d)',
}

// Queries to run — deduplicated by accession number across all three
const QUERIES = [
  '"artificial intelligence"',
  '"machine learning"',
  '"AI startup"',
]

function isoDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// Parse entity name from display_names entry like "Acme AI Fund (CIK 0002096208)"
function parseEntityName(displayNames) {
  if (!Array.isArray(displayNames) || displayNames.length === 0) return 'Unknown Entity'
  const raw = displayNames[0]
  // Strip " (CIK XXXXXXXXXX)" suffix
  return raw.replace(/\s*\(CIK\s+\d+\)\s*$/i, '').trim()
}

// Build the canonical EDGAR filing URL for a given CIK + accession number
function buildFilingUrl(cik, adsh) {
  const cikNum = String(parseInt(cik, 10))          // strip leading zeros
  const adshClean = adsh.replace(/-/g, '')           // "0002096208-25-000001" → "000209620825000001"
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${adshClean}/${adshClean}-index.json`
}

// Derive exemption codes from the items array (e.g. ["06B", "3C", "3C.7"])
function extractExemptions(itemCodes) {
  if (!Array.isArray(itemCodes)) return []
  return itemCodes.filter(c => EXEMPTION_LABELS[c]).map(c => ({
    code:  c,
    label: EXEMPTION_LABELS[c],
  }))
}

async function searchEdgar(query, startdt, enddt) {
  const params = new URLSearchParams({
    q:         query,
    forms:     'D',
    dateRange: 'custom',
    startdt,
    enddt,
    from:      '0',
    hits_hits_total_value: 'true',
  })

  const res = await axios.get(`${BASE_URL}?${params}`, {
    timeout: 15000,
    headers: { 'User-Agent': USER_AGENT },
  })

  const hits = res.data?.hits?.hits
  if (!Array.isArray(hits)) return []
  return hits
}

async function ingestEdgar() {
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
      (@company_name, NULL, NULL, NULL, NULL,
       @announced_at, @sector_tags, @description, @source, @source_url)
  `)

  const startdt = isoDate(30)
  const enddt   = isoDate(0)

  // Collect all hits across queries, deduplicate by accession number
  const seen = new Set()
  const allHits = []

  for (const query of QUERIES) {
    let hits
    try {
      hits = await searchEdgar(query, startdt, enddt)
      console.log(`[edgar] query ${query}: ${hits.length} hits`)
    } catch (err) {
      console.error(`[edgar] query ${query} failed:`, err.message)
      hits = []
    }

    for (const hit of hits) {
      const adsh = hit._source?.adsh
      if (!adsh || seen.has(adsh)) continue
      seen.add(adsh)
      allHits.push(hit._source)
    }

    // Polite rate-limiting between queries
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`[edgar] ${allHits.length} unique filings to process`)

  let newItems = 0
  let newDeals = 0

  for (const s of allHits) {
    const cik        = Array.isArray(s.ciks) ? s.ciks[0] : null
    const entityName = parseEntityName(s.display_names)
    const incStates  = Array.isArray(s.inc_states)    ? s.inc_states    : []
    const bizLocs    = Array.isArray(s.biz_locations)  ? s.biz_locations : []
    const itemCodes  = Array.isArray(s.items)          ? s.items         : []
    const exemptions = extractExemptions(itemCodes)
    const fileDate   = s.file_date || null

    const stateLabel = incStates[0] || bizLocs[0] || 'Unknown'
    const exemLabel  = exemptions.length > 0
      ? exemptions.map(e => e.label).join(', ')
      : 'Reg D'

    const filingUrl = cik ? buildFilingUrl(cik, s.adsh) : null
    if (!filingUrl) continue  // can't build a dedup URL without CIK

    const title = `Form D: ${entityName} (${stateLabel})`

    // Human-readable block that Gemini can summarize
    const rawContent = [
      `Company: ${entityName}`,
      `State of Incorporation: ${incStates.join(', ') || 'N/A'}`,
      `Business Location: ${bizLocs.join(', ') || 'N/A'}`,
      `Filing Date: ${fileDate || 'N/A'}`,
      `Exemption: ${exemLabel}`,
      `Accession: ${s.adsh}`,
      `SEC Filing: ${filingUrl}`,
    ].join('\n')

    const metadata = JSON.stringify({
      cik,
      adsh:           s.adsh,
      inc_states:     incStates,
      biz_locations:  bizLocs,
      exemption_codes: exemptions,
      item_codes:     itemCodes,
    })

    const itemResult = insertItem.run({
      source:       'edgar',
      category:     'filing',
      title:        title.slice(0, 500),
      url:          filingUrl,
      raw_content:  rawContent,
      published_at: fileDate,
      metadata,
    })
    if (itemResult.changes > 0) newItems++

    const dealResult = insertDeal.run({
      company_name: entityName.slice(0, 500),
      announced_at: fileDate,
      sector_tags:  '["AI"]',
      description:  rawContent,
      source:       'edgar',
      source_url:   filingUrl,
    })
    if (dealResult.changes > 0) newDeals++
  }

  console.log(`[edgar] done — +${newItems} items, +${newDeals} deals (${allHits.length} filings processed)`)
  return newItems
}

module.exports = { ingestEdgar }
