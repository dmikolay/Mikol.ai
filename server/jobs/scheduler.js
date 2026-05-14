'use strict'
const cron   = require('node-cron')

function startScheduler() {
  // Lazy-require scrapers/AI here to avoid load-order issues at startup.
  const { ingestAll }     = require('../scrapers/rss')
  const { ingestDeals }   = require('../scrapers/deals')
  const { runSummaryJob } = require('../ai/summarize')

  // RSS ingest every 3 hours (at :00 on hour 0, 3, 6, 9, 12, 15, 18, 21)
  cron.schedule('0 */3 * * *', async () => {
    console.log('[cron] RSS ingest start')
    try { await ingestAll() }
    catch (e) { console.error('[cron] RSS error:', e.message) }
  })

  // Deal flow RSS ingest every 3 hours (offset by 30m from news ingest)
  cron.schedule('30 */3 * * *', async () => {
    console.log('[cron] deal RSS ingest start')
    try { await ingestDeals() }
    catch (e) { console.error('[cron] deals error:', e.message) }
  })

  // Summarization batch every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[cron] summarize job start')
    try { await runSummaryJob() }
    catch (e) { console.error('[cron] summarize error:', e.message) }
  })

  // Age out is_new flag: items older than 24h become is_new=0, checked every hour
  cron.schedule('0 * * * *', () => {
    try {
      const { getDb } = require('../db/db')
      getDb().prepare(`
        UPDATE items SET is_new = 0
        WHERE is_new = 1 AND published_at < datetime('now', '-24 hours')
      `).run()
    } catch (e) { console.error('[cron] age-out error:', e.message) }
  })

  // SEC EDGAR Form D scraper every 6h
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] EDGAR Form D ingest start')
    const { ingestEdgar } = require('../scrapers/sec')
    try { await ingestEdgar() }
    catch (e) { console.error('[cron] EDGAR error:', e.message) }
  })

  // Phase 3+: xAI + GitHub person watchlist monitoring daily at 7am
  // cron.schedule('0 7 * * *', async () => { /* people monitoring */ })

  console.log('[scheduler] started (RSS every 3h | deals every 3h+30m | summarize every 15m | age-out every 1h | EDGAR every 6h)')
}

module.exports = { startScheduler }
