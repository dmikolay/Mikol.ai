const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.join(__dirname, '../../data/mikol.db')

let db

function getDb() {
  if (!db) throw new Error('Database not initialized — call initDb() first.')
  return db
}

function initDb() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  db.exec(schema)

  // Idempotent column migrations
  const existingCols = db.prepare('PRAGMA table_info(items)').all().map(r => r.name)
  if (!existingCols.includes('saved')) {
    db.prepare('ALTER TABLE items ADD COLUMN saved INTEGER DEFAULT 0').run()
  }

  // Idempotent index migrations
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_dedup ON deals (company_name, announced_at, source)')

  console.log(`[db] initialized → ${DB_PATH}`)
  return db
}

module.exports = { getDb, initDb }
