const OverviewTab = {
  rendered: false,

  async render(container, modelInfo) {
    if (!modelInfo) {
      container.innerHTML = `<div class="hf-assistant-card">${t('errorNoModelInfo')}</div>`;
      return;
    }

    const isFav = await Storage.isFavorite(modelInfo.modelId);

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${modelInfo.title || modelInfo.modelId}</div>
        <div style="margin-bottom: 4px; color: #6b7280; font-size: 11px;">
          ${modelInfo.author} / ${modelInfo.repoName}
        </div>
        ${modelInfo.parameterCount ? `<div style="margin-bottom: 4px;">📊 ${modelInfo.parameterCount}</div>` : ''}
        ${modelInfo.license ? `<div style="margin-bottom: 4px;">📄 ${modelInfo.license}</div>` : ''}
        ${modelInfo.downloads ? `<div style="margin-bottom: 4px;">⬇️ ${this.formatNumber(modelInfo.downloads)} downloads</div>` : ''}
        ${modelInfo.tags.length ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
          ${modelInfo.tags.slice(0, 8).map(tag => `<span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${tag}</span>`).join('')}
        </div>` : ''}
      </div>
    `;

    html += `<div class="hf-assistant-card" id="modelscope-card">
      <div class="hf-assistant-card-title">魔搭社区</div>
      <div id="modelscope-status">${t('loading')}</div>
    </div>`;

    container.innerHTML = html;
    this.rendered = true;

    this.fetchModelScopeMapping(modelInfo, container);
  },

  async fetchModelScopeMapping(modelInfo, container) {
    const statusEl = container.querySelector('#modelscope-status');

    const cached = await Storage.getMappingCache(modelInfo.modelId);
    if (cached) {
      this.showMappingResult(statusEl, cached.modelscopeUrl, true);
      modelInfo.modelscopeUrl = cached.modelscopeUrl;
      return;
    }

    try {
      const response = await fetch(chrome.runtime.getURL('src/data/mapping.json'));
      const mapping = await response.json();
      const localMatch = mapping[modelInfo.modelId];
      if (localMatch) {
        this.showMappingResult(statusEl, localMatch.modelscopeUrl, true);
        await Storage.setMappingCache(modelInfo.modelId, localMatch.modelscopeUrl);
        modelInfo.modelscopeUrl = localMatch.modelscopeUrl;
        return;
      }
    } catch (e) {
      console.log('Local mapping not found:', e.message);
    }

    const settings = await Storage.getAll();
    const apiResult = await API.searchModelScope(modelInfo.modelId, settings.modelscopeApiEndpoint);

    if (apiResult.error || !apiResult.data) {
      this.showMappingResult(statusEl, null, false);
      return;
    }

    const results = apiResult.data.data || apiResult.data.results || [];
    let bestMatch = null;
    let bestScore = 0;

    for (const result of results) {
      const score = API.calculateMatchScore(modelInfo.modelId, result);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    if (bestMatch && bestScore > 0.8) {
      const url = bestMatch.model_id ?
        `https://www.modelscope.cn/models/${bestMatch.model_id}` :
        bestMatch.url || '';
      this.showMappingResult(statusEl, url, true);
      await Storage.setMappingCache(modelInfo.modelId, url);
      modelInfo.modelscopeUrl = url;
    } else {
      this.showMappingResult(statusEl, null, false);
    }
  },

  showMappingResult(statusEl, url, found) {
    if (found && url) {
      statusEl.innerHTML = `
        <div style="color: #16a34a; margin-bottom: 8px;">${t('modelscopeFound')}</div>
        <a href="${url}" target="_blank" class="hf-assistant-link" style="word-break: break-all;">${url}</a>
      `;
    } else {
      const searchUrl = `https://www.modelscope.cn/search?search=${encodeURIComponent(this.modelInfo?.modelId || '')}`;
      statusEl.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 8px;">${t('modelscopeNotFound')}</div>
        <a href="${searchUrl}" target="_blank" class="hf-assistant-link">${t('gotoSearch')}</a>
      `;
    }
  },

  formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
  }
};
