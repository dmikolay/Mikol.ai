#!/usr/bin/env node
'use strict'
// Smoke-test for Phase 2 deal pipeline.
// Runs EDGAR + RSS deal scrapers, triggers Gemini summarization on the results,
// then prints a pass/fail report. Safe to run repeatedly — all ingestion is idempotent.
//
// Usage:  node server/scripts/test-deals.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const { initDb, getDb } = require('../db/db')

// ── Formatting helpers ────────────────────────────────────────────────────────

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM    = '\x1b[2m'
const CYAN   = '\x1b[36m'

const pass  = (msg) => console.log(`  ${GREEN}✓${RESET} ${msg}`)
const fail  = (msg) => console.log(`  ${RED}✗${RESET} ${msg}`)
const warn  = (msg) => console.log(`  ${YELLOW}⚠${RESET}  ${msg}`)
const info  = (msg) => console.log(`    ${DIM}${msg}${RESET}`)
const hr    = ()    => console.log(DIM + '─'.repeat(60) + RESET)
const head  = (msg) => console.log(`\n${BOLD}${CYAN}${msg}${RESET}`)

function fmt(n) {
  if (n == null) return 'null'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}Mikol.ai — Phase 2 Deal Pipeline Test${RESET}`)
  hr()

  initDb()
  const db = getDb()

  let failures = 0

  // ── 1. EDGAR scraper ───────────────────────────────────────────────────────
  head('1 / 3  SEC EDGAR Form D scraper')

  const beforeEdgarItems = db.prepare("SELECT count(*) AS c FROM items WHERE source='edgar'").get().c
  const beforeEdgarDeals = db.prepare("SELECT count(*) AS c FROM deals WHERE source='edgar'").get().c

  const { ingestEdgar } = require('../scrapers/sec')
  let edgarNew = 0
  try {
    edgarNew = await ingestEdgar()
  } catch (e) {
    fail(`ingestEdgar() threw: ${e.message}`)
    failures++
  }

  const afterEdgarItems = db.prepare("SELECT count(*) AS c FROM items WHERE source='edgar'").get().c
  const afterEdgarDeals = db.prepare("SELECT count(*) AS c FROM deals WHERE source='edgar'").get().c

  if (afterEdgarItems > 0) {
    pass(`items table has ${afterEdgarItems} edgar rows (+${afterEdgarItems - beforeEdgarItems} this run)`)
  } else {
    fail('No edgar rows in items table — EDGAR API may be down or returned 0 results')
    failures++
  }

  if (afterEdgarDeals > 0) {
    pass(`deals table has ${afterEdgarDeals} edgar rows (+${afterEdgarDeals - beforeEdgarDeals} this run)`)
  } else {
    fail('No edgar rows in deals table')
    failures++
  }

  // Dedup check: a second run should insert 0 new rows
  const dedupNew = await ingestEdgar()
  if (dedupNew === 0) {
    pass('Dedup: re-run inserted 0 new items (idempotent ✓)')
  } else {
    fail(`Dedup: re-run inserted ${dedupNew} items — INSERT OR IGNORE may not be working`)
    failures++
  }

  // Show sample filings
  const edgarSamples = db.prepare(
    "SELECT title, published_at, metadata FROM items WHERE source='edgar' ORDER BY ingested_at DESC LIMIT 3"
  ).all()
  info('Sample filings:')
  edgarSamples.forEach(r => {
    const m = JSON.parse(r.metadata || '{}')
    const exemption = (m.exemption_codes || []).map(e => e.label).join(', ') || 'unknown'
    info(`  ${r.published_at}  ${r.title.slice(0, 60)}`)
    info(`           exemption: ${exemption} | state: ${(m.inc_states || []).join(', ') || 'N/A'}`)
  })

  // ── 2. RSS deal scrapers ───────────────────────────────────────────────────
  head('2 / 3  RSS deal scrapers (tc-funding, crunchbase-news, tc-venture)')

  const beforeRssItems = db.prepare("SELECT count(*) AS c FROM items WHERE category='deal' AND source != 'edgar'").get().c
  const beforeRssDeals = db.prepare("SELECT count(*) AS c FROM deals WHERE source != 'edgar'").get().c

  const { ingestDeals } = require('../scrapers/deals')
  let rssNew = 0
  try {
    rssNew = await ingestDeals()
  } catch (e) {
    fail(`ingestDeals() threw: ${e.message}`)
    failures++
  }

  const afterRssItems = db.prepare("SELECT count(*) AS c FROM items WHERE category='deal' AND source != 'edgar'").get().c
  const afterRssDeals = db.prepare("SELECT count(*) AS c FROM deals WHERE source != 'edgar'").get().c

  if (afterRssItems > 0) {
    pass(`items table has ${afterRssItems} RSS deal rows (+${afterRssItems - beforeRssItems} this run)`)
  } else {
    fail('No RSS deal rows in items table')
    failures++
  }

  if (afterRssDeals > 0) {
    pass(`deals table has ${afterRssDeals} RSS deal rows (+${afterRssDeals - beforeRssDeals} this run)`)
  } else {
    warn('No RSS deal rows in deals table — this is expected if titles had no extractable company name')
  }

  // Check extraction quality on deals that have structured fields
  const dealsWithAmount = db.prepare(
    "SELECT count(*) AS c FROM deals WHERE amount_usd IS NOT NULL AND source != 'edgar'"
  ).get().c
  const dealsWithStage = db.prepare(
    "SELECT count(*) AS c FROM deals WHERE stage IS NOT NULL AND source != 'edgar'"
  ).get().c
  const dealsWithInvestor = db.prepare(
    "SELECT count(*) AS c FROM deals WHERE lead_investor IS NOT NULL AND source != 'edgar'"
  ).get().c

  if (dealsWithAmount > 0) {
    pass(`${dealsWithAmount} deals have parsed amount_usd`)
  } else {
    warn('0 deals have amount_usd — regex extraction may have missed all amounts')
  }
  if (dealsWithStage > 0) {
    pass(`${dealsWithStage} deals have parsed stage`)
  } else {
    warn('0 deals have stage — regex extraction may have missed all stage labels')
  }
  if (dealsWithInvestor > 0) {
    pass(`${dealsWithInvestor} deals have parsed lead_investor`)
  } else {
    warn('0 deals have lead_investor — "led by" pattern may not have matched')
  }

  // Dedup check
  const dedupRss = await ingestDeals()
  if (dedupRss === 0) {
    pass('Dedup: re-run inserted 0 new items (idempotent ✓)')
  } else {
    fail(`Dedup: re-run inserted ${dedupRss} items`)
    failures++
  }

  // Show sample deal rows
  const rssSamples = db.prepare(`
    SELECT company_name, stage, amount_usd, lead_investor, source, announced_at
    FROM deals WHERE source != 'edgar'
    ORDER BY ingested_at DESC LIMIT 5
  `).all()
  info('Sample deal rows:')
  rssSamples.forEach(r => {
    info(`  [${r.source}] ${r.company_name.slice(0, 40).padEnd(40)} ${(r.stage || 'stage?').padEnd(12)} ${fmt(r.amount_usd).padEnd(8)} ${r.lead_investor?.slice(0,30) ?? ''}`)
  })

  // ── 3. Gemini summarization ────────────────────────────────────────────────
  head('3 / 3  Gemini summarization on deal items')

  const unsummarized = db.prepare(`
    SELECT count(*) AS c FROM items
    WHERE category IN ('deal', 'filing')
      AND ai_summary IS NULL
      AND raw_content IS NOT NULL AND raw_content != ''
  `).get().c

  info(`${unsummarized} deal/filing items pending summarization — running Gemini now...`)

  const { runSummaryJob } = require('../ai/summarize')
  let summarized = 0
  try {
    summarized = await runSummaryJob()
  } catch (e) {
    fail(`runSummaryJob() threw: ${e.message}`)
    failures++
  }

  const stillPending = db.prepare(`
    SELECT count(*) AS c FROM items
    WHERE category IN ('deal', 'filing')
      AND ai_summary IS NULL
      AND raw_content IS NOT NULL AND raw_content != ''
  `).get().c

  if (summarized > 0 || stillPending === 0) {
    const totalSummarized = db.prepare(`
      SELECT count(*) AS c FROM items
      WHERE category IN ('deal','filing') AND ai_summary IS NOT NULL AND ai_summary != ''
    `).get().c
    pass(`${summarized} items summarized this run — ${totalSummarized} total with ai_summary`)
    if (stillPending > 0) {
      warn(`${stillPending} items still pending (batch size is 20 — run again to process more)`)
    }
  } else {
    fail(`0 items summarized — check GEMINI_API_KEY in .env`)
    failures++
  }

  // Show sample summaries
  const summarySamples = db.prepare(`
    SELECT source, title, ai_summary FROM items
    WHERE category IN ('deal','filing') AND ai_summary IS NOT NULL AND ai_summary != ''
    ORDER BY ingested_at DESC LIMIT 3
  `).all()
  if (summarySamples.length > 0) {
    info('Sample summaries:')
    summarySamples.forEach(r => {
      info(`  [${r.source}] ${r.title.slice(0, 55)}`)
      info(`  → ${r.ai_summary.slice(0, 120)}`)
      info('')
    })
  }

  // ── Final report ───────────────────────────────────────────────────────────
  hr()
  const totalDeals   = db.prepare('SELECT count(*) AS c FROM deals').get().c
  const totalSumDeal = db.prepare("SELECT count(*) AS c FROM items WHERE category IN ('deal','filing') AND ai_summary IS NOT NULL").get().c
  const totalDealItems = db.prepare("SELECT count(*) AS c FROM items WHERE category IN ('deal','filing')").get().c

  console.log(`\n${BOLD}Summary${RESET}`)
  console.log(`  deals table:     ${totalDeals} rows (edgar + RSS)`)
  console.log(`  items (deal/filing): ${totalDealItems} rows, ${totalSumDeal} with ai_summary`)

  if (failures === 0) {
    console.log(`\n${GREEN}${BOLD}All checks passed.${RESET}\n`)
  } else {
    console.log(`\n${RED}${BOLD}${failures} check(s) failed — see output above.${RESET}\n`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error(`\n${RED}Unhandled error:${RESET}`, e.message)
  process.exit(1)
})
