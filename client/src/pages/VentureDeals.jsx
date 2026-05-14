import { useEffect, useState, useCallback, useRef } from 'react'
import FeedCard from '../components/FeedCard.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rounds',   label: 'Recent Rounds' },
  { id: 'edgar',    label: 'Form D Feed'   },
  { id: 'investor', label: 'Investor Activity' },
  { id: 'funds',    label: 'Fund Announcements' },
]

const STAGE_META = {
  'pre-seed':    { label: 'Pre-Seed',   bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe' },
  'seed':        { label: 'Seed',       bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
  'series-a':    { label: 'Series A',   bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  'series-b':    { label: 'Series B',   bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'series-c':    { label: 'Series C',   bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  'series-d':    { label: 'Series D',   bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
  'series-e':    { label: 'Series E',   bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  'growth':      { label: 'Growth',     bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
  'ipo':         { label: 'IPO',        bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' },
  'acquisition': { label: 'Acquisition',bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
}

const SOURCE_LABELS = {
  'tc-funding':     'TechCrunch',
  'crunchbase-news':'Crunchbase',
  'tc-venture':     'TechCrunch',
  'edgar':          'SEC EDGAR',
}

const VC_FIRMS = [
  { name: 'Drive Capital',       aliases: ['Drive Capital'] },
  { name: 'Andreessen Horowitz', aliases: ['a16z', 'Andreessen Horowitz', 'andreessen horowitz'] },
  { name: 'Sequoia',             aliases: ['Sequoia Capital', 'Sequoia'] },
  { name: 'Benchmark',           aliases: ['Benchmark'] },
  { name: 'Founders Fund',       aliases: ['Founders Fund'] },
  { name: 'General Catalyst',    aliases: ['General Catalyst'] },
  { name: 'Khosla Ventures',     aliases: ['Khosla Ventures', 'Khosla'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(n) {
  if (n == null) return null
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

function fmtDate(s) {
  if (!s) return null
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtAgo(s) {
  if (!s) return null
  const diff = Date.now() - new Date(s).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function StageBadge({ stage }) {
  const m = stage ? STAGE_META[stage] : null
  if (!m) return null
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 2,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {m.label}
    </span>
  )
}

function AmountBadge({ amount }) {
  if (!amount) return null
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      color: 'var(--c-sage-dark)', letterSpacing: '-0.01em',
    }}>
      {fmtAmount(amount)}
    </span>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  if (!stats) return null
  return (
    <div style={{
      display: 'flex', gap: 28, flexWrap: 'wrap',
      padding: '10px 0 16px', marginBottom: 20,
      borderBottom: '1px solid var(--c-border)',
    }}>
      <StatCell label="Deals tracked"    value={stats.total_deals} />
      <StatCell label="Total raised"     value={stats.total_raised ? fmtAmount(stats.total_raised) : '—'} />
      <StatCell label="With amount"      value={stats.with_amount} />
      <StatCell label="Form D filings"   value={stats.filing_count} />
      {stats.top_investor && (
        <StatCell label="Most active"    value={stats.top_investor.lead_investor} small />
      )}
      {stats.latest_filing && (
        <StatCell label="Latest filing"  value={fmtDate(stats.latest_filing)} small />
      )}
    </div>
  )
}

function StatCell({ label, value, small }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--c-text-muted)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 600,
        fontSize: small ? 12.5 : 15,
        color: 'var(--c-text-primary)', letterSpacing: '-0.01em',
        maxWidth: small ? 180 : undefined,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange }) {
  const sel = (name, value) => ({
    fontFamily: 'var(--font-mono)', fontSize: 11,
    padding: '4px 8px', borderRadius: 3,
    background: 'var(--c-surface)',
    border: `1px solid ${value ? 'var(--c-navy-mid)' : 'var(--c-border-2)'}`,
    color: value ? 'var(--c-navy)' : 'var(--c-text-secondary)',
    cursor: 'pointer', outline: 'none',
  })

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      marginBottom: 16,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--c-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Filter
      </span>

      {/* Stage */}
      <select value={filters.stage || ''} onChange={e => onChange({ ...filters, stage: e.target.value || null })} style={sel('stage', filters.stage)}>
        <option value="">All stages</option>
        {Object.entries(STAGE_META).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      {/* Days */}
      <select value={filters.days} onChange={e => onChange({ ...filters, days: parseInt(e.target.value) })} style={sel('days', false)}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        <option value={365}>Last year</option>
      </select>

      {/* Min amount */}
      <select value={filters.min_amount || ''} onChange={e => onChange({ ...filters, min_amount: e.target.value ? parseInt(e.target.value) : null })} style={sel('min', filters.min_amount)}>
        <option value="">Any size</option>
        <option value={1000000}>$1M+</option>
        <option value={10000000}>$10M+</option>
        <option value={50000000}>$50M+</option>
        <option value={100000000}>$100M+</option>
        <option value={500000000}>$500M+</option>
      </select>

      {/* Source */}
      <select value={filters.source || ''} onChange={e => onChange({ ...filters, source: e.target.value || null })} style={sel('source', filters.source)}>
        <option value="">All sources</option>
        <option value="tc-funding">TechCrunch Funding</option>
        <option value="crunchbase-news">Crunchbase News</option>
        <option value="tc-venture">TechCrunch Venture</option>
        <option value="edgar">SEC EDGAR</option>
      </select>

      {/* Reset */}
      {(filters.stage || filters.min_amount || filters.source || filters.days !== 90) && (
        <button
          onClick={() => onChange({ stage: null, days: 90, min_amount: null, source: null })}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 9px', borderRadius: 3,
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)',
            color: 'var(--c-text-muted)', cursor: 'pointer',
          }}
        >
          ✕ Clear
        </button>
      )}

      <span style={{
        marginLeft: 'auto', fontFamily: 'var(--font-mono)',
        fontSize: 9.5, color: 'var(--c-text-muted)',
      }}>
        {filters._count != null ? `${filters._count} results` : ''}
      </span>
    </div>
  )
}

// ── Expandable deal row (table row that expands to show summary) ───────────────

function DealRow({ deal, cols }) {
  const [open, setOpen] = useState(false)
  const sourceName = SOURCE_LABELS[deal.source] || deal.source

  const titleText = deal.company_name
    ? deal.company_name
    : deal.title || deal.url

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          background: open ? 'var(--c-navy-light)' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--c-surface-2)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        {/* Expand chevron */}
        <td style={{ ...tdBase, width: 28, color: 'var(--c-text-muted)', fontSize: 10 }}>
          {open ? '▾' : '▸'}
        </td>

        {/* Company */}
        <td style={{ ...tdBase, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {titleText}
        </td>

        {/* Stage */}
        <td style={{ ...tdBase, width: 100 }}>
          {deal.stage ? <StageBadge stage={deal.stage} /> : (
            <span style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>—</span>
          )}
        </td>

        {/* Amount */}
        <td style={{ ...tdBase, width: 90, fontFamily: 'var(--font-mono)' }}>
          {deal.amount_usd ? (
            <AmountBadge amount={deal.amount_usd} />
          ) : (
            <span style={{ color: 'var(--c-text-muted)', fontSize: 10 }}>—</span>
          )}
        </td>

        {/* Lead investor */}
        {cols.includes('investor') && (
          <td style={{ ...tdBase, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text-secondary)', fontSize: 12 }}>
            {deal.lead_investor || <span style={{ color: 'var(--c-text-muted)' }}>—</span>}
          </td>
        )}

        {/* Date */}
        <td style={{ ...tdBase, width: 100, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--c-text-muted)' }}>
          {fmtAgo(deal.published_at)}
        </td>

        {/* Source */}
        <td style={{ ...tdBase, width: 90, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-text-tertiary)', letterSpacing: '0.04em' }}>
          {sourceName}
        </td>
      </tr>

      {/* Expanded row */}
      {open && (
        <tr style={{ background: 'var(--c-navy-light)' }}>
          <td />
          <td colSpan={cols.includes('investor') ? 5 : 4} style={{ padding: '10px 14px 14px', verticalAlign: 'top' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* AI summary */}
              {deal.ai_summary && (
                <p style={{
                  fontSize: 12.5, lineHeight: 1.55, color: 'var(--c-text-secondary)',
                  paddingLeft: 10, borderLeft: '2px solid var(--c-sage)', margin: 0,
                }}>
                  {deal.ai_summary}
                </p>
              )}

              {/* Raw description snippet if no summary yet */}
              {!deal.ai_summary && deal.raw_content && (
                <p style={{
                  fontSize: 12, lineHeight: 1.5, color: 'var(--c-text-muted)',
                  paddingLeft: 10, borderLeft: '2px solid var(--c-border-2)', margin: 0,
                  fontStyle: 'italic',
                }}>
                  {deal.raw_content.slice(0, 280)}…
                </p>
              )}

              {/* Metadata row */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {deal.announced_at && (
                  <MetaChip label="Date" value={fmtDate(deal.published_at)} />
                )}
                {deal.lead_investor && (
                  <MetaChip label="Lead" value={deal.lead_investor} />
                )}
                {deal.sector_tags && Array.isArray(deal.sector_tags) && (
                  <MetaChip label="Sector" value={deal.sector_tags.join(', ')} />
                )}
                <a
                  href={deal.url || deal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-navy-mid)',
                    textDecoration: 'none', letterSpacing: '0.04em',
                    marginLeft: 'auto',
                  }}
                  onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  View source ↗
                </a>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const tdBase = {
  padding: '9px 12px',
  fontSize: 12.5,
  color: 'var(--c-text-primary)',
  borderBottom: '1px solid var(--c-border)',
  verticalAlign: 'middle',
}

const thBase = {
  ...tdBase,
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--c-text-muted)',
  background: 'var(--c-surface-2)',
  userSelect: 'none',
  whiteSpace: 'nowrap',
}

function MetaChip({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--c-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
        {value}
      </span>
    </div>
  )
}

// ── Deal table wrapper ─────────────────────────────────────────────────────────

function DealTable({ deals, loading, cols = ['investor'] }) {
  if (loading) return <SkeletonRows />
  if (!deals || deals.length === 0) {
    return (
      <div style={{
        padding: '32px 0', textAlign: 'center',
        color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.06em',
      }}>
        No deals match the current filters.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 28 }} />
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: 90 }} />
          {cols.includes('investor') && <col style={{ width: 160 }} />}
          <col style={{ width: 100 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={thBase} />
            <th style={{ ...thBase, textAlign: 'left' }}>Company</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Stage</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Amount</th>
            {cols.includes('investor') && <th style={{ ...thBase, textAlign: 'left' }}>Lead Investor</th>}
            <th style={{ ...thBase, textAlign: 'left' }}>Date</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <DealRow key={`${d.id}-${d.row_type}-${i}`} deal={d} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          height: 42, background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)', borderRadius: 2,
          animation: 'pulse 1.4s ease-in-out infinite',
          animationDelay: `${i * 0.08}s`,
        }} />
      ))}
    </div>
  )
}

// ── Edgar filing row ──────────────────────────────────────────────────────────

function EdgarRow({ filing }) {
  const [open, setOpen] = useState(false)
  let meta = filing.metadata || {}
  const exemptions = (meta.exemption_codes || []).map(e => e.label).join(', ') || '—'
  const state = (meta.inc_states || [])[0] || (meta.biz_locations || [])[0] || '—'
  const isNew = filing.is_new === 1

  const name = filing.title?.replace(/^Form D:\s*/i, '') || '—'

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          background: open ? 'var(--c-navy-light)' : 'transparent',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--c-surface-2)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <td style={{ ...tdBase, width: 28, color: 'var(--c-text-muted)', fontSize: 10 }}>
          {open ? '▾' : '▸'}
        </td>
        <td style={{ ...tdBase, fontWeight: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {name}
            {isNew && <span className="badge badge-sage">NEW</span>}
          </div>
        </td>
        <td style={{ ...tdBase, width: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-text-secondary)' }}>
          {state}
        </td>
        <td style={{ ...tdBase, width: 160, fontSize: 11.5, color: 'var(--c-text-secondary)' }}>
          {exemptions}
        </td>
        <td style={{ ...tdBase, width: 100, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--c-text-muted)' }}>
          {fmtDate(filing.published_at)}
        </td>
      </tr>

      {open && (
        <tr style={{ background: 'var(--c-navy-light)' }}>
          <td />
          <td colSpan={4} style={{ padding: '10px 14px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filing.ai_summary && (
                <p style={{
                  fontSize: 12.5, lineHeight: 1.55, color: 'var(--c-text-secondary)',
                  paddingLeft: 10, borderLeft: '2px solid var(--c-sage)', margin: 0,
                }}>
                  {filing.ai_summary}
                </p>
              )}
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                {(meta.biz_locations || []).length > 0 && (
                  <MetaChip label="Location" value={meta.biz_locations[0]} />
                )}
                {meta.adsh && (
                  <MetaChip label="Accession" value={meta.adsh} />
                )}
                <a
                  href={filing.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-navy-mid)',
                    textDecoration: 'none', letterSpacing: '0.04em', marginLeft: 'auto',
                  }}
                  onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  SEC Filing ↗
                </a>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Investor Activity tab ──────────────────────────────────────────────────────

function InvestorActivity() {
  const [selected, setSelected]     = useState(VC_FIRMS[0].name)
  const [firmData, setFirmData]     = useState(null)   // { deals, news }
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [days, setDays]             = useState(365)

  // Fetch per-firm data whenever firm or date window changes
  useEffect(() => {
    const firm = VC_FIRMS.find(f => f.name === selected)
    if (!firm) return
    setLoading(true)
    setError(null)
    setFirmData(null)
    const params = new URLSearchParams({
      aliases: firm.aliases.join(','),
      days,
    })
    fetch(`/api/deals/investor?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setFirmData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selected, days])

  const dealCount = firmData?.deals?.length ?? 0
  const newsCount = firmData?.news?.length  ?? 0

  return (
    <div style={{
      display: 'flex', border: '1px solid var(--c-border)',
      borderRadius: 4, overflow: 'hidden', minHeight: 480,
    }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: 196, flexShrink: 0,
        background: 'var(--c-surface-2)',
        borderRight: '1px solid var(--c-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 14px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--c-text-muted)', borderBottom: '1px solid var(--c-border)',
          flexShrink: 0,
        }}>
          VC Firms
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {VC_FIRMS.map(f => {
            const isActive = f.name === selected
            return (
              <button
                key={f.name}
                onClick={() => setSelected(f.name)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px',
                  background: isActive ? 'var(--c-navy-light)' : 'transparent',
                  borderBottom: '1px solid var(--c-border)',
                  border: 'none',
                  borderLeft: `2px solid ${isActive ? 'var(--c-navy)' : 'transparent'}`,
                  textAlign: 'left', cursor: 'pointer',
                  fontSize: 12.5,
                  color: isActive ? 'var(--c-navy)' : 'var(--c-text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--c-surface)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Panel header */}
        <div style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <h3 style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--c-navy)', margin: 0,
            }}>
              {selected}
            </h3>
            {!loading && firmData && (
              <p style={{ fontSize: 11.5, color: 'var(--c-text-muted)', marginTop: 2 }}>
                {dealCount} investment{dealCount !== 1 ? 's' : ''} · {newsCount} news mention{newsCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Date window picker */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5,
              color: 'var(--c-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Window
            </span>
            <select
              value={days}
              onChange={e => setDays(parseInt(e.target.value))}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                padding: '3px 7px', borderRadius: 3,
                background: 'var(--c-surface-2)',
                border: '1px solid var(--c-border-2)',
                color: 'var(--c-text-secondary)', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
              <option value={730}>2 years</option>
            </select>
          </div>
        </div>

        {/* Panel body */}
        <div style={{ padding: '20px', flex: 1 }}>
          {loading && <SkeletonRows />}
          {error   && <ErrorBanner msg={error} />}

          {!loading && !error && firmData && (
            <>
              {/* ── Recent Investments ── */}
              <SectionHeader
                title="Recent Investments"
                count={dealCount}
                emptyNote="No investments found in the deals table for this window. As more deal data is ingested, matches will appear here."
              />

              {dealCount > 0 ? (
                <div style={{ marginBottom: 28 }}>
                  <DealTable deals={firmData.deals} loading={false} cols={[]} />
                </div>
              ) : (
                <EmptyNote>
                  No investment records matched for this firm in the last {days} days.
                  Deal coverage grows as more RSS data is ingested.
                </EmptyNote>
              )}

              {/* ── News Mentions ── */}
              <SectionHeader
                title="News Mentions"
                count={newsCount}
                emptyNote="No news mentions found."
              />

              {newsCount > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {firmData.news.map(item => (
                    <FeedCard key={item.id} item={item} compact showCategory />
                  ))}
                </div>
              ) : (
                <EmptyNote>
                  No articles mentioning {selected} in the last {days} days.
                  News mentions appear as more feed data accumulates.
                </EmptyNote>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      marginBottom: 10, paddingBottom: 6,
      borderBottom: '1px solid var(--c-border)',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--c-text-secondary)',
      }}>
        {title}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: 'var(--c-text-muted)', letterSpacing: '0.04em',
      }}>
        {count} result{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function EmptyNote({ children }) {
  return (
    <div style={{
      padding: '14px 16px', marginBottom: 24,
      background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
      borderRadius: 3,
      fontSize: 12, color: 'var(--c-text-muted)', lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

// ── Tab inner components ───────────────────────────────────────────────────────

function RecentRounds({ filters, onFiltersChange }) {
  const [deals, setDeals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const fetchRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++fetchRef.current
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      p.set('days', filters.days)
      p.set('limit', 80)
      if (filters.stage)      p.set('stage', filters.stage)
      if (filters.min_amount) p.set('min_amount', filters.min_amount)
      if (filters.source)     p.set('source', filters.source)
      const res = await fetch(`/api/deals?${p}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (seq !== fetchRef.current) return
      setDeals(json.deals || [])
      onFiltersChange(f => ({ ...f, _count: json.total }))
    } catch (e) {
      if (seq !== fetchRef.current) return
      setError(e.message)
    } finally {
      if (seq === fetchRef.current) setLoading(false)
    }
  }, [filters.days, filters.stage, filters.min_amount, filters.source])

  useEffect(() => { load() }, [load])

  return (
    <>
      {error && <ErrorBanner msg={error} />}
      <DealTable deals={deals} loading={loading} cols={['investor']} />
    </>
  )
}

function EdgarFeed({ filters }) {
  const [filings, setFilings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/deals/edgar?days=${filters.days}&limit=80`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(j => setFilings(j.filings || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters.days])

  if (loading) return <SkeletonRows />
  if (error)   return <ErrorBanner msg={error} />
  if (filings.length === 0) return (
    <div style={{
      padding: '40px 0', textAlign: 'center',
      color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      No EDGAR filings in the last {filters.days} days.
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: 28 }} />
            <th style={{ ...thBase, textAlign: 'left' }}>Company</th>
            <th style={{ ...thBase, width: 60, textAlign: 'left' }}>State</th>
            <th style={{ ...thBase, width: 200, textAlign: 'left' }}>Exemption</th>
            <th style={{ ...thBase, width: 120, textAlign: 'left' }}>Filed</th>
          </tr>
        </thead>
        <tbody>
          {filings.map((f, i) => <EdgarRow key={`${f.id}-${i}`} filing={f} />)}
        </tbody>
      </table>
    </div>
  )
}

function FundAnnouncements({ filters }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/deals/funds?days=${filters.days}&limit=40`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(j => setItems(j.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters.days])

  if (loading) return <SkeletonRows />
  if (error)   return <ErrorBanner msg={error} />
  if (items.length === 0) return (
    <div style={{
      padding: '40px 0', textAlign: 'center',
      color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      No fund announcements found in the last {filters.days} days.
      <br />
      <span style={{ fontSize: 10.5, marginTop: 4, display: 'block' }}>
        Fund news accumulates from TechCrunch, VentureBeat, and Crunchbase RSS feeds.
      </span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => <FeedCard key={item.id} item={item} compact />)}
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      background: 'var(--c-red-light)', border: '1px solid #f5b8b8',
      borderRadius: 4, padding: '10px 14px', marginBottom: 16,
      fontSize: 12.5, color: 'var(--c-red)', fontFamily: 'var(--font-mono)',
    }}>
      Error: {msg}
    </div>
  )
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function VentureDeals() {
  const [activeTab, setActiveTab] = useState('rounds')
  const [stats, setStats]         = useState(null)
  const [filters, setFilters]     = useState({ stage: null, days: 90, min_amount: null, source: null })

  // Load stats once on mount
  useEffect(() => {
    fetch('/api/deals/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  const showFilter = activeTab === 'rounds' || activeTab === 'edgar'

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">Venture &amp; Deal Flow</div>
        <div className="page-header__sub">AI-sector funding rounds, M&amp;A, Form D filings, and investor activity</div>
      </div>

      <div className="page-body">
        <StatsBar stats={stats} />

        {/* Sub-tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--c-border)',
          marginBottom: 20, gap: 0,
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 16px',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === t.id ? 'var(--c-navy)' : 'var(--c-text-muted)',
                borderBottom: activeTab === t.id ? '2px solid var(--c-navy)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.1s',
              }}
              onMouseEnter={e => { if (activeTab !== t.id) e.currentTarget.style.color = 'var(--c-text-secondary)' }}
              onMouseLeave={e => { if (activeTab !== t.id) e.currentTarget.style.color = 'var(--c-text-muted)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter bar — shared across rounds + edgar */}
        {showFilter && (
          <FilterBar
            filters={filters}
            onChange={setFilters}
          />
        )}

        {/* Tab content */}
        {activeTab === 'rounds' && (
          <RecentRounds filters={filters} onFiltersChange={setFilters} />
        )}
        {activeTab === 'edgar' && (
          <EdgarFeed filters={filters} />
        )}
        {activeTab === 'investor' && (
          <InvestorActivity />
        )}
        {activeTab === 'funds' && (
          <FundAnnouncements filters={filters} />
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </>
  )
}
