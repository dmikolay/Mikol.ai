import FeedCard from './FeedCard.jsx'

// Phase badge colors
const PHASE_STYLE = {
  1: { bg: 'var(--c-sage-light)',  color: 'var(--c-sage-dark)',  border: '#b8d4bb' },
  2: { bg: 'var(--c-navy-light)',  color: 'var(--c-navy)',       border: '#b8cde0' },
  3: { bg: 'var(--c-amber-light)', color: 'var(--c-amber)',      border: '#f5d28a' },
  4: { bg: 'var(--c-surface-2)',   color: 'var(--c-text-muted)', border: 'var(--c-border)' },
}

export default function DashSection({
  title,
  subtitle,
  items = [],
  emptyPhase = 2,
  emptyLabel,
  emptyDesc,
  layout = 'stack',   // 'stack' | 'grid'
  compact = false,
  showCategory = false,
  children,           // override slot for non-standard content
}) {
  const ph = PHASE_STYLE[emptyPhase] || PHASE_STYLE[2]

  return (
    <section style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 10,
        paddingBottom: 7,
        borderBottom: '1px solid var(--c-border)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-secondary)',
          margin: 0,
        }}>
          {title}
        </h2>
        {subtitle && (
          <span style={{ fontSize: 11.5, color: 'var(--c-text-muted)' }}>{subtitle}</span>
        )}
        {items.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: 'var(--c-text-muted)',
            letterSpacing: '0.06em',
          }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      {children ? children : items.length > 0 ? (
        <div style={layout === 'grid' ? {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 10,
        } : {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {items.map(item => (
            <FeedCard
              key={item.id}
              item={item}
              compact={compact}
              showCategory={showCategory}
            />
          ))}
        </div>
      ) : (
        // Empty state
        <div style={{
          background: ph.bg,
          border: `1px solid ${ph.border}`,
          borderRadius: 4,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: ph.color,
            background: ph.bg,
            border: `1px solid ${ph.border}`,
            borderRadius: 2,
            padding: '2px 7px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {emptyLabel || `Phase ${emptyPhase}`}
          </span>
          <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
            {emptyDesc || 'No data available yet.'}
          </span>
        </div>
      )}
    </section>
  )
}
