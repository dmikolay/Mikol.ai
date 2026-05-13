const express = require('express')
const router  = express.Router()

// GET /api/deals         → paginated deal list with filters
// GET /api/deals/edgar   → raw Form D filings feed
// TODO: implement in Phase 2

router.get('/', (_req, res) => {
  res.json({ deals: [], total: 0, message: 'not implemented yet' })
})

module.exports = router
