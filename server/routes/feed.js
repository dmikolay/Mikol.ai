'use strict'
const express = require('express')
const router  = express.Router()
const { getDb } = require('../db/db')

// GET /api/feed
// Query params: category, source, limit (default 20), offset (default 0), unseen=true
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { category, source, unseen } = req.query
    const limit  = Math.min(Number(req.query.limit)  || 20, 100)
    const offset = Number(req.query.offset) || 0

    const conditions = []
    const params     = []

    if (category)        { conditions.push('category = ?'); params.push(category) }
    if (source)          { conditions.push('source = ?');   params.push(source) }
    if (unseen === 'true') conditions.push('is_new = 1')

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

    const items = db.prepare(`
      SELECT id, source, category, title, url, ai_summary,
             published_at, ingested_at, is_new, metadata
      FROM items
      ${where}
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM items ${where}`
    ).get(...params)

    res.json({ items, total, limit, offset })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/feed/:id
router.get('/:id', (req, res) => {
  try {
    const db   = getDb()
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(req.params.id))
    if (!item) return res.status(404).json({ error: 'not found' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/feed/:id/read — mark an item as read (is_new = 0)
router.post('/:id/read', (req, res) => {
  try {
    const db = getDb()
    db.prepare('UPDATE items SET is_new = 0 WHERE id = ?').run(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/feed/:id/save — toggle saved flag
router.post('/:id/save', (req, res) => {
  try {
    const db   = getDb()
    const item = db.prepare('SELECT saved FROM items WHERE id = ?').get(Number(req.params.id))
    if (!item) return res.status(404).json({ error: 'not found' })
    const next = item.saved ? 0 : 1
    db.prepare('UPDATE items SET saved = ? WHERE id = ?').run(next, Number(req.params.id))
    res.json({ saved: next === 1 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
