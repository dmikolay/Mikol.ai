// xAI Grok API integration
// Used for: real-time X/Twitter data — people monitoring, keyword search
// Requires: XAI_API_KEY in .env
// Key accounts: @sama, @DarioAmodei, @karpathy, @pmarca, @saranormous, etc.
// Signal keywords: "excited to announce", "stealth", "just raised", "new chapter"
// TODO: implement in Phase 3

module.exports = {
  searchPosts:    async (_query)  => { throw new Error('not implemented') },
  getUserPosts:   async (_handle) => { throw new Error('not implemented') },
  monitorSignals: async ()        => { throw new Error('not implemented') },
}
