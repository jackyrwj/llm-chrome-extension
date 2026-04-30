const OverviewTab = {
  rendered: false,

  async render(container, modelInfo) {
    if (!modelInfo) {
      container.innerHTML = `<div class="hf-assistant-card">${t('errorNoModelInfo')}</div>`;
      return;
    }

    const isFav = await Storage.isFavorite(modelInfo.modelId);
    const favorites = await Storage.getFavorites();

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

    // Favorites list
    if (favorites.length > 0) {
      html += `
        <div class="hf-assistant-card">
          <div class="hf-assistant-card-title">⭐ 收藏模型 (${favorites.length})</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${favorites.slice(0, 5).map(f => `
              <a href="https://huggingface.co/${f.modelId}" target="_blank" class="hf-assistant-link"
                 style="font-size: 11px; padding: 4px 0; display: flex; justify-content: space-between;"
                 title="${f.modelId}">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.modelId}</span>
                ${f.modelscopeUrl ? '<span style="color: #10b981; font-size: 10px;">魔搭</span>' : ''}
              </a>
            `).join('')}
            ${favorites.length > 5 ? `<div style="color: #6b7280; font-size: 10px; text-align: center;">还有 ${favorites.length - 5} 个...</div>` : ''}
          </div>
        </div>
      `;
    }

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

    // Try multiple search keywords for better matching
    const searchKeywords = this.buildSearchKeywords(modelInfo);
    let bestMatch = null;
    let bestScore = 0;

    for (const keyword of searchKeywords) {
      try {
        const settings = await Storage.getAll();
        const apiResult = await API.searchModelScope(keyword, settings.modelscopeApiEndpoint);

        if (apiResult.error || !apiResult.data) continue;

        const results = apiResult.data.data || apiResult.data.results || [];

        for (const result of results) {
          const score = API.calculateMatchScore(modelInfo.modelId, result);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = result;
          }
        }

        // If we found a good match, stop searching
        if (bestScore > 0.8) break;
      } catch (e) {
        console.log('API search failed for keyword:', keyword, e.message);
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

  // Build multiple search keywords from model info for better matching
  buildSearchKeywords(modelInfo) {
    const keywords = [];
    const modelId = modelInfo.modelId;

    // Full model ID
    keywords.push(modelId);

    // Without author prefix
    if (modelId.includes('/')) {
      keywords.push(modelId.split('/')[1]);
    }

    // Without -hf suffix
    const noHf = modelId.replace(/-hf$/i, '');
    if (noHf !== modelId) {
      keywords.push(noHf);
      if (noHf.includes('/')) {
        keywords.push(noHf.split('/')[1]);
      }
    }

    // Core model name (remove common suffixes)
    let coreName = modelInfo.repoName || (modelId.includes('/') ? modelId.split('/')[1] : modelId);
    coreName = coreName
      .replace(/-hf$/i, '')
      .replace(/-instruct$/i, '')
      .replace(/-chat$/i, '')
      .replace(/-base$/i, '');
    keywords.push(coreName);

    return [...new Set(keywords)];
  },

  showMappingResult(statusEl, url, found) {
    if (found && url) {
      statusEl.innerHTML = `
        <div style="color: #16a34a; margin-bottom: 8px;">${t('modelscopeFound')}</div>
        <a href="${url}" target="_blank" class="hf-assistant-link" style="word-break: break-all;">${url}</a>
      `;
    } else {
      // Use just the repo name (without author) for better search results
      const searchTerm = this.modelInfo?.repoName || this.modelInfo?.modelId?.split('/')?.[1] || '';
      const searchUrl = `https://www.modelscope.cn/search?search=${encodeURIComponent(searchTerm)}`;
      statusEl.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 8px;">${t('modelscopeNotFound')}</div>
        <a href="${searchUrl}" target="_blank" class="hf-assistant-link">${t('gotoSearch')} (${searchTerm})</a>
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
