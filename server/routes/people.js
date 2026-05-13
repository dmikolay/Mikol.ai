const express = require('express')
const router  = express.Router()

// GET  /api/people       → watchlist with recent signals
// POST /api/people       → add person to watchlist
// PUT  /api/people/:id   → update person
// DEL  /api/people/:id   → remove person
// TODO: implement in Phase 3

router.get('/', (_req, res) => {
  res.json({ people: [], message: 'not implemented yet' })
})

module.exports = router
