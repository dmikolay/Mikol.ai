export default function ArticleCard({ item }) {
  if (!item) return null
  const { title, source, published_at, ai_summary, url, is_new } = item

  const ago = published_at ? formatAgo(new Date(published_at)) : null

  return (
    <div className="card" style={{ position: 'relative' }}>
      {is_new === 1 && (
        <span className="badge badge-sage" style={{ position: 'absolute', top: 10, right: 12 }}>
          NEW
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className="badge badge-navy">{source}</span>
        {ago && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--c-text-muted)', letterSpacing: '0.04em',
          }}>
            {ago}
          </span>
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block', fontSize: 13, fontWeight: 500,
          color: 'var(--c-navy)', textDecoration: 'none',
          lineHeight: 1.45, marginBottom: ai_summary ? 8 : 0,
          transition: 'color 0.1s',
        }}
        onMouseOver={(e) => e.currentTarget.style.color = 'var(--c-navy-mid)'}
        onMouseOut={(e) => e.currentTarget.style.color = 'var(--c-navy)'}
      >
        {title}
      </a>
      {ai_summary && (
        <p style={{
          fontSize: 12, color: 'var(--c-text-secondary)',
          lineHeight: 1.55, borderLeft: '2px solid var(--c-sage)',
          paddingLeft: 10, marginTop: 2,
        }}>
          {ai_summary}
        </p>
      )}
    </div>
  )
}

function formatAgo(date) {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) {
    const m = Math.floor(diff / 60000)
    return m < 1 ? 'just now' : `${m}m ago`
  }
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1d ago' : `${d}d ago`
}
