import { create } from 'zustand'

export const useChatStore = create((set, get) => ({
  chatOpen: false,
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

  messages: [],
  sessionId: null,
  streaming: false,

  setSessionId: (id) => set({ sessionId: id }),
  clearMessages: () => set({ messages: [], sessionId: null }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  // Append text to the last assistant message (for streaming tokens)
  appendToLast: (text) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length === 0) return s
      const last = msgs[msgs.length - 1]
      if (last.role !== 'assistant') return s
      msgs[msgs.length - 1] = { ...last, content: last.content + text }
      return { messages: msgs }
    }),

  sendMessage: async (userText) => {
    const { messages, sessionId, addMessage, appendToLast } = get()
    if (!userText.trim()) return

    const userMsg = { role: 'user', content: userText.trim() }
    addMessage(userMsg)
    set({ streaming: true })

    // Placeholder for the assistant's streamed reply
    addMessage({ role: 'assistant', content: '' })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `HTTP ${res.status}`)
      }

      // Save session id from response header if provided
      const sid = res.headers.get('X-Session-Id')
      if (sid) set({ sessionId: sid })

      // Stream NDJSON tokens
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() // keep incomplete line
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line)
            if (chunk.token) appendToLast(chunk.token)
          } catch { /* ignore malformed chunks */ }
        }
      }
    } catch (err) {
      // Replace empty placeholder with error message
      set((s) => {
        const msgs = [...s.messages]
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          msgs[msgs.length - 1] = {
            role: 'system',
            content: `Error: ${err.message}`,
          }
        }
        return { messages: msgs }
      })
    } finally {
      set({ streaming: false })
    }
  },
}))

export const useFeedStore = create((set) => ({
  items: [],
  loading: false,
  error: null,
  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))

export const useDealsStore = create((set) => ({
  deals: [],
  loading: false,
  setDeals: (deals) => set({ deals }),
  setLoading: (loading) => set({ loading }),
}))

export const useStartupsStore = create((set) => ({
  startups: [],
  loading: false,
  setStartups: (startups) => set({ startups }),
  setLoading: (loading) => set({ loading }),
}))

export const usePeopleStore = create((set) => ({
  people: [],
  loading: false,
  setPeople: (people) => set({ people }),
  setLoading: (loading) => set({ loading }),
}))
