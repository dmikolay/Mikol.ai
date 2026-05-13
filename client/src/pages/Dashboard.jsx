import { useEffect, useState, useCallback } from 'react'
import DashSection from '../components/DashSection.jsx'
import FeedCard from '../components/FeedCard.jsx'

function MetaBar({ meta, lastFetched, onRefresh, loading }) {
  if (!meta) return null
  const { total_items, new_items, with_summary, last_ingested } = meta

  const ingestedAgo = last_ingested
    ? (() => {
        const diff = Date.now() - new Date(last_ingested).getTime()
        const m = Math.floor(diff / 60000)
        if (m < 1) return 'just now'
        if (m < 60) return `${m}m ago`
        return `${Math.floor(m / 60)}h ago`
      })()
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: '7px 0 14px',
      borderBottom: '1px solid var(--c-border)',
      marginBottom: 24,
      flexWrap: 'wrap',
    }}>
      <Stat label="Total items" value={total_items?.toLocaleString()} />
      <Stat label="New (24h)" value={new_items?.toLocaleString()} accent="sage" />
      <Stat label="Summarized" value={with_summary?.toLocaleString()} />
      {ingestedAgo && <Stat label="Last ingest" value={ingestedAgo} />}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {lastFetched && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5,
            color: 'var(--c-text-muted)', letterSpacing: '0.04em',
          }}>
            Updated {lastFetched}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 3,
            background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border-2)',
            color: 'var(--c-text-secondary)',
            cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.12s',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading…' : '↺ Refresh'}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--c-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600,
        color: accent === 'sage' ? 'var(--c-sage-dark)' : 'var(--c-text-primary)',
        letterSpacing: '-0.01em',
      }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function MarketMoodSection({ items }) {
  // Show the 4 most recently summarized items as "signals driving today's mood"
  const top = items.slice(0, 4)

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--c-border)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--c-text-secondary)', margin: 0,
        }}>
          Market Mood
        </h2>
        <span style={{ fontSize: 11.5, color: 'var(--c-text-muted)' }}>
          Latest signals
        </span>
      </div>

      {top.length === 0 ? (
        <div style={{
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
          borderRadius: 4, padding: '14px 16px',
        }}>
          <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
            Market Mood synthesis runs once daily — add a GEMINI_API_KEY and run the seed script to populate summaries.
          </span>
        </div>
      ) : (
        <div style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 4,
          padding: '14px 16px',
        }}>
          <p style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: 'var(--c-text-muted)', letterSpacing: '0.05em',
            textTransform: 'uppercase', marginBottom: 12,
          }}>
            Recent intelligence · {top.length} signals
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {top.map(item => (
              <div key={item.id} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600,
                  color: 'var(--c-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', marginTop: 1, flexShrink: 0,
                }}>
                  {item.source}
                </span>
                <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {item.ai_summary}
                </p>
              </div>
            ))}
          </div>
          <p style={{
            marginTop: 14, fontSize: 11, color: 'var(--c-text-muted)',
            fontStyle: 'italic', borderTop: '1px solid var(--c-border)', paddingTop: 10,
          }}>
            Daily AI synthesis coming in Phase 1 — will generate a paragraph-level narrative from all overnight items.
          </p>
        </div>
      )}
    </section>
  )
}

export default function Dashboard() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastFetched, setLastFetched] = useState(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastFetched(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="page-header__title">Dashboard</div>
            <div className="page-header__sub">{today}</div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Error state */}
        {error && (
          <div style={{
            background: 'var(--c-red-light)', border: '1px solid #f5b8b8',
            borderRadius: 4, padding: '10px 14px', marginBottom: 20,
            fontSize: 12.5, color: 'var(--c-red)',
            fontFamily: 'var(--font-mono)',
          }}>
            Failed to load dashboard: {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                height: 72, background: 'var(--c-surface-2)',
                border: '1px solid var(--c-border)', borderRadius: 4,
                animation: 'pulse 1.4s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Meta stats bar */}
            <MetaBar
              meta={data.meta}
              lastFetched={lastFetched}
              onRefresh={fetchDashboard}
              loading={loading}
            />

            {/* ── Two-column main layout ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 380px',
              gap: '0 28px',
              alignItems: 'start',
            }}>
              {/* Left column */}
              <div>
                {/* Top Stories */}
                <DashSection
                  title="Top Stories"
                  subtitle="last 48h"
                  items={data.top_stories}
                  layout="stack"
                  emptyPhase={1}
                  emptyDesc="No news items yet — run npm run seed -w server to backfill RSS feeds."
                />

                {/* Research Drops */}
                <DashSection
                  title="Research Drops"
                  subtitle="papers · model releases · benchmarks"
                  items={data.research_drops}
                  layout="stack"
                  compact
                  emptyPhase={4}
                  emptyLabel="Phase 4"
                  emptyDesc="arXiv feed coming in Phase 4. Research-tagged news shown when available."
                />

                {/* Market Mood */}
                <MarketMoodSection items={data.market_mood} />
              </div>

              {/* Right column */}
              <div>
                {/* Deal Flow Pulse */}
                <DashSection
                  title="Deal Flow Pulse"
                  subtitle="funding · M&A · rounds"
                  items={data.deal_flow}
                  layout="stack"
                  compact
                  emptyPhase={2}
                  emptyLabel="Phase 2"
                  emptyDesc="SEC EDGAR + Crunchbase scraper coming in Phase 2."
                />

                {/* People Radar */}
                <DashSection
                  title="People Radar"
                  subtitle="hires · departures · moves"
                  items={data.people_radar}
                  layout="stack"
                  compact
                  emptyPhase={3}
                  emptyLabel="Phase 3"
                  emptyDesc="Watchlist monitoring coming in Phase 3."
                />

                {/* SEC Filings Alert */}
                <DashSection
                  title="SEC Filings Alert"
                  subtitle="Form D · last 7 days"
                  items={data.sec_filings}
                  layout="stack"
                  compact
                  emptyPhase={2}
                  emptyLabel="Phase 2"
                  emptyDesc="EDGAR Form D scraper wires in Phase 2. AI-filtered for ML/AI keywords."
                />
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        @media (max-width: 900px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
