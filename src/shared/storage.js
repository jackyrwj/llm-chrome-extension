const Storage = {
  DEFAULTS: {
    defaultTool: 'ollama',
    preferredMirror: 'hf-mirror',
    vramGB: 8,
    sidebarDefaultOpen: true,
    language: 'zh',
    translationProvider: 'none',
    translationApiKey: '',
    modelscopeApiEndpoint: 'https://www.modelscope.cn/api/v1/dolphin/models'
  },

  async get(key) {
    const result = await chrome.storage.sync.get(key);
    return result[key] !== undefined ? result[key] : this.DEFAULTS[key];
  },

  async getAll() {
    const result = await chrome.storage.sync.get(Object.keys(this.DEFAULTS));
    return { ...this.DEFAULTS, ...result };
  },

  async set(key, value) {
    await chrome.storage.sync.set({ [key]: value });
  },

  async setMultiple(obj) {
    await chrome.storage.sync.set(obj);
  },

  async getFavorites() {
    const result = await chrome.storage.sync.get('favorites');
    return result.favorites || [];
  },

  async addFavorite(modelId, modelscopeUrl) {
    const favorites = await this.getFavorites();
    if (!favorites.find(f => f.modelId === modelId)) {
      favorites.push({ modelId, modelscopeUrl, addedAt: Date.now() });
      await chrome.storage.sync.set({ favorites });
    }
  },

  async removeFavorite(modelId) {
    const favorites = (await this.getFavorites()).filter(f => f.modelId !== modelId);
    await chrome.storage.sync.set({ favorites });
  },

  async isFavorite(modelId) {
    const favorites = await this.getFavorites();
    return favorites.some(f => f.modelId === modelId);
  },

  async getCommandHistory() {
    const result = await chrome.storage.local.get('commandHistory');
    return result.commandHistory || [];
  },

  async addCommandHistory(tool, command, params) {
    const history = await this.getCommandHistory();
    history.unshift({ tool, command, params, timestamp: Date.now() });
    if (history.length > 20) history.pop();
    await chrome.storage.local.set({ commandHistory: history });
  },

  async getMappingCache(modelId) {
    const result = await chrome.storage.local.get('mappingCache');
    const cache = result.mappingCache || {};
    const entry = cache[modelId];
    if (entry && (Date.now() - entry.cachedAt) < 7 * 24 * 60 * 60 * 1000) {
      return entry;
    }
    return null;
  },

  async setMappingCache(modelId, modelscopeUrl) {
    const result = await chrome.storage.local.get('mappingCache');
    const cache = result.mappingCache || {};
    cache[modelId] = { modelscopeUrl, cachedAt: Date.now() };
    await chrome.storage.local.set({ mappingCache: cache });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Storage };
}
