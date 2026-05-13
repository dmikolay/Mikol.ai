#!/usr/bin/env node
'use strict'
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { initDb, getDb } = require('../db/db')

function pass(msg) { console.log('  ✓', msg) }
function fail(msg) { console.log('  ✗', msg); process.exitCode = 1 }
function section(msg) { console.log('\n' + msg) }

async function main() {
  console.log('=== Mikol.ai pipeline test ===')

  // ── 1. Database ────────────────────────────────────────────────────────────
  section('1. Database')
  try {
    initDb()
    pass('initDb() succeeded')
  } catch (e) {
    fail('initDb() threw: ' + e.message)
    process.exit(1)
  }

  const db = getDb()
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all().map(r => r.name)

  const required = ['items', 'companies', 'people', 'deals', 'theses', 'thesis_items', 'chat_sessions', 'chat_messages']
  for (const t of required) {
    tables.includes(t) ? pass(`table '${t}' exists`) : fail(`table '${t}' MISSING`)
  }

  // ── 2. RSS ingestion ───────────────────────────────────────────────────────
  section('2. RSS ingestion (live fetch — takes ~10s)')
  const { ingestAll } = require('../scrapers/rss')
  let newItems = 0
  try {
    newItems = await ingestAll()
    pass(`ingestAll() returned without throwing`)
  } catch (e) {
    fail('ingestAll() threw: ' + e.message)
  }

  const totalItems = db.prepare('SELECT COUNT(*) AS c FROM items').get().c
  totalItems > 0
    ? pass(`${totalItems} total items in DB (${newItems} new this run)`)
    : fail('0 items in DB — ingestion stored nothing')

  // Per-source breakdown
  const sources = db.prepare(
    'SELECT source, COUNT(*) AS c FROM items GROUP BY source ORDER BY c DESC'
  ).all()
  for (const row of sources) {
    pass(`  source '${row.source}': ${row.c} items`)
  }

  // ── 3. Item shape ──────────────────────────────────────────────────────────
  section('3. Item data quality')
  const sample = db.prepare(
    'SELECT * FROM items ORDER BY ingested_at DESC LIMIT 1'
  ).get()

  if (!sample) {
    fail('No items to inspect')
  } else {
    sample.title       ? pass(`title present: "${sample.title.slice(0, 60)}"`) : fail('title missing')
    sample.url         ? pass(`url present: ${sample.url.slice(0, 60)}`)       : fail('url missing')
    sample.source      ? pass(`source: ${sample.source}`)                      : fail('source missing')
    sample.ingested_at ? pass(`ingested_at: ${sample.ingested_at}`)            : fail('ingested_at missing')
    sample.published_at
      ? pass(`published_at: ${sample.published_at}`)
      : fail('published_at null — feed may not include dates')
    sample.raw_content?.length > 0
      ? pass(`raw_content: ${sample.raw_content.length} chars`)
      : fail('raw_content empty')
  }

  // ── 4. Deduplication ──────────────────────────────────────────────────────
  section('4. Deduplication')
  const beforeCount = db.prepare('SELECT COUNT(*) AS c FROM items').get().c
  try {
    await ingestAll()
    const afterCount = db.prepare('SELECT COUNT(*) AS c FROM items').get().c
    afterCount === beforeCount
      ? pass(`Re-ingest added 0 duplicates (${beforeCount} → ${afterCount})`)
      : fail(`Re-ingest added ${afterCount - beforeCount} duplicate(s)`)
  } catch (e) {
    fail('Re-ingest threw: ' + e.message)
  }

  // ── 5. Gemini summarization ────────────────────────────────────────────────
  section('5. Gemini summarization')

  if (!process.env.GEMINI_API_KEY) {
    console.log('  - GEMINI_API_KEY not set — skipping summarization tests')
  } else {
    const { runSummaryJob } = require('../ai/summarize')
    const pendingBefore = db.prepare(
      "SELECT COUNT(*) AS c FROM items WHERE ai_summary IS NULL AND raw_content != ''"
    ).get().c

    let summarized = 0
    try {
      summarized = await runSummaryJob()
      pass(`runSummaryJob() returned without throwing`)
    } catch (e) {
      fail('runSummaryJob() threw: ' + e.message)
    }

    const pendingAfter = db.prepare(
      "SELECT COUNT(*) AS c FROM items WHERE ai_summary IS NULL AND raw_content != ''"
    ).get().c
    const withSummary  = db.prepare('SELECT COUNT(*) AS c FROM items WHERE ai_summary IS NOT NULL').get().c

    summarized > 0
      ? pass(`Summarized ${summarized} items this run (${pendingBefore} → ${pendingAfter} pending)`)
      : pendingBefore === 0
        ? pass('All items already summarized — nothing pending')
        : fail(`0 items summarized despite ${pendingBefore} pending`)

    withSummary > 0
      ? pass(`${withSummary} total items have summaries`)
      : fail('No summaries in DB')

    // Print 3 samples
    const samples = db.prepare(
      'SELECT source, title, ai_summary FROM items WHERE ai_summary IS NOT NULL ORDER BY ingested_at DESC LIMIT 3'
    ).all()
    if (samples.length > 0) {
      console.log('\n  Sample summaries:')
      for (const r of samples) {
        console.log(`\n  [${r.source}] ${r.title.slice(0, 65)}`)
        console.log(`  → ${r.ai_summary}`)
      }
    }
  }

  // ── 6. Feed API route ──────────────────────────────────────────────────────
  section('6. Feed route query (simulated)')
  try {
    const items = db.prepare(
      "SELECT id, source, title, ai_summary, published_at, is_new FROM items ORDER BY published_at DESC LIMIT 5"
    ).all()
    items.length > 0
      ? pass(`/api/feed query returns ${items.length} rows (showing top 5)`)
      : fail('/api/feed query returned 0 rows')

    const newCount = db.prepare('SELECT COUNT(*) AS c FROM items WHERE is_new = 1').get().c
    pass(`${newCount} items flagged is_new=1`)
  } catch (e) {
    fail('Feed query threw: ' + e.message)
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n==============================')
  if (process.exitCode === 1) {
    console.log('RESULT: some checks FAILED (see ✗ above)')
  } else {
    console.log('RESULT: all checks passed')
  }
  process.exit(process.exitCode || 0)
}

main().catch(err => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})
