// RAG-based chat handler
// Model: Ollama (local) — default llama3.1, configurable via OLLAMA_MODEL in .env
// Flow: embed query → retrieve top-10 items → build prompt with context → stream response
// Behavior: only answers from retrieved DB context; says so if no relevant data found
// Citations: response includes item IDs used as context
// Requires: Ollama running at OLLAMA_BASE_URL (default http://localhost:11434)
// TODO: implement in Phase 1

module.exports = {
  handleChat: async (_sessionId, _userMessage) => { throw new Error('not implemented') },
}
