import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/index.js'

export default function ChatPanel() {
  const toggleChat  = useChatStore((s) => s.toggleChat)
  const messages    = useChatStore((s) => s.messages)
  const streaming   = useChatStore((s) => s.streaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const clearMessages = useChatStore((s) => s.clearMessages)

  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    sendMessage(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  function handleInput(e) {
    setInput(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 100) + 'px'
    }
  }

  return (
    <aside className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        <span className="chat-panel__title">Ask Mikol.ai</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={clearMessages}
            title="Clear conversation"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-text-muted)', fontSize: 11,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
              padding: '2px 6px', borderRadius: 2,
            }}
          >
            CLEAR
          </button>
          <button className="chat-panel__close" onClick={toggleChat}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-panel__messages">
        {messages.length === 0 && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 11.5, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>
              Ask anything about AI, venture deals,<br />
              startups, or your collected intelligence.
            </p>
            <p style={{
              marginTop: 10, fontSize: 10.5,
              fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)',
              letterSpacing: '0.04em',
            }}>
              Powered by Ollama · llama3.1
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <span className="chat-msg__role">
              {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Mikol.ai' : 'System'}
            </span>
            <div className="chat-msg__bubble">
              {msg.content || (msg.role === 'assistant' && streaming && i === messages.length - 1
                ? <span style={{ color: 'var(--c-text-muted)' }}>…</span>
                : msg.content
              )}
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.role === 'assistant' &&
          messages[messages.length - 1].content === '' && (
          <div className="chat-msg assistant">
            <span className="chat-msg__role">Mikol.ai</span>
            <div className="chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="chat-panel__input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          rows={1}
          placeholder="Ask a question… (Enter to send)"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={streaming}
        />
        <button
          className="chat-send"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
        >
          SEND
        </button>
      </div>
    </aside>
  )
}
