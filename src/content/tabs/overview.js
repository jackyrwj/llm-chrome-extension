const OverviewTab = {
  rendered: false,

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;
    if (!modelInfo) {
      container.innerHTML = `<div class="hf-assistant-card">${t('errorNoModelInfo')}</div>`;
      return;
    }

    // Build info badges
    const likeBadge = modelInfo.likes
      ? `<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;">❤️ ${modelInfo.likes}</span>`
      : '';
    const followBadge = modelInfo.followers
      ? `<span style="background: #dbeafe; color: #2563eb; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;">👥 ${modelInfo.followers}</span>`
      : '';

    // VRAM estimate for FP16
    let vramBadge = '';
    if (typeof estimateVRAM === 'function') {
      const est = estimateVRAM(modelInfo, { precision: 'fp16' });
      if (est.vramGB !== null) {
        const color = est.status === 'ok' ? '#16a34a' : est.status === 'warning' ? '#ca8a04' : '#dc2626';
        const bg = est.status === 'ok' ? '#dcfce7' : est.status === 'warning' ? '#fef9c3' : '#fee2e2';
        vramBadge = `<span style="background: ${bg}; color: ${color}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;">🎮 FP16 ≈ ${est.vramGB} GB</span>`;
      }
    }

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title" style="word-break: break-all;">${modelInfo.title || modelInfo.modelId}</div>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; align-items: flex-start;">
          ${likeBadge}
          ${followBadge}
          ${vramBadge}
          ${modelInfo.parameterCount ? `<span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;">📊 ${modelInfo.parameterCount}</span>` : ''}
          ${modelInfo.license ? `<span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;">📄 ${modelInfo.license}</span>` : ''}
          ${modelInfo.downloads ? `<span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500;">⬇️ ${this.formatNumber(modelInfo.downloads)}</span>` : ''}
        </div>
        ${modelInfo.tags.length ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
          ${modelInfo.tags.slice(0, 8).map(tag => `<span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${tag}</span>`).join('')}
        </div>` : ''}
      </div>
    `;

    // Description card
    if (modelInfo.description) {
      html += `
        <div class="hf-assistant-card">
          <div class="hf-assistant-card-title">简介</div>
          <div style="font-size: 11px; color: #4b5563; line-height: 1.5;">${modelInfo.description}</div>
        </div>
      `;
    }

    // Meta info card
    const metaItems = [];
    if (modelInfo.createdAt) metaItems.push(`<span style="color: #6b7280; font-size: 11px;">创建于 ${modelInfo.createdAt}</span>`);
    if (modelInfo.updatedAt) metaItems.push(`<span style="color: #6b7280; font-size: 11px;">更新于 ${modelInfo.updatedAt}</span>`);

    if (metaItems.length > 0) {
      html += `
        <div class="hf-assistant-card">
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            ${metaItems.join('')}
          </div>
        </div>
      `;
    }

    const isModelScope = modelInfo.platform === 'modelscope';
    const mappingTitle = isModelScope ? 'Hugging Face' : '魔搭社区';
    html += `<div class="hf-assistant-card" id="mapping-card">
      <div class="hf-assistant-card-title">${mappingTitle}</div>
      <div id="mapping-status">加载中...</div>
    </div>`;

    container.innerHTML = html;
    this.rendered = true;

    if (isModelScope) {
      this.fetchHFMapping(modelInfo, container);
    } else {
      this.fetchModelScopeMapping(modelInfo, container);
    }
  },

  async fetchModelScopeMapping(modelInfo, container) {
    const statusEl = container.querySelector('#mapping-status');

    const cached = await Storage.getMappingCache(modelInfo.modelId);
    if (cached) {
      this.showMappingResult(statusEl, cached.modelscopeUrl, true, 'modelscope');
      modelInfo.modelscopeUrl = cached.modelscopeUrl;
      return;
    }

    try {
      const response = await fetch(chrome.runtime.getURL('src/data/mapping.json'));
      const mapping = await response.json();
      const localMatch = mapping[modelInfo.modelId];
      if (localMatch) {
        this.showMappingResult(statusEl, localMatch.modelscopeUrl, true, 'modelscope');
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
        if (bestScore > 0.5) break;
      } catch (e) {
        console.log('API search failed for keyword:', keyword, e.message);
      }
    }

    if (bestMatch && bestScore > 0.5) {
      const url = bestMatch.model_id ?
        `https://www.modelscope.cn/models/${bestMatch.model_id}` :
        bestMatch.url || '';
      this.showMappingResult(statusEl, url, true, 'modelscope');
      await Storage.setMappingCache(modelInfo.modelId, url);
      modelInfo.modelscopeUrl = url;
    } else {
      // Fallback: try direct namespace/model_id URL construction
      const fallbackUrl = this.buildFallbackUrl(modelInfo);
      if (fallbackUrl) {
        this.showMappingResult(statusEl, fallbackUrl, true, 'modelscope');
        await Storage.setMappingCache(modelInfo.modelId, fallbackUrl);
        modelInfo.modelscopeUrl = fallbackUrl;
      } else {
        this.showMappingResult(statusEl, null, false, 'modelscope');
      }
    }
  },

  async fetchHFMapping(modelInfo, container) {
    const statusEl = container.querySelector('#mapping-status');

    // Try reverse lookup in mapping.json
    try {
      const response = await fetch(chrome.runtime.getURL('src/data/mapping.json'));
      const mapping = await response.json();
      for (const [hfId, entry] of Object.entries(mapping)) {
        if (entry.modelscope === modelInfo.modelId) {
          const url = `https://huggingface.co/${hfId}`;
          this.showMappingResult(statusEl, url, true, 'hf');
          modelInfo.hfUrl = url;
          return;
        }
      }
    } catch (e) {
      console.log('Reverse mapping not found:', e.message);
    }

    // Fallback: construct plausible HF URL
    const fallbackUrl = `https://huggingface.co/${modelInfo.modelId}`;
    this.showMappingResult(statusEl, fallbackUrl, true, 'hf');
    modelInfo.hfUrl = fallbackUrl;
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

  // Try to construct a plausible ModelScope URL from HF model info
  buildFallbackUrl(modelInfo) {
    if (!modelInfo || !modelInfo.modelId) return null;
    const modelId = modelInfo.modelId;
    const parts = modelId.split('/');
    if (parts.length !== 2) return null;
    const [author, repo] = parts;

    // Many Chinese-origin models have the same namespace on ModelScope
    const sameNamespaceAuthors = [
      'qwen', 'deepseek-ai', 'baichuan-inc', '01-ai', 'internlm',
      'ZhipuAI', 'OpenBMB', 'BAAI', 'Shanghai_AI_Laboratory'
    ];
    if (sameNamespaceAuthors.includes(author.toLowerCase())) {
      return `https://www.modelscope.cn/models/${author}/${repo}`;
    }

    // For some well-known authors, try common ModelScope namespaces
    const namespaceMap = {
      'meta-llama': 'LLM-Research',
      'microsoft': 'LLM-Research',
      'mistralai': 'AI-ModelScope',
      'google': 'AI-ModelScope',
      'bigscience': 'AI-ModelScope',
      'tiiuae': 'AI-ModelScope',
      'eleutherai': 'AI-ModelScope',
      'stabilityai': 'AI-ModelScope',
      'nousresearch': 'LLM-Research',
      'cohereforai': 'AI-ModelScope',
      'lmsys': 'AI-ModelScope',
      'mosaicml': 'AI-ModelScope',
      'adept': 'AI-ModelScope',
      'sentence-transformers': 'AI-ModelScope',
      'openai': 'AI-ModelScope',
      'hfl': 'AI-ModelScope',
      'wizardlm': 'AI-ModelScope',
      'salesforce': 'AI-ModelScope',
      'intfloat': 'AI-ModelScope'
    };
    const mappedNs = namespaceMap[author.toLowerCase()];
    if (mappedNs) {
      return `https://www.modelscope.cn/models/${mappedNs}/${repo}`;
    }

    return null;
  },

  showMappingResult(statusEl, url, found, platform) {
    if (found && url) {
      const foundText = platform === 'hf' ? '✅ 已找到 Hugging Face 对应模型' : '✅ 已找到魔搭对应模型';
      statusEl.innerHTML = `
        <div style="color: #16a34a; margin-bottom: 8px;">${foundText}</div>
        <a href="${url}" target="_blank" class="hf-assistant-link" style="word-break: break-all;">${url}</a>
      `;
    } else {
      const notFoundText = platform === 'hf' ? '❌ 未在 Hugging Face 找到对应模型' : '❌ 未在魔搭找到对应模型';
      const searchTerm = this.modelInfo?.repoName || this.modelInfo?.modelId?.split('/')?.[1] || '';
      const searchUrl = platform === 'hf'
        ? `https://huggingface.co/search/full-text?q=${encodeURIComponent(searchTerm)}`
        : `https://www.modelscope.cn/search?search=${encodeURIComponent(searchTerm)}`;
      const searchText = platform === 'hf' ? '前往搜索' : '前往搜索';
      statusEl.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 8px;">${notFoundText}</div>
        <a href="${searchUrl}" target="_blank" class="hf-assistant-link">${searchText} (${searchTerm})</a>
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
