const Storage = {
  async getMappingCache(modelId) {
    const result = await chrome.storage.local.get('mappingCache');
    const cache = result.mappingCache || {};
    const entry = cache[modelId];
    if (entry && (Date.now() - entry.cachedAt) < 7 * 24 * 60 * 60 * 1000) {
      return entry;
    }
    return null;
  },

  async setMappingCache(modelId, record) {
    const result = await chrome.storage.local.get('mappingCache');
    const cache = result.mappingCache || {};
    cache[modelId] = { ...record, cachedAt: Date.now() };
    await chrome.storage.local.set({ mappingCache: cache });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Storage };
}
