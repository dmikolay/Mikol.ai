// Embedding pipeline for semantic search (RAG)
// Storage: sqlite-vec extension (vector column on items table)
// Model: all-MiniLM-L6-v2 via transformers.js (local, free, fast)
// TODO: implement in Phase 1 (basic) / Phase 4 (full semantic search)

module.exports = {
  embedText:   async (_text)  => { throw new Error('not implemented') },
  embedBatch:  async (_texts) => { throw new Error('not implemented') },
  searchSimilar: async (_queryEmbedding, _topK) => { throw new Error('not implemented') },
}
