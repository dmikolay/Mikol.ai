# Mikol.ai — AI & Venture Intelligence Platform

### Planning Document for Claude Code

**Version:** 1.0 (Free-tier MVP)  
**Owner:** Danny Mikolay  
**Goal:** A personal, daily-use intelligence platform tracking the state of AI development, venture capital, and startup ecosystems — to inform a strategic career move into a high-upside startup.

---

## 1\. Product Vision

Mikol.ai is a personal intelligence dashboard that aggregates, summarizes, and lets Danny query everything happening in AI and venture capital — in one place, updated daily, with an integrated AI chat layer to ask questions against collected data.

This is not a news reader. It is a decision-support system for someone who needs to deeply understand the market before making a high-stakes career move.

**Daily workflow:**

1. Open Mikol.ai in the morning → scan the dashboard for overnight developments  
2. Drill into tabs for specific domains (AI labs, VC deals, startups, people signals)  
3. Ask the AI chat questions against collected data  
4. Save/tag items to personal thesis boards  
5. Return throughout the day to dig into threads that matter

---

## 2\. Core Design Principles

- **Speed first:** Every section should be scannable in under 60 seconds before committing to depth  
- **Signal over noise:** AI summaries on every article/item — 1-2 sentences max, so Danny never has to read something to know if it's worth reading  
- **Everything linked:** Every item links to its primary source  
- **Recency as default:** Default sort is always newest first  
- **No friction:** No sign-up flows, no onboarding, no bloat — this is a tool, not a product  
- **AI-native:** Chat interface is a first-class feature, not an afterthought  
- **Dark, professional aesthetic:** Think Bloomberg Terminal meets modern SaaS — dense, data-rich, serious

---

## 3\. Tech Stack

### Frontend

- **Framework:** React (Vite)  
- **Styling:** Tailwind CSS  
- **State management:** Zustand  
- **Routing:** React Router (tab-based navigation)  
- **Charts/viz:** Recharts or Tremor  
- **Fonts:** Something sharp and editorial — e.g. IBM Plex Mono for data, Syne or Instrument Serif for headers

### Backend

- **Runtime:** Node.js with Express  
- **Database:** SQLite (via better-sqlite3) for local MVP — simple, zero-config, fast  
- **Job scheduler:** node-cron for scheduled data refresh (every 6 hours)  
- **Scraping:** Puppeteer \+ Cheerio for structured scraping, Axios for RSS/API calls

### AI Layer

- **Primary LLM:** Anthropic Claude API (claude-sonnet-4-20250514)  
  - Article summarization (batch processed on ingest)  
  - Chat interface (RAG over collected data)  
- **Twitter/X data:** xAI Grok API (free tier) — real-time X data for people signals and AI lab announcements  
- **Embeddings:** Use Claude's API for embeddings or a lightweight local model (all-MiniLM via transformers.js) for semantic search over stored items

### Data Sources (All Free)

See Section 5 for full breakdown.

### Deployment (Local MVP)

- Runs locally on Danny's machine  
- Single command startup: `npm run dev` (starts both frontend and backend)  
- SQLite DB stored locally — no cloud costs  
- Future: Deploy to Railway or Fly.io when ready to go persistent/cloud

---

## 4\. Application Architecture

Mikol.ai/

├── client/                  \# React frontend

│   ├── src/

│   │   ├── pages/           \# One file per tab

│   │   │   ├── Dashboard.jsx

│   │   │   ├── AILabs.jsx

│   │   │   ├── VentureDeals.jsx

│   │   │   ├── Startups.jsx

│   │   │   ├── PeopleSignals.jsx

│   │   │   ├── Research.jsx

│   │   │   └── Thesis.jsx

│   │   ├── components/      \# Shared UI components

│   │   │   ├── ArticleCard.jsx

│   │   │   ├── DealCard.jsx

│   │   │   ├── ChatPanel.jsx

│   │   │   ├── TagBadge.jsx

│   │   │   ├── FilterBar.jsx

│   │   │   └── Sidebar.jsx

│   │   ├── store/           \# Zustand state

│   │   └── App.jsx

│

├── server/                  \# Node.js backend

│   ├── routes/

│   │   ├── feed.js          \# Article/news endpoints

│   │   ├── deals.js         \# VC deal endpoints

│   │   ├── startups.js      \# Startup tracker endpoints

│   │   ├── people.js        \# People signals endpoints

│   │   ├── research.js      \# SEC \+ research paper endpoints

│   │   └── chat.js          \# AI chat endpoint

│   ├── scrapers/

│   │   ├── rss.js           \# RSS feed ingestion

│   │   ├── techcrunch.js    \# TechCrunch scraper

│   │   ├── sec.js           \# EDGAR API integration

│   │   ├── arxiv.js         \# arXiv paper ingestion

│   │   └── xai.js           \# xAI/Grok API for X data

│   ├── jobs/

│   │   └── scheduler.js     \# Cron jobs for refresh

│   ├── ai/

│   │   ├── summarize.js     \# Article summarization pipeline

│   │   ├── embed.js         \# Embedding pipeline for RAG

│   │   └── chat.js          \# RAG-based chat handler

│   ├── db/

│   │   ├── schema.sql       \# SQLite schema

│   │   └── db.js            \# DB connection \+ helpers

│   └── index.js             \# Express app entry

│

├── .env                     \# API keys (never committed)

└── package.json

---

## 5\. Data Sources & Ingestion Strategy

### 5.1 News & AI Lab Intelligence

| Source | Method | Refresh Rate |
| :---- | :---- | :---- |
| TechCrunch AI section | RSS feed | Every 3 hours |
| The Information (free articles) | Scraper | Every 6 hours |
| VentureBeat AI | RSS feed | Every 3 hours |
| Ars Technica AI | RSS feed | Every 3 hours |
| MIT Technology Review | RSS feed | Every 6 hours |
| Wired (AI section) | RSS feed | Every 6 hours |
| Bloomberg Technology (free) | Scraper | Every 6 hours |
| Reuters Technology | RSS feed | Every 3 hours |
| Google DeepMind Blog | RSS/scraper | Daily |
| Anthropic News | Scraper | Daily |
| OpenAI Blog | Scraper | Daily |
| Meta AI Blog | Scraper | Daily |
| xAI / Grok announcements | xAI API \+ scraper | Every 3 hours |
| Hugging Face blog | RSS | Daily |
| Mistral AI blog | Scraper | Daily |

**Ingest pipeline:**

1. Scraper fetches raw articles on schedule  
2. Deduplicate by URL hash  
3. Store raw content \+ metadata in DB  
4. Pass to Claude summarization job → store 1-2 sentence summary  
5. Generate embedding for semantic search  
6. Mark as "new" for 24 hours, then "read"

### 5.2 Venture Capital & Deal Flow

| Source | Method | What it covers |
| :---- | :---- | :---- |
| Crunchbase (free web) | Scraper | Funding rounds, investors, amounts |
| TechCrunch Crunchbase section | RSS | New funding announcements |
| PitchBook news (free articles) | Scraper | Deal commentary |
| StrictlyVC newsletter | Scraper/RSS | Curated VC deals daily |
| Term Sheet (Fortune) | RSS | Deal flow, VC moves |
| The Hustle | RSS | Startup/funding news |
| axios.com/pro/deals (free tier) | Scraper | Deal announcements |
| SEC EDGAR | EDGAR REST API | Form D filings \= early fundraise signals |
| AngelList job board | Scraper | Infer early-stage activity |

**Form D (SEC) is a gold mine:** Any company raising under Reg D must file a Form D with the SEC within 15 days. This is public, searchable, and gives you: company name, state, industry, amount raised, date of first sale. This is early-stage deal flow that Crunchbase often doesn't catch for weeks or months.

**EDGAR API endpoints to use:**

GET https://efts.sec.gov/LATEST/search-index?q=%22artificial+intelligence%22\&dateRange=custom\&startdt=2025-01-01\&forms=D

Filter by: form type \= D, keywords \= AI/ML/artificial intelligence, date \= last 30 days.

### 5.3 Startup Tracker (Manual \+ Auto)

This tab is a hybrid — Danny manually adds startups he's watching, and the app auto-pulls public data around them.

**Manual add fields:**

- Company name  
- Stage (pre-seed / seed / Series A / Series B)  
- Sector tags  
- Why interesting (Danny's note)  
- Source of discovery  
- Date added  
- Watchlist status (Tracking / Archived / Applied)

**Auto-pull on add:**

- Crunchbase URL scrape → funding history, investors, headcount  
- LinkedIn company page scrape → employee count, recent hires, open roles  
- Twitter/X → recent company tweets via xAI API  
- AngelList → jobs posted (signals growth)

### 5.4 People Signals (Stealth Watch)

A manually curated watchlist of individuals Danny is tracking — founders, executives, researchers, investors. Once added, the app monitors their public activity.

**Manual add fields:**

- Full name  
- Current company / role  
- Why watching  
- Twitter/X handle  
- GitHub username (optional)  
- LinkedIn URL (for reference — scraping LinkedIn is against ToS so this is manual check only)

**Auto-monitoring per person:**

- xAI Grok API → pull their recent X posts, filter for signals (new company, stealth, fundraising language)  
- GitHub API (free, no auth needed for public) → new repos created, commit activity spikes, new org memberships  
- arXiv → new papers authored  
- Google News scraper → news mentions in last 30 days

**Signal keywords to watch for (auto-flag):**

- "excited to announce", "new chapter", "building something new", "stealth", "leaving X to", "we're hiring", "just raised", "seed round", "day one"

### 5.5 Research & Academic Intelligence

| Source | Method | What it covers |
| :---- | :---- | :---- |
| arXiv cs.AI, cs.LG, cs.CL | arXiv API (free) | Latest AI/ML research papers |
| Google Scholar alerts | Scraper (alert emails) | Citation spikes on key papers |
| Semantic Scholar API | Free API | Paper metadata, citations |
| Papers With Code | RSS/scraper | Benchmarks, SOTA results |
| Nature/Science (abstracts) | RSS | Significant science breakthroughs |

**arXiv API is fully free and well-documented:**

GET http://export.arxiv.org/api/query?search\_query=cat:cs.AI\&start=0\&max\_results=50\&sortBy=submittedDate\&sortOrder=descending

### 5.6 Twitter/X Intelligence (via xAI Grok API)

The xAI API gives access to real-time X data. Use it for:

- Monitoring specific accounts (AI lab CEOs, VCs, researchers)  
- Keyword searches (e.g. "just raised", "new fund", "stealth AI")  
- Trending topics in AI/VC circles

**Key accounts to monitor from day one:**

*AI Lab Leaders:*

- Sam Altman (@sama)  
- Dario Amodei (@DarioAmodei)  
- Demis Hassabis (@demishassabis)  
- Yann LeCun (@ylecun)  
- Andrej Karpathy (@karpathy)  
- Ilya Sutskever (@ilyasut)

*VCs:*

- Marc Andreessen (@pmarca)  
- Elad Gil (@eladgil)  
- Sarah Guo (@saranormous)  
- Garry Tan (@garrytan)  
- Josh Wolfe (@wolfejosh)

*Operators/Builders:*

- Greg Brockman (@gdb)  
- Nat Friedman (@natfriedman)  
- Dylan Field (@dylnfield)

---

## 6\. Tab Structure & Feature Specs

### Tab 1: Dashboard (Home)

**Purpose:** Morning snapshot. Everything important from the last 24 hours in one view.

**Sections:**

- **Top Stories** — 5 highest-signal articles from last 24h (AI-ranked by significance), each with 1-2 sentence AI summary  
- **Deal Flow Pulse** — 3-5 most interesting funding rounds announced in last 48h  
- **People Radar** — Any flagged activity from the stealth watchlist  
- **Research Drops** — Notable new arXiv papers or research announcements  
- **Market Mood** — Brief AI-generated paragraph synthesizing the overall narrative across all sources for the day (runs once per morning)  
- **SEC Filings Alert** — New Form D filings matching AI/ML keywords in last 7 days

**UI:** Card-based grid, dense but clean. Each card has: headline, source, timestamp, AI summary, and a "Save" button. Clicking expands inline or opens source in new tab.

---

### Tab 2: AI Labs

**Purpose:** Track every major AI company's product moves, leadership signals, and strategic direction.

**Companies tracked (default list, Danny can add more):**

- Anthropic (Claude)  
- OpenAI (ChatGPT, GPT-x)  
- Google DeepMind (Gemini, NotebookLM)  
- xAI (Grok)  
- Meta AI (Llama)  
- Mistral AI  
- Cohere  
- Stability AI  
- Perplexity AI  
- Character.AI  
- Inflection AI

**Per-company view includes:**

- **Recent News** — last 10 articles mentioning this company, with AI summaries  
- **Feature Releases** — manually tagged or auto-detected product launches  
- **Leadership Signals** — recent X posts from company executives, news mentions of leadership  
- **Acquisitions** — any M\&A activity, tagged and summarized  
- **Headcount signals** — job postings spikes (inferred from LinkedIn/AngelList scrape)  
- **Researcher movements** — people leaving or joining (from people signals tab, cross-referenced)

**UI:** Left sidebar \= company list. Right panel \= selected company's intelligence feed. Filter by: News / Product / Leadership / People.

---

### Tab 3: Venture & Deal Flow

**Purpose:** Track where money is moving, which firms are active, and what thesis categories are attracting capital.

**Sub-sections:**

**3a. Recent Rounds**

- Filterable table: Company | Stage | Amount | Lead Investor | Co-investors | Date | Sector | Description  
- AI summary per deal: "What does this company do and why might this round be significant?"  
- Source link  
- Filter by: Stage / Amount / Sector / Date / Investor

**3b. Investor Activity**

- Track specific VC firms (Drive Capital, a16z, Sequoia, Benchmark, Founders Fund, etc.)  
- Per-firm view: recent investments, announced funds, partner moves, public thesis statements  
- Cross-reference: which firms keep showing up in the same deals (syndicate patterns)

**3c. Form D Feed (SEC)**

- Raw feed of new Form D filings matching AI/tech keywords  
- Fields: Company name | State | Amount | Date filed | Industry description  
- Many of these won't be in Crunchbase yet — this is early signal  
- AI summary attempt on company name \+ description

**3d. Fund Announcements**

- New VC funds being raised or announced  
- LP commitments, fund size, stated thesis

**UI:** Tab within tab (3a/3b/3c/3d). Table-first with expandable rows. Color-coded by stage (pre-seed \= one color, seed \= another, etc.).

---

### Tab 4: Startup Tracker

**Purpose:** Danny's personal CRM for startups he's watching as potential career moves.

**Views:**

- **Kanban:** Cards organized by: Watching → Researching → Interested → Applied → Archived  
- **Table:** Full sortable table of all tracked startups  
- **Map view (stretch goal):** Plot by HQ location

**Per-startup card includes:**

- Name, logo (scraped), one-line description  
- Stage, last round amount, lead investors  
- Headcount (scraped)  
- Open roles (scraped from their jobs page or AngelList)  
- Danny's personal note  
- Tags (sector, thesis alignment)  
- Last updated timestamp  
- Links: website, Crunchbase, LinkedIn, Twitter

**Add startup flow:**

1. Danny pastes company name or URL  
2. App auto-scrapes available public data  
3. Danny reviews pre-filled fields, adds personal note  
4. Assigns to Kanban column

---

### Tab 5: People Signals

**Purpose:** Track individuals whose movements are signals — researchers going stealth, executives leaving, VCs starting new funds.

**Two sub-sections:**

**5a. Watchlist**

- Danny's manually curated list of people  
- Per-person: photo (from Twitter), name, current role, why watching, recent activity feed  
- Auto-pulled activity: X posts, GitHub activity, news mentions, new papers  
- Flag system: Green (normal) / Yellow (activity spike) / Red (major signal detected)

**5b. Departure Radar**

- Auto-aggregated news of executives/researchers leaving major AI companies  
- Sources: news articles, X posts, LinkedIn (manually checked)  
- AI summary: "Who left, where they came from, any signals about what they're doing next"

---

### Tab 6: Research

**Purpose:** Stay current on academic AI research without needing to read full papers.

**Sections:**

**6a. arXiv Feed**

- Latest papers from cs.AI, cs.LG (machine learning), cs.CL (NLP)  
- Per paper: title, authors, abstract, AI summary ("what this paper claims to do and why it might matter"), link to full PDF  
- Filter by: subfield / keyword / author / institution

**6b. Papers With Code**

- New benchmarks and state-of-the-art results  
- When a model breaks a benchmark, flag it

**6c. Institutional Research**

- Research from labs: Google Brain, FAIR (Meta), Microsoft Research, Stanford HAI, MIT CSAIL  
- Blog posts, technical reports, whitepapers

**6d. Saved Papers**

- Danny's personal library of papers he's saved  
- Can add notes per paper

---

### Tab 7: Thesis Board

**Purpose:** Danny doesn't have a thesis yet — this tab is where he builds one over time by tagging items and seeing what clusters.

**How it works:**

1. On any item anywhere in the app, Danny can click "Tag to Thesis"  
2. He can create named thesis buckets (e.g. "Agentic AI", "AI Infrastructure", "Enterprise AI", "Interesting Companies")  
3. Items accumulate in each bucket  
4. The AI can analyze a thesis bucket and generate: "Based on what you've saved here, here's the pattern and argument you seem to be building..."  
5. Danny can write a thesis statement per bucket that gets refined over time

**This becomes a living document of Danny's actual beliefs about where the market is going.**

---

### Chat Panel (Global — accessible from any tab)

**Purpose:** Ask questions against all collected data.

**How it works (technical):**

1. All ingested items are chunked and embedded (stored in SQLite with vector columns via sqlite-vec extension)  
2. When Danny asks a question, the query is embedded  
3. Top-k most relevant chunks retrieved (RAG)  
4. Claude gets: system prompt \+ retrieved context \+ Danny's question  
5. Claude answers with citations to specific items in the DB

**Example queries it should handle:**

- "What's the most active seed-stage AI infrastructure firm in the last 30 days?"  
- "Summarize everything that's happened with Anthropic this week"  
- "Which VC firms have invested in both AI tooling and enterprise software?"  
- "Are there any companies in my startup tracker that have posted new engineering roles?"  
- "What's the dominant narrative in AI research papers published this month?"  
- "Show me all Form D filings from AI companies in the Midwest in the last 60 days"

**UI:** Slide-out panel from the right side. Persistent across tabs. Chat history saved per session. Responses include inline citations that link back to source items.

---

## 7\. Database Schema

\-- Core content table

CREATE TABLE items (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  source TEXT NOT NULL,              \-- 'techcrunch', 'arxiv', 'edgar', 'xai', etc.

  category TEXT NOT NULL,            \-- 'news', 'deal', 'research', 'filing', 'signal'

  title TEXT NOT NULL,

  url TEXT UNIQUE NOT NULL,

  raw\_content TEXT,

  ai\_summary TEXT,                   \-- 1-2 sentence Claude summary

  embedding BLOB,                    \-- vector for semantic search

  published\_at DATETIME,

  ingested\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

  is\_new INTEGER DEFAULT 1,          \-- 1 \= new (last 24h), 0 \= read

  metadata JSON                      \-- flexible: author, company, amount, stage, etc.

);

\-- Companies (AI labs \+ tracked startups)

CREATE TABLE companies (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL,

  type TEXT NOT NULL,                \-- 'ai\_lab', 'startup', 'vc\_firm'

  website TEXT,

  crunchbase\_url TEXT,

  twitter\_handle TEXT,

  description TEXT,

  stage TEXT,                        \-- for startups: pre-seed, seed, series-a, etc.

  last\_round\_amount TEXT,

  last\_round\_date TEXT,

  headcount\_estimate INTEGER,

  danny\_note TEXT,

  kanban\_status TEXT DEFAULT 'watching',  \-- watching, researching, interested, applied, archived

  tags JSON,

  added\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

  updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);

\-- People watchlist

CREATE TABLE people (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL,

  current\_role TEXT,

  current\_company TEXT,

  twitter\_handle TEXT,

  github\_username TEXT,

  why\_watching TEXT,

  signal\_status TEXT DEFAULT 'green',  \-- green, yellow, red

  last\_activity\_at DATETIME,

  added\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);

\-- VC Deals

CREATE TABLE deals (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  company\_name TEXT NOT NULL,

  stage TEXT,

  amount\_usd INTEGER,

  lead\_investor TEXT,

  co\_investors JSON,

  announced\_at DATE,

  sector\_tags JSON,

  description TEXT,

  ai\_summary TEXT,

  source\_url TEXT,

  source TEXT,                       \-- 'techcrunch', 'edgar', 'crunchbase\_scrape'

  ingested\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);

\-- Thesis system

CREATE TABLE theses (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL,

  description TEXT,

  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);

CREATE TABLE thesis\_items (

  thesis\_id INTEGER REFERENCES theses(id),

  item\_id INTEGER REFERENCES items(id),

  danny\_note TEXT,

  tagged\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,

  PRIMARY KEY (thesis\_id, item\_id)

);

\-- Chat history

CREATE TABLE chat\_sessions (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);

CREATE TABLE chat\_messages (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  session\_id INTEGER REFERENCES chat\_sessions(id),

  role TEXT NOT NULL,                \-- 'user' or 'assistant'

  content TEXT NOT NULL,

  context\_items JSON,                \-- item IDs used as RAG context

  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP

);

---

## 8\. AI Integration Specs

### 8.1 Article Summarization Pipeline

**Trigger:** On every new item ingested  
**Model:** claude-haiku-3-5 (fast, cheap, good enough for summaries)  
**Prompt:**

You are an intelligence analyst summarizing content for a professional tracking AI and venture capital.

Summarize the following article in exactly 1-2 sentences. Be specific about what happened, who was involved, and why it matters. Do not use filler phrases. Be direct.

Article: {raw\_content}

**Batch processing:** Summarize in batches of 20 every 15 minutes to avoid rate limits.

### 8.2 Chat / RAG System

**Model:** claude-sonnet-4-20250514  
**Context window strategy:**

- Retrieve top 10 most semantically relevant items from DB  
- Include item metadata (source, date, category) alongside content chunks  
- System prompt establishes Danny's context and what the DB contains

**System prompt for chat:**

You are Mikol.ai, an AI intelligence assistant for Danny — a 23-year-old Customer Success Engineer at IBM who is actively tracking the AI and venture capital landscape to make a strategic career move into a high-upside startup.

You have access to a curated database of items Danny has collected, including: news articles from major tech/AI outlets, VC funding rounds, SEC Form D filings, arXiv research papers, and signals from people Danny is tracking.

When answering questions, cite specific items from the context provided. Be direct and analytical. If the data doesn't support a conclusion, say so. Danny values honesty over polish.

Context items (most relevant to this query):

{retrieved\_context}

### 8.3 Thesis Analysis

**Trigger:** Danny clicks "Analyze this thesis" on a thesis board  
**Model:** claude-sonnet-4-20250514  
**What it does:** Takes all items tagged to a thesis, synthesizes the pattern, and writes:

1. What thesis Danny appears to be building  
2. What evidence supports it  
3. What's missing or contradicts it  
4. Suggested thesis statement Danny could adopt

---

## 9\. API Keys Required

| Service | Purpose | Cost | Where to get |
| :---- | :---- | :---- | :---- |
| Anthropic API | Summarization \+ Chat | Pay per token (\~$3/M input, $15/M output for Sonnet) | console.anthropic.com |
| xAI Grok API | Twitter/X data \+ real-time search | Free tier available | console.x.ai |
| GitHub API | Public repo/activity monitoring | Free (unauthenticated: 60 req/hr, authenticated: 5000 req/hr) | github.com/settings/tokens |
| arXiv API | Research papers | Free, no key needed | export.arxiv.org |
| EDGAR API | SEC filings | Free, no key needed | efts.sec.gov |
| Semantic Scholar | Paper metadata | Free API | api.semanticscholar.org |

**Total estimated cost for moderate daily use:** $5-20/month on Anthropic API depending on how many articles are summarized and how much chat is used. Everything else is free.

---

## 10\. Build Phases

### Phase 1 — Core (Build First, Week 1\)

- [ ] Project scaffolding (React \+ Vite frontend, Express backend, SQLite DB)  
- [ ] RSS ingestion pipeline (TechCrunch, VentureBeat, Reuters, etc.)  
- [ ] Article summarization pipeline (Claude Haiku)  
- [ ] Dashboard tab (Top Stories, Deal Flow, basic layout)  
- [ ] AI Labs tab (company list \+ news feed per company)  
- [ ] Basic chat panel (RAG over news items)  
- [ ] SQLite schema \+ DB setup  
- [ ] .env config for all API keys

### Phase 2 — Deal Flow (Week 1-2)

- [ ] SEC EDGAR Form D scraper \+ feed  
- [ ] VC Deals tab (manual entry \+ auto-scrape from TechCrunch/StrictlyVC)  
- [ ] Investor tracking (per-firm view)  
- [ ] Deal filtering and table UI

### Phase 3 — People & Startups (Week 2\)

- [ ] Startup Tracker tab with Kanban  
- [ ] Manual startup add with auto-scrape  
- [ ] People Signals watchlist  
- [ ] xAI API integration for Twitter monitoring  
- [ ] GitHub API for public activity monitoring

### Phase 4 — Research & Thesis (Week 2+)

- [ ] arXiv feed \+ summarization  
- [ ] Papers With Code integration  
- [ ] Thesis Board tab  
- [ ] Thesis analysis AI feature  
- [ ] Semantic search across all items

### Phase 5 — Polish (Ongoing)

- [ ] Notification/flag system for high-signal items  
- [ ] Export to markdown/PDF for sharing  
- [ ] Mobile-responsive layout  
- [ ] Dark/light mode toggle  
- [ ] Performance tuning (pagination, lazy loading)

---

## 11\. Claude Code Instructions

When building this project, Claude Code should:

1. **Start with the backend data pipeline first** — an empty dashboard is useless. Get data flowing before building UI.  
     
2. **Use SQLite (better-sqlite3)** — not PostgreSQL, not MongoDB. Keep it simple and local. The schema above is the source of truth.  
     
3. **Use sqlite-vec** for vector storage — this is the easiest way to add semantic search to SQLite without spinning up a separate vector DB.  
     
4. **All scrapers should fail gracefully** — if a source is down or blocks the scraper, log it and move on. Never crash the whole pipeline.  
     
5. **Rate limit all external calls** — add delays between scraper requests. Use exponential backoff on failures. Respect robots.txt where reasonable.  
     
6. **Claude API calls should be batched** — never summarize articles one-at-a-time. Batch 10-20 at a time in background jobs.  
     
7. **The chat panel is RAG, not general chat** — it should only answer questions using retrieved items from the DB. If it can't find relevant context, it should say so and suggest what to search instead.  
     
8. **UI should be dark by default** — dense, data-rich, professional. Think Bloomberg Terminal aesthetic with modern typography. No white backgrounds, no rounded pastel cards.  
     
9. **Every piece of data needs a timestamp and source** — never display information without showing where it came from and when it was published/ingested.  
     
10. **Build the .env file template** — include all required API key slots with comments explaining where to get each one.  
      
11. **Include a seed script** — on first run, backfill the last 7 days of data so the dashboard isn't empty.  
      
12. **Cron jobs run server-side** — news refresh every 3 hours, EDGAR check every 6 hours, GitHub/Twitter person monitoring once daily.

---

## 12\. File to Create First (Claude Code Starting Point)

Mikol.ai/

├── package.json              (root workspace)

├── .env.example              (all required keys with comments)

├── README.md                 (setup instructions)

├── client/

│   ├── package.json

│   └── src/

│       └── App.jsx           (tab shell, routing, dark theme)

└── server/

    ├── package.json

    ├── index.js              (Express app)

    ├── db/

    │   ├── schema.sql        (full schema from Section 7\)

    │   └── db.js             (connection \+ init)

    ├── scrapers/

    │   └── rss.js            (start here — ingest first 5 RSS feeds)

    ├── ai/

    │   └── summarize.js      (batch summarization pipeline)

    └── routes/

        └── feed.js           (GET /api/feed endpoint)

**First working milestone:** Danny runs `npm run dev`, the app opens, the dashboard shows real articles from the last 24 hours with AI summaries. Everything else builds from there.

---

## 13\. Open Questions / Future Decisions

- **LinkedIn monitoring:** Against ToS to scrape. Consider building a "LinkedIn clipboard" feature where Danny pastes a person's LinkedIn URL and the app manually stores their role/company for reference, with a reminder to check it weekly.  
- **Email digest:** Eventually add a daily digest email (via Resend.com free tier — 3,000 emails/mo free) summarizing overnight developments.  
- **Mobile app:** Once the web app is stable, consider wrapping in Capacitor for a native mobile experience.  
- **Paid data APIs:** When budget allows, Crunchbase Pro ($29/mo for basic) and NewsAPI ($50/mo) would significantly improve deal flow coverage. EDGAR \+ RSS is solid for v1.  
- **Sharing:** If Danny ever wants to share a thesis board or startup comparison with a colleague/interviewer, add a read-only shareable link feature.  
- **Stealth automation:** Phase 2+ — use GitHub new repo detection \+ X keyword monitoring to auto-flag potential stealth moves without manual add.

