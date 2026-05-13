-- Core content table (news, research, filings, signals)
CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT    NOT NULL,              -- 'techcrunch', 'arxiv', 'edgar', 'xai', etc.
  category     TEXT    NOT NULL,              -- 'news', 'deal', 'research', 'filing', 'signal'
  title        TEXT    NOT NULL,
  url          TEXT    UNIQUE NOT NULL,
  raw_content  TEXT,
  ai_summary   TEXT,                          -- 1-2 sentence Claude summary
  embedding    BLOB,                          -- vector for semantic search (sqlite-vec)
  published_at DATETIME,
  ingested_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_new       INTEGER  DEFAULT 1,            -- 1 = new (last 24h), 0 = read
  saved        INTEGER  DEFAULT 0,            -- 1 = saved to thesis board staging
  metadata     JSON                           -- flexible: author, company, amount, stage, etc.
);

CREATE INDEX IF NOT EXISTS idx_items_category    ON items (category);
CREATE INDEX IF NOT EXISTS idx_items_source      ON items (source);
CREATE INDEX IF NOT EXISTS idx_items_published   ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_is_new      ON items (is_new);

-- AI labs, tracked startups, VC firms
CREATE TABLE IF NOT EXISTS companies (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  type               TEXT    NOT NULL,        -- 'ai_lab', 'startup', 'vc_firm'
  website            TEXT,
  crunchbase_url     TEXT,
  twitter_handle     TEXT,
  description        TEXT,
  stage              TEXT,                    -- pre-seed, seed, series-a, series-b, ...
  last_round_amount  TEXT,
  last_round_date    TEXT,
  headcount_estimate INTEGER,
  danny_note         TEXT,
  kanban_status      TEXT DEFAULT 'watching', -- watching, researching, interested, applied, archived
  tags               JSON,
  added_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_type   ON companies (type);
CREATE INDEX IF NOT EXISTS idx_companies_kanban ON companies (kanban_status);

-- People watchlist
CREATE TABLE IF NOT EXISTS people (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  current_role     TEXT,
  current_company  TEXT,
  twitter_handle   TEXT,
  github_username  TEXT,
  why_watching     TEXT,
  signal_status    TEXT DEFAULT 'green',      -- green, yellow, red
  last_activity_at DATETIME,
  added_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- VC deals
CREATE TABLE IF NOT EXISTS deals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name  TEXT NOT NULL,
  stage         TEXT,
  amount_usd    INTEGER,
  lead_investor TEXT,
  co_investors  JSON,
  announced_at  DATE,
  sector_tags   JSON,
  description   TEXT,
  ai_summary    TEXT,
  source_url    TEXT,
  source        TEXT,                         -- 'techcrunch', 'edgar', 'crunchbase_scrape'
  ingested_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deals_announced ON deals (announced_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_stage     ON deals (stage);

-- Thesis system
CREATE TABLE IF NOT EXISTS theses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thesis_items (
  thesis_id  INTEGER REFERENCES theses(id) ON DELETE CASCADE,
  item_id    INTEGER REFERENCES items(id)  ON DELETE CASCADE,
  danny_note TEXT,
  tagged_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thesis_id, item_id)
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          TEXT    NOT NULL,             -- 'user' or 'assistant'
  content       TEXT    NOT NULL,
  context_items JSON,                         -- item IDs used as RAG context
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id);
