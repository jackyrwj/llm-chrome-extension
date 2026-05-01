const Storage = {
  DEFAULTS: {
    defaultTool: 'ollama',
    preferredMirror: 'hf-mirror',
    vramGB: 64,
    gpuCount: 1,
    recommendTaskType: 'all',
    recommendPrecision: 'fp16',
    sidebarDefaultOpen: true,
    language: 'zh',
    translationProvider: 'google_free',
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
    return (result.favorites || []).map(f => this.normalizeFavoriteEntry(f)).filter(Boolean);
  },

  normalizeFavoriteEntry(entry) {
    if (!entry || !entry.modelId) return null;
    return {
      modelId: entry.modelId,
      modelscopeUrl: entry.modelscopeUrl || '',
      addedAt: entry.addedAt || Date.now(),
      isModelFavorite: !!entry.isModelFavorite,
      commands: Array.isArray(entry.commands) ? entry.commands : []
    };
  },

  async saveFavorites(favorites) {
    await chrome.storage.sync.set({
      favorites: favorites.filter(Boolean)
    });
  },

  async isCommandFavorited(modelId, tool, command) {
    const favorites = await this.getFavorites();
    const entry = favorites.find(f => f.modelId === modelId);
    if (!entry) return false;
    return entry.commands.some(c => c.tool === tool && c.command === command);
  },

  async addCommandFavorite(modelId, modelscopeUrl, tool, command, params) {
    const favorites = await this.getFavorites();
    let entry = favorites.find(f => f.modelId === modelId);
    if (!entry) {
      entry = {
        modelId,
        modelscopeUrl: modelscopeUrl || '',
        addedAt: Date.now(),
        commands: []
      };
      favorites.push(entry);
    }

    if (modelscopeUrl && !entry.modelscopeUrl) entry.modelscopeUrl = modelscopeUrl;

    const deduped = entry.commands.filter(c => !(c.tool === tool && c.command === command));
    deduped.unshift({
      tool,
      command,
      params: { ...params },
      addedAt: Date.now()
    });
    entry.commands = deduped.slice(0, 20);

    await this.saveFavorites(favorites);
  },

  async removeCommandFavorite(modelId, tool, command) {
    const favorites = await this.getFavorites();
    const next = favorites.flatMap(f => {
      if (f.modelId !== modelId) return [f];
      const commands = f.commands.filter(c => !(c.tool === tool && c.command === command));
      if (commands.length === 0 && !f.isModelFavorite) return [];
      return [{ ...f, commands }];
    });
    await this.saveFavorites(next);
  },

  async isModelFavorited(modelId) {
    const favorites = await this.getFavorites();
    const entry = favorites.find(f => f.modelId === modelId);
    return !!entry && !!entry.isModelFavorite;
  },

  async addModelFavorite(modelId, modelscopeUrl) {
    const favorites = await this.getFavorites();
    let entry = favorites.find(f => f.modelId === modelId);
    if (!entry) {
      entry = {
        modelId,
        modelscopeUrl: modelscopeUrl || '',
        addedAt: Date.now(),
        isModelFavorite: true,
        commands: []
      };
      favorites.push(entry);
    } else {
      entry.isModelFavorite = true;
      if (modelscopeUrl && !entry.modelscopeUrl) entry.modelscopeUrl = modelscopeUrl;
    }
    await this.saveFavorites(favorites);
  },

  async removeModelFavorite(modelId) {
    const favorites = await this.getFavorites();
    const next = favorites.flatMap(f => {
      if (f.modelId !== modelId) return [f];
      if (f.commands.length === 0) return [];
      return [{ ...f, isModelFavorite: false }];
    });
    await this.saveFavorites(next);
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
