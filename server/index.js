const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const express = require('express')
const cors    = require('cors')
const { initDb } = require('./db/db')

const { startScheduler } = require('./jobs/scheduler')

const feedRouter      = require('./routes/feed')
const dashboardRouter = require('./routes/dashboard')
const dealsRouter     = require('./routes/deals')
const startupsRouter  = require('./routes/startups')
const peopleRouter    = require('./routes/people')
const researchRouter  = require('./routes/research')
const chatRouter      = require('./routes/chat')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/feed',      feedRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/deals',    dealsRouter)
app.use('/api/startups', startupsRouter)
app.use('/api/people',   peopleRouter)
app.use('/api/research', researchRouter)
app.use('/api/chat',     chatRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

function start() {
  initDb()
  startScheduler()
  app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`)
  })
}

start()
