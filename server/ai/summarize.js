'use strict'
// Article summarization pipeline
// Model: gemini-2.5-flash-lite via Google Gemini API (fast, high-RPM free tier)
// Trigger: batch job every 15 minutes — processes all items with no ai_summary
// Batch size: 20 items per run (single Gemini call, returns JSON array)
// Requires: GEMINI_API_KEY in .env

const { GoogleGenerativeAI } = require('@google/generative-ai')
const { getDb } = require('../db/db')

const BATCH_SIZE = 20

let _genAI
function getModel() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return _genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
}

const PROMPT = `You are an intelligence analyst summarizing content for a professional tracking AI and venture capital.

For each article below, write exactly 1-2 sentences. Be specific: what happened, who was involved, why it matters. No filler phrases. Be direct.

Return ONLY a valid JSON array of strings — one summary per article, in the same order as the input. No markdown fences, no explanation, just the JSON array.

Articles:
{ARTICLES}`

async function summarizeBatch(items) {
  const articlesBlock = items
    .map((it, i) => `[${i + 1}] ${it.title}\n${(it.raw_content || '').slice(0, 1500)}`)
    .join('\n\n---\n\n')

  const prompt = PROMPT.replace('{ARTICLES}', articlesBlock)
  const result = await getModel().generateContent(prompt)
  const raw    = result.response.text().trim()

  // Strip markdown code fences if Gemini wraps the output anyway
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const summaries = JSON.parse(json)

  if (!Array.isArray(summaries) || summaries.length !== items.length) {
    throw new Error(`Expected ${items.length} summaries, got ${summaries?.length ?? 'non-array'}`)
  }
  return summaries
}

async function runSummaryJob() {
  const db = getDb()
  const pending = db.prepare(`
    SELECT id, title, raw_content FROM items
    WHERE ai_summary IS NULL
      AND raw_content IS NOT NULL
      AND raw_content != ''
    ORDER BY ingested_at DESC
    LIMIT ?
  `).all(BATCH_SIZE)

  if (pending.length === 0) {
    console.log('[summarize] nothing pending')
    return 0
  }

  console.log(`[summarize] processing ${pending.length} items`)

  try {
    const summaries = await summarizeBatch(pending)
    const update = db.prepare('UPDATE items SET ai_summary = ? WHERE id = ?')
    db.transaction(() => {
      pending.forEach((row, i) => update.run(summaries[i], row.id))
    })()
    console.log(`[summarize] updated ${pending.length} items`)
    return pending.length
  } catch (err) {
    console.error('[summarize] batch failed:', err.message)
    return 0
  }
}

module.exports = { summarizeBatch, runSummaryJob }
