const express = require('express')
const router  = express.Router()

// GET /api/research         → arXiv + Papers With Code feed
// GET /api/research/saved   → Danny's saved papers
// POST /api/research/:id/save → save paper with optional note
// TODO: implement in Phase 4

router.get('/', (_req, res) => {
  res.json({ papers: [], message: 'not implemented yet' })
})

module.exports = router
