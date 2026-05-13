const STAGE_BADGE = {
  'pre-seed': 'badge badge-gray',
  'seed':     'badge badge-navy',
  'series-a': 'badge badge-sage',
  'series-b': 'badge badge-amber',
  'series-c': 'badge badge-amber',
}

function formatAmount(n) {
  if (!n) return null
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(0)}M`
  return `$${n.toLocaleString()}`
}

export default function DealCard({ deal }) {
  if (!deal) return null
  const { company_name, stage, amount_usd, lead_investor, announced_at, ai_summary, source_url } = deal
  const stageClass = STAGE_BADGE[stage?.toLowerCase()] ?? 'badge badge-gray'
  const amount = formatAmount(amount_usd)

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--c-navy)',
          fontFamily: 'var(--font-ui)',
        }}>
          {company_name}
        </span>
        {stage && <span className={stageClass}>{stage}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: ai_summary ? 8 : 0 }}>
        {amount && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
            color: 'var(--c-sage-dark)',
          }}>
            {amount}
          </span>
        )}
        {lead_investor && (
          <span style={{ fontSize: 11.5, color: 'var(--c-text-secondary)' }}>
            led by {lead_investor}
          </span>
        )}
        {announced_at && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--c-text-muted)', marginLeft: 'auto',
          }}>
            {announced_at}
          </span>
        )}
      </div>

      {ai_summary && (
        <p style={{
          fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.55,
          borderLeft: '2px solid var(--c-sage)', paddingLeft: 10, marginBottom: source_url ? 8 : 0,
        }}>
          {ai_summary}
        </p>
      )}

      {source_url && (
        <a
          href={source_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--c-text-muted)', textDecoration: 'none',
            letterSpacing: '0.04em', transition: 'color 0.1s',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--c-navy-mid)'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--c-text-muted)'}
        >
          source →
        </a>
      )}
    </div>
  )
}
