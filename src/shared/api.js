const API = {
  // HF 模型全部硬数据一次取回：config、文件列表（含大小）、safetensors 统计、
  // 下载量/点赞/标签/许可证/更新时间。blobs=true 让 siblings 带上文件大小。
  async fetchModelData(modelId) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return await chrome.runtime.sendMessage({ action: 'fetchModelData', modelId });
      }
      const res = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}?blobs=true`);
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return { data: await res.json() };
    } catch (e) {
      return { error: e.message };
    }
  },

  // ModelScope 模型信息（best-effort，字段缺失时由调用方降级）
  async fetchMsModelData(modelId) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return await chrome.runtime.sendMessage({ action: 'fetchMsModelData', modelId });
      }
      return { error: 'direct fetch unsupported' };
    } catch (e) {
      return { error: e.message };
    }
  },

  // mapping.json 精确查表（含反向），在 background 中读取打包资源
  async lookupMapping(modelId, direction) {
    try {
      return await chrome.runtime.sendMessage({ action: 'lookupMapping', modelId, direction });
    } catch (e) {
      return { error: e.message };
    }
  },

  async searchModelScope(modelId) {
    try {
      return await chrome.runtime.sendMessage({ action: 'searchModelScope', modelId });
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
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API };
}
