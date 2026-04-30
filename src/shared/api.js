const API = {
  async fetchModelConfig(modelId) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({ action: 'fetchModelConfig', modelId });
      }
      const res = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}`);
      const data = await res.json();
      return { config: data.config || {} };
    } catch (e) {
      return { error: e.message };
    }
  },

  async fetchHFModels(filters = {}) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({ action: 'fetchHFModels', filters });
      }
      const params = new URLSearchParams({
        sort: 'downloads',
        direction: '-1',
        limit: String(filters.limit || 50)
      });
      if (filters.pipeline_tag && filters.pipeline_tag !== 'all') {
        params.set('filter', filters.pipeline_tag);
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.author) {
        params.set('author', filters.author);
      }
      const res = await fetch(`https://huggingface.co/api/models?${params}`);
      const data = await res.json();
      return { models: data };
    } catch (e) {
      return { error: e.message };
    }
  },

  async searchModelScope(modelId, endpoint) {
    const url = `${endpoint}?search=${encodeURIComponent(modelId)}`;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({
          action: 'searchModelScope',
          modelId,
          endpoint
        });
      }
      const response = await fetch(url, { timeout: 5000 });
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  },

  calculateMatchScore(hfModelId, msResult) {
    const hfLower = hfModelId.toLowerCase();
    const msName = (msResult.name || msResult.model_id || '').toLowerCase();
    const msId = (msResult.model_id || '').toLowerCase();

    let score = 0;

    if (msId === hfLower || msName === hfLower) {
      return 1.0;
    }

    if (msId.includes(hfLower) || hfLower.includes(msId)) {
      score += 0.5;
    }

    if (msName.includes(hfLower) || hfLower.includes(msName)) {
      score += 0.3;
    }

    const hfParts = hfLower.split(/[-_/]/).filter(p => p.length > 2);
    const msParts = msName.split(/[-_/]/).filter(p => p.length > 2);
    const commonParts = hfParts.filter(p => msParts.includes(p));
    score += (commonParts.length / Math.max(hfParts.length, 1)) * 0.3;

    return Math.min(score, 0.99);
  },

  async translate(text, provider, apiKey, targetLang = 'zh') {
    if (!text || !provider || provider === 'none') {
      return null;
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({
          action: 'translate',
          text,
          provider,
          apiKey,
          targetLang
        });
      }
    } catch (e) {
      return { error: e.message };
    }
  },

  async translateSegments(segments, provider, apiKey, targetLang = 'zh') {
    const results = [];
    for (const segment of segments) {
      if (segment.type === 'code') {
        results.push(segment);
      } else {
        const translated = await this.translate(segment.text, provider, apiKey, targetLang);
        results.push({
          type: 'text',
          text: segment.text,
          translated: translated && !translated.error ? translated.text : null,
          error: translated && translated.error ? translated.error : null
        });
      }
    }
    return results;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API };
}
