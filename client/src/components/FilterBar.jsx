export default function FilterBar({ filters = [], active, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {filters.map((f) => {
        const isActive = active === f.value
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            style={{
              padding: '3px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.06em',
              border: `1px solid ${isActive ? 'var(--c-navy)' : 'var(--c-border-2)'}`,
              borderRadius: 2,
              background: isActive ? 'var(--c-navy)' : 'var(--c-surface)',
              color: isActive ? '#ffffff' : 'var(--c-text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
