import { useState } from 'react'

const SOURCE_LABELS = {
  techcrunch:  'TechCrunch',
  venturebeat: 'VentureBeat',
  arstechnica: 'Ars Technica',
  'mit-tr':    'MIT Tech Review',
  wired:       'Wired',
  reuters:     'Reuters',
  huggingface: 'Hugging Face',
  arxiv:       'arXiv',
  edgar:       'SEC EDGAR',
}

function formatAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1d ago' : `${d}d ago`
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Category → badge style
const CAT_BADGE = {
  news:     { cls: 'badge-navy',  label: 'NEWS'     },
  deal:     { cls: 'badge-sage',  label: 'DEAL'     },
  research: { cls: 'badge-amber', label: 'RESEARCH' },
  filing:   { cls: 'badge-gray',  label: 'FILING'   },
  signal:   { cls: 'badge-red',   label: 'SIGNAL'   },
}

export default function FeedCard({ item, showCategory = false, compact = false }) {
  const [saved, setSaved] = useState(item.saved === 1)
  const [saving, setSaving] = useState(false)

  if (!item) return null
  const { id, source, category, title, url, ai_summary, published_at, ingested_at, is_new } = item
  const ago  = formatAgo(published_at || ingested_at)
  const date = formatDate(published_at || ingested_at)
  const label = SOURCE_LABELS[source] || source
  const cat   = CAT_BADGE[category] || CAT_BADGE.news

  async function handleSave(e) {
    e.preventDefault()
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/feed/${id}/save`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSaved(data.saved)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <article style={{
      background: 'var(--c-surface)',
      border: `1px solid ${is_new ? 'var(--c-sage)' : 'var(--c-border)'}`,
      borderRadius: 4,
      padding: compact ? '10px 12px' : '12px 14px',
      position: 'relative',
      transition: 'border-color 0.12s, box-shadow 0.12s',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 1px 5px rgba(0,0,0,0.07)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        {showCategory && (
          <span className={`badge ${cat.cls}`}>{cat.label}</span>
        )}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--c-text-tertiary)',
        }}>
          {label}
        </span>
        {ago && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--c-text-muted)',
            letterSpacing: '0.03em',
          }} title={date}>
            {ago}
          </span>
        )}
        {is_new === 1 && (
          <span className="badge badge-sage" style={{ marginLeft: 'auto', flexShrink: 0 }}>NEW</span>
        )}
      </div>

      {/* Headline */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: compact ? 12.5 : 13.5,
          fontWeight: 500,
          lineHeight: 1.4,
          color: 'var(--c-navy)',
          textDecoration: 'none',
          display: 'block',
        }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--c-navy-mid)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--c-navy)'}
      >
        {title}
      </a>

      {/* AI Summary */}
      {ai_summary && (
        <p style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: 'var(--c-text-secondary)',
          paddingLeft: 10,
          borderLeft: '2px solid var(--c-sage)',
          margin: 0,
        }}>
          {ai_summary}
        </p>
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--c-text-muted)',
            textDecoration: 'none',
            letterSpacing: '0.04em',
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--c-navy-mid)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--c-text-muted)'}
        >
          Read source ↗
        </a>
        <button
          onClick={handleSave}
          disabled={saving}
          title={saved ? 'Saved — click to unsave' : 'Save to thesis board'}
          style={{
            background: saved ? 'var(--c-sage-light)' : 'transparent',
            border: `1px solid ${saved ? 'var(--c-sage)' : 'var(--c-border-2)'}`,
            borderRadius: 3,
            padding: '2px 9px',
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: saved ? 'var(--c-sage-dark)' : 'var(--c-text-muted)',
            cursor: saving ? 'default' : 'pointer',
            transition: 'all 0.12s',
            textTransform: 'uppercase',
          }}
          onMouseOver={e => {
            if (!saved) {
              e.currentTarget.style.borderColor = 'var(--c-sage)'
              e.currentTarget.style.color = 'var(--c-sage-dark)'
            }
          }}
          onMouseOut={e => {
            if (!saved) {
              e.currentTarget.style.borderColor = 'var(--c-border-2)'
              e.currentTarget.style.color = 'var(--c-text-muted)'
            }
          }}
        >
          {saving ? '…' : saved ? '✓ Saved' : '+ Save'}
        </button>
      </div>
    </article>
  )
}
