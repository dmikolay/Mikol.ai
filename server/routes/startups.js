const express = require('express')
const router  = express.Router()

// GET  /api/startups     → all tracked startups
// POST /api/startups     → add startup (triggers auto-scrape)
// PUT  /api/startups/:id → update startup (kanban status, notes)
// DEL  /api/startups/:id → remove startup
// TODO: implement in Phase 3

router.get('/', (_req, res) => {
  res.json({ startups: [], message: 'not implemented yet' })
})

module.exports = router
