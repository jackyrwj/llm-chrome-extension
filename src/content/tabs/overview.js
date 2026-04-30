const OverviewTab = {
  async render(container, modelInfo) {
    if (!modelInfo) {
      container.innerHTML = `<div class="hf-assistant-card">${t('errorNoModelInfo')}</div>`;
      return;
    }

    // VRAM estimate (FP16)
    let vramText = null;
    if (typeof estimateVRAM === 'function') {
      const est = estimateVRAM(modelInfo, { precision: 'fp16' });
      if (est.vramGB !== null) vramText = `${est.vramGB} GB`;
    }

    const specRows = [];

    if (modelInfo.parameterCount) {
      specRows.push(['📊 参数量', modelInfo.parameterCount]);
    }
    if (vramText) {
      specRows.push(['🎮 显存 (FP16)', vramText]);
    }
    if (modelInfo.contextLength) {
      specRows.push(['📐 上下文长度', modelInfo.contextLength]);
    }
    if (modelInfo.tensorTypes) {
      specRows.push(['🔢 精度', modelInfo.tensorTypes]);
    }
    if (modelInfo.taskType) {
      specRows.push(['🏷️ 任务类型', modelInfo.taskType]);
    }
    if (modelInfo.license) {
      specRows.push(['📄 许可证', modelInfo.license]);
    }
    if (modelInfo.updatedAt) {
      specRows.push(['🕐 更新时间', modelInfo.updatedAt]);
    }

    const specsHTML = specRows.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;">
          ${specRows.map(([label, val]) => `
            <tr>
              <td style="color:#6b7280;padding:3px 8px 3px 0;white-space:nowrap;vertical-align:top;">${label}</td>
              <td style="color:#1f2937;padding:3px 0;font-weight:500;">${this.esc(val)}</td>
            </tr>`).join('')}
         </table>`
      : '';

    // Framework / format tags (small pills)
    const tagPills = modelInfo.tags.slice(0, 6).map(tag =>
      `<span style="background:#e5e7eb;padding:2px 7px;border-radius:4px;font-size:10px;color:#374151;">${this.esc(tag)}</span>`
    ).join('');
    const tagsHTML = tagPills
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;">${tagPills}</div>`
      : '';

    // Social stats row
    const stats = [];
    if (modelInfo.likes)     stats.push(`❤️ ${modelInfo.likes}`);
    if (modelInfo.downloads) stats.push(`⬇️ ${this.formatNum(modelInfo.downloads)}/月`);
    const statsHTML = stats.length
      ? `<div style="font-size:11px;color:#6b7280;margin-top:6px;">${stats.join('  ·  ')}</div>`
      : '';

    const isModelScope = modelInfo.platform === 'modelscope';
    const mappingTitle = isModelScope ? 'Hugging Face' : '魔搭社区';

    container.innerHTML = `
      <div class="hf-assistant-card">
        <div style="font-weight:600;font-size:13px;word-break:break-all;color:#111827;">${this.esc(modelInfo.modelId)}</div>
        ${statsHTML}
        ${specsHTML}
        ${tagsHTML}
      </div>

      <div class="hf-assistant-card" id="mapping-card">
        <div class="hf-assistant-card-title">${mappingTitle}</div>
        <div id="mapping-status">加载中…</div>
      </div>
    `;

    if (isModelScope) {
      this.fetchHFMapping(modelInfo, container);
    } else {
      this.fetchModelScopeMapping(modelInfo, container);
    }
  },

  esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  },

  formatNum(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
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
    } catch (e) { /* no local match */ }

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
          if (score > bestScore) { bestScore = score; bestMatch = result; }
        }
        if (bestScore > 0.5) break;
      } catch (e) { /* skip */ }
    }

    if (bestMatch && bestScore > 0.5) {
      const url = bestMatch.model_id
        ? `https://www.modelscope.cn/models/${bestMatch.model_id}`
        : bestMatch.url || '';
      this.showMappingResult(statusEl, url, true, 'modelscope');
      await Storage.setMappingCache(modelInfo.modelId, url);
      modelInfo.modelscopeUrl = url;
    } else {
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
    } catch (e) { /* skip */ }

    const fallbackUrl = `https://huggingface.co/${modelInfo.modelId}`;
    this.showMappingResult(statusEl, fallbackUrl, true, 'hf');
    modelInfo.hfUrl = fallbackUrl;
  },

  buildSearchKeywords(modelInfo) {
    const keywords = [modelInfo.modelId];
    if (modelInfo.modelId.includes('/')) keywords.push(modelInfo.modelId.split('/')[1]);
    const noHf = modelInfo.modelId.replace(/-hf$/i, '');
    if (noHf !== modelInfo.modelId) {
      keywords.push(noHf);
      if (noHf.includes('/')) keywords.push(noHf.split('/')[1]);
    }
    let core = modelInfo.repoName || (modelInfo.modelId.includes('/') ? modelInfo.modelId.split('/')[1] : modelInfo.modelId);
    core = core.replace(/-hf|-instruct|-chat|-base$/i, '');
    keywords.push(core);
    return [...new Set(keywords)];
  },

  buildFallbackUrl(modelInfo) {
    if (!modelInfo?.modelId) return null;
    const [author, repo] = modelInfo.modelId.split('/');
    if (!repo) return null;
    const namespaceMap = {
      'qwen': 'qwen', 'deepseek-ai': 'deepseek-ai', 'baichuan-inc': 'baichuan-inc',
      '01-ai': '01-ai', 'internlm': 'internlm', 'zhipuai': 'ZhipuAI',
      'openbmb': 'OpenBMB', 'baai': 'BAAI',
      'meta-llama': 'LLM-Research', 'microsoft': 'LLM-Research',
      'mistralai': 'AI-ModelScope', 'google': 'AI-ModelScope',
    };
    const ns = namespaceMap[author.toLowerCase()] || author;
    return `https://www.modelscope.cn/models/${ns}/${repo}`;
  },

  showMappingResult(statusEl, url, found, platform) {
    if (found && url) {
      const label = platform === 'hf' ? '✅ 已找到 Hugging Face 对应模型' : '✅ 已找到魔搭对应模型';
      statusEl.innerHTML = `
        <div style="color:#16a34a;margin-bottom:6px;font-size:11px;">${label}</div>
        <a href="${url}" target="_blank" class="hf-assistant-link" style="word-break:break-all;font-size:11px;">${url}</a>`;
    } else {
      const label = platform === 'hf' ? '❌ 未在 Hugging Face 找到对应模型' : '❌ 未在魔搭找到对应模型';
      const searchTerm = this.modelInfo?.repoName || this.modelInfo?.modelId?.split('/')?.[1] || '';
      const searchUrl = platform === 'hf'
        ? `https://huggingface.co/search/full-text?q=${encodeURIComponent(searchTerm)}`
        : `https://www.modelscope.cn/search?search=${encodeURIComponent(searchTerm)}`;
      statusEl.innerHTML = `
        <div style="color:#dc2626;margin-bottom:6px;font-size:11px;">${label}</div>
        <a href="${searchUrl}" target="_blank" class="hf-assistant-link" style="font-size:11px;">前往搜索 (${this.esc(searchTerm)})</a>`;
    }
  },
};
