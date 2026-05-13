export default function StatusBar() {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="status-bar">
      <span className="status-bar__item">
        <span className="status-bar__dot green" />
        LIVE
      </span>
      <span className="status-bar__item">RSS ↻ every 3h</span>
      <span className="status-bar__item">SUMMARIZE ↻ every 15m</span>
      <span className="status-bar__item" style={{ marginLeft: 'auto' }}>
        {date} · {time}
      </span>
    </div>
  )
}
