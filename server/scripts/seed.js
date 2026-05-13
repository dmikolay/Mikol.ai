#!/usr/bin/env node
// One-time seed script: fetch all RSS feeds and summarize everything.
// Run once after first setup: npm run seed -w server
// Requires GEMINI_API_KEY in .env for summarization step.
'use strict'
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { initDb }       = require('../db/db')
const { ingestAll }    = require('../scrapers/rss')
const { runSummaryJob } = require('../ai/summarize')

async function seed() {
  console.log('[seed] initializing database...')
  initDb()

  console.log('[seed] fetching all RSS feeds...')
  const newItems = await ingestAll()
  console.log(`[seed] ${newItems} new items ingested`)

  if (newItems === 0) {
    console.log('[seed] nothing new — database already up to date')
    process.exit(0)
  }

  if (!process.env.GEMINI_API_KEY) {
    console.log('[seed] GEMINI_API_KEY not set — skipping summarization')
    console.log('[seed] set GEMINI_API_KEY in .env and run again to generate summaries')
    process.exit(0)
  }

  console.log('[seed] summarizing (batches of 20)...')
  let total = 0
  let rounds = 0

  // 5s delay before each batch after the first — caps backfill at 12 req/min,
  // safely under Gemini free tier's 15 req/min limit.
  while (true) {
    if (rounds > 0) await new Promise(r => setTimeout(r, 5000))
    const count = await runSummaryJob()
    total += count
    rounds++
    if (count === 0) break
  }

  console.log(`[seed] done — ${total} items summarized in ${rounds - 1} batch(es)`)
  process.exit(0)
}

seed().catch(err => {
  console.error('[seed] fatal error:', err)
  process.exit(1)
})
