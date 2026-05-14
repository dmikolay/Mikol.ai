# Mikol.ai - Phase 2 Context

## What's already built (Phase 1 complete)
- Node/Express backend with SQLite database
- RSS ingestion pipeline (TechCrunch, VentureBeat, Ars Technica, MIT TR, Wired, Reuters, Hugging Face)
- Gemini Flash summarization pipeline (batched, rate limited to 15 req/min)
- Ollama (llama3.1) for chat RAG interface
- React/Vite frontend with Tailwind, dark theme
- 7-tab navigation shell: Dashboard, AI Labs, Venture & Deal Flow, Startup Tracker, People Signals, Research, Thesis Board
- Dashboard tab fully built with real data

## Key decisions already made
- Summarization: Gemini Flash (gemini-1.5-flash)
- Chat: Ollama local at http://localhost:11434, model configurable via OLLAMA_MODEL in .env
- Database: SQLite via better-sqlite3
- xAI deferred to Phase 3
- Paywalled sources skipped entirely
- Blog scrapers (OpenAI, Anthropic, Meta, DeepMind, Mistral) deferred to later phase

## What Phase 2 needs to build
From the planning doc Section 10 Phase 2:
- SEC EDGAR Form D scraper and feed
- Venture & Deal Flow tab (Section 6, Tab 3)
- Sub-sections: Recent Rounds, Investor Activity, Form D Feed, Fund Announcements
- VC deal filtering and table UI
- Investor tracking per-firm view
- Sources: StrictlyVC, Term Sheet RSS, TechCrunch funding tag, EDGAR API

## Stack reference
- Frontend: React + Vite + Tailwind + Zustand + React Router
- Backend: Node.js + Express + better-sqlite3
- AI: Gemini Flash (summarization) + Ollama llama3.1 (chat)
- Scraping: Cheerio + Axios

## Once Phase 2 complete
- SEC EDGAR Form D scraper built and running
- VC deal flow scrapers: StrictlyVC, Term Sheet, TechCrunch funding RSS
- Deals table populated with summaries
- Venture & Deal Flow tab fully built: Recent Rounds, Investor Activity, Form D Feed, Fund Announcements
- Default investor watchlist: Drive Capital, a16z, Sequoia, Benchmark, Founders Fund, General Catalyst, Khosla Ventures

## Phase 3 needs to build
- Startup Tracker tab with Kanban board
- Manual startup add with auto-scrape of public data
- People Signals tab with watchlist
- xAI API integration for Twitter/X monitoring
- GitHub API for public activity monitoring
- Signal keyword flagging system
