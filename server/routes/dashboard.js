'use strict'
const express = require('express')
const router  = express.Router()
const { getDb } = require('../db/db')

// GET /api/dashboard — all six sections in one shot
// Sections:
//   top_stories    — 6 most recent news items last 24h (or last 48h fallback)
//   deal_flow      — 4 most recent deal/funding items
//   people_radar   — 4 signal-category items
//   research_drops — 4 most recent research items
//   market_mood    — synthetic: newest ai_summary snippet from top story as seed
//   sec_filings    — 4 filing-category items (last 7d, or all time if scarce)

router.get('/', (req, res) => {
  try {
    const db = getDb()

    // ── Top Stories ── recent news, last 48h preferred; fallback to last 7d
    let topStories = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
      FROM items
      WHERE category = 'news'
        AND published_at >= datetime('now', '-48 hours')
      ORDER BY published_at DESC
      LIMIT 6
    `).all()

    if (topStories.length < 2) {
      topStories = db.prepare(`
        SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
        FROM items
        WHERE category = 'news'
        ORDER BY published_at DESC
        LIMIT 6
      `).all()
    }

    // ── Deal Flow ── items tagged as deals, or news mentioning funding keywords
    let dealFlow = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
      FROM items
      WHERE category = 'deal'
      ORDER BY published_at DESC
      LIMIT 5
    `).all()

    // If no deal-category items yet, pull news articles about funding
    if (dealFlow.length === 0) {
      dealFlow = db.prepare(`
        SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
        FROM items
        WHERE category = 'news'
          AND (
            title LIKE '%fund%' OR title LIKE '%raise%' OR title LIKE '%raised%'
            OR title LIKE '%million%' OR title LIKE '%billion%' OR title LIKE '%Series%'
            OR title LIKE '%Seed%' OR title LIKE '%invest%' OR title LIKE '%venture%'
            OR title LIKE '%valuation%' OR title LIKE '%IPO%' OR title LIKE '%acqui%'
          )
        ORDER BY published_at DESC
        LIMIT 5
      `).all()
    }

    // ── People Radar ── signal-category items, or news about people/hires
    let peopleRadar = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
      FROM items
      WHERE category = 'signal'
      ORDER BY published_at DESC
      LIMIT 4
    `).all()

    if (peopleRadar.length === 0) {
      peopleRadar = db.prepare(`
        SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
        FROM items
        WHERE category = 'news'
          AND (
            title LIKE '%CEO%' OR title LIKE '%founder%' OR title LIKE '%hire%'
            OR title LIKE '%join%' OR title LIKE '%appoint%' OR title LIKE '%depart%'
            OR title LIKE '%resign%' OR title LIKE '%leave%' OR title LIKE '%executive%'
            OR title LIKE '%researcher%' OR title LIKE '%scientist%'
          )
        ORDER BY published_at DESC
        LIMIT 4
      `).all()
    }

    // ── Research Drops ── research-category items, or news about papers/models
    let researchDrops = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
      FROM items
      WHERE category = 'research'
      ORDER BY published_at DESC
      LIMIT 4
    `).all()

    if (researchDrops.length === 0) {
      researchDrops = db.prepare(`
        SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
        FROM items
        WHERE category = 'news'
          AND (
            title LIKE '%paper%' OR title LIKE '%model%' OR title LIKE '%research%'
            OR title LIKE '%benchmark%' OR title LIKE '%GPT%' OR title LIKE '%Claude%'
            OR title LIKE '%Gemini%' OR title LIKE '%Llama%' OR title LIKE '%open source%'
            OR title LIKE '%agent%' OR title LIKE '%multimodal%' OR title LIKE '%reasoning%'
          )
        ORDER BY published_at DESC
        LIMIT 4
      `).all()
    }

    // ── SEC Filings ── filing-category items, last 7 days
    let secFilings = db.prepare(`
      SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
      FROM items
      WHERE category = 'filing'
        AND ingested_at >= datetime('now', '-7 days')
      ORDER BY published_at DESC
      LIMIT 4
    `).all()

    if (secFilings.length === 0) {
      secFilings = db.prepare(`
        SELECT id, source, category, title, url, ai_summary, published_at, ingested_at, is_new, saved
        FROM items
        WHERE category = 'filing'
        ORDER BY published_at DESC
        LIMIT 4
      `).all()
    }

    // ── Market Mood ── derive from most recent items with summaries
    // Pull the 8 most recent summarized items and return them for the client to display.
    // A real "mood" paragraph will come when we wire a daily Gemini synthesis job.
    const moodItems = db.prepare(`
      SELECT id, source, title, ai_summary, published_at
      FROM items
      WHERE ai_summary IS NOT NULL AND ai_summary != ''
      ORDER BY published_at DESC
      LIMIT 8
    `).all()

    // Rough counts for context bar
    const { total_items }   = db.prepare('SELECT COUNT(*) AS total_items FROM items').get()
    const { new_items }     = db.prepare('SELECT COUNT(*) AS new_items FROM items WHERE is_new = 1').get()
    const { with_summary }  = db.prepare("SELECT COUNT(*) AS with_summary FROM items WHERE ai_summary IS NOT NULL AND ai_summary != ''").get()
    const last_ingested     = db.prepare('SELECT MAX(ingested_at) AS ts FROM items').get().ts

    res.json({
      top_stories:    topStories,
      deal_flow:      dealFlow,
      people_radar:   peopleRadar,
      research_drops: researchDrops,
      sec_filings:    secFilings,
      market_mood:    moodItems,
      meta: {
        total_items,
        new_items,
        with_summary,
        last_ingested,
      },
    })
  } catch (err) {
    console.error('[dashboard] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
