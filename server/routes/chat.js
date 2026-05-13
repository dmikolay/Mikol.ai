'use strict'
const express = require('express')
const http    = require('http')
const https   = require('https')
const { v4: uuidv4 } = require('../lib/uuid')

const router = express.Router()

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL   || 'llama3.1'

const SYSTEM_PROMPT = `You are Mikol.ai, an intelligent assistant for a professional tracking AI research, venture capital, and startup activity.
You have access to a live feed of news, funding rounds, and research papers.
Be concise and direct. Use specific names, numbers, and dates when available.
When you don't know something, say so clearly rather than speculating.`

// POST /api/chat — proxy to Ollama, stream NDJSON tokens back
router.post('/', (req, res) => {
  const { messages = [], sessionId } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const sid = sessionId || uuidv4()

  // Build Ollama chat payload
  const payload = JSON.stringify({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
  })

  const ollamaUrl = new URL('/api/chat', OLLAMA_BASE)
  const transport = ollamaUrl.protocol === 'https:' ? https : http

  const ollamaReq = transport.request(
    {
      hostname: ollamaUrl.hostname,
      port:     ollamaUrl.port || (ollamaUrl.protocol === 'https:' ? 443 : 80),
      path:     ollamaUrl.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (ollamaRes) => {
      if (ollamaRes.statusCode !== 200) {
        let body = ''
        ollamaRes.on('data', (d) => { body += d })
        ollamaRes.on('end', () => {
          res.status(502).send(`Ollama error ${ollamaRes.statusCode}: ${body}`)
        })
        return
      }

      res.setHeader('Content-Type', 'application/x-ndjson')
      res.setHeader('X-Session-Id', sid)
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Transfer-Encoding', 'chunked')

      let buf = ''
      ollamaRes.on('data', (chunk) => {
        buf += chunk.toString()
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line)
            const token = obj?.message?.content ?? ''
            if (token) res.write(JSON.stringify({ token }) + '\n')
            if (obj.done) res.end()
          } catch { /* skip malformed */ }
        }
      })
      ollamaRes.on('end', () => res.end())
      ollamaRes.on('error', (e) => {
        console.error('[chat] Ollama stream error:', e.message)
        res.end()
      })
    }
  )

  ollamaReq.on('error', (e) => {
    console.error('[chat] Ollama connection error:', e.message)
    if (!res.headersSent) {
      res.status(503).send(`Cannot reach Ollama at ${OLLAMA_BASE} — is it running?`)
    }
  })

  ollamaReq.write(payload)
  ollamaReq.end()
})

// GET /api/chat/sessions — stub for Phase 1
router.get('/sessions', (_req, res) => res.json([]))

module.exports = router
