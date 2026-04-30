const RecommendTab = {
  rendered: false,
  requestId: 0,
  CATEGORY_OPTIONS: [
    ['all', '全部'],
    ['chat-llm', '对话模型（Chat/LLM）'],
    ['embedding', '嵌入模型（Embedding）'],
    ['reranker', '重排序模型（Reranker）'],
    ['image-generation', '图像生成模型'],
    ['multimodal', '多模态模型（图文/视频）'],
    ['speech', '语音模型（ASR/TTS）'],
    ['other', '其他']
  ],

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;
    const settings = await Storage.getAll();

    if (!modelInfo) {
      container.innerHTML = `<div class="hf-assistant-card">${t('errorNoModelInfo')}</div>`;
      return;
    }

    const profile = this.buildModelProfile(modelInfo, settings.recommendTaskType);
    const currentParamsText = profile.paramsB ? `${profile.paramsB}B` : '未知规模';
    const familyText = profile.familyLabel || profile.primaryToken || modelInfo.author || '当前模型';
    const currentCategory = settings.recommendTaskType || profile.category || 'all';

    container.innerHTML = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">推荐策略</div>
        <div style="font-size: 12px; color: #374151; line-height: 1.7;">
          <div><strong>当前模型：</strong>${this.escapeHtml(modelInfo.modelId)}</div>
          <div><strong>模型家族：</strong>${this.escapeHtml(familyText)}</div>
          <div><strong>当前规模：</strong>${this.escapeHtml(currentParamsText)}</div>
          <div><strong>模型类别：</strong>${this.escapeHtml(this.getCategoryLabel(profile.category))}</div>
          <div><strong>推荐筛选：</strong>${this.escapeHtml(this.getCategoryLabel(currentCategory))}</div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
          <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;">显存 ${settings.vramGB} GB</span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;">GPU x${settings.gpuCount}</span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;">精度 ${settings.recommendPrecision.toUpperCase()}</span>
        </div>
        <div style="margin-top: 10px;">
          <label style="font-size: 11px; color: #6b7280; margin-bottom: 4px; display: block;">模型类别</label>
          <select class="hf-assistant-select" id="recommend-task-type" style="margin-bottom: 0;">
            ${this.renderCategoryOptions(currentCategory)}
          </select>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: #6b7280; line-height: 1.6;">
          先把 Hugging Face 的原始任务与标签归并成业务类别，再从同作者和同家族中找同类模型，最后按你的显存分组推荐。
        </div>
      </div>

      <div id="recommend-results">
        <div class="hf-assistant-card">
          <div style="color: #6b7280; font-size: 12px; text-align: center; padding: 20px 0;">正在分析当前模型家族...</div>
        </div>
      </div>
    `;

    this.rendered = true;

    container.querySelector('#recommend-task-type').addEventListener('change', async (e) => {
      await Storage.set('recommendTaskType', e.target.value);
      this.doRecommend(container);
    });

    this.doRecommend(container);
  },

  async doRecommend(container) {
    if (!this.modelInfo) return;

    const currentRequestId = ++this.requestId;
    const settings = await Storage.getAll();
    const profile = this.buildModelProfile(this.modelInfo, settings.recommendTaskType);
    const resultsEl = container.querySelector('#recommend-results');
    resultsEl.innerHTML = '<div class="hf-assistant-card"><div style="color: #6b7280; font-size: 12px; text-align: center; padding: 20px 0;">正在查找同家族和同类模型...</div></div>';

    const candidateModels = await this.fetchCandidateModels(profile, settings);
    if (currentRequestId !== this.requestId) return;

    if (!candidateModels.length) {
      resultsEl.innerHTML = '<div class="hf-assistant-card"><div style="color: #6b7280; font-size: 12px;">没有找到可用候选，可以换一个类别再试试。</div></div>';
      return;
    }

    const scored = candidateModels
      .map(model => this.scoreCandidate(model, profile, settings))
      .filter(Boolean);

    if (!scored.length) {
      resultsEl.innerHTML = '<div class="hf-assistant-card"><div style="color: #6b7280; font-size: 12px;">找到了一些候选，但它们不够像当前模型，或者缺少规模信息，暂时没法给出可靠推荐。</div></div>';
      return;
    }

    const groups = this.groupCandidates(scored, profile);
    resultsEl.innerHTML = this.renderGroups(groups, profile);
  },

  async fetchCandidateModels(profile, settings) {
    const category = settings.recommendTaskType || profile.category || 'all';
    const pipelineFilter = this.getPrimaryPipelineForCategory(category);
    const requests = [];
    const seenKeys = new Set();

    const addRequest = (filters) => {
      const key = JSON.stringify(filters);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        requests.push(filters);
      }
    };

    addRequest({ author: this.modelInfo.author, pipeline_tag: pipelineFilter, limit: 40 });
    addRequest({ author: this.modelInfo.author, limit: 40 });

    if (profile.primaryToken) {
      addRequest({ search: profile.primaryToken, pipeline_tag: pipelineFilter, limit: 40 });
      addRequest({ search: profile.primaryToken, limit: 40 });
    }

    if (profile.secondaryToken && profile.secondaryToken !== profile.primaryToken) {
      addRequest({ search: profile.secondaryToken, pipeline_tag: pipelineFilter, limit: 30 });
    }

    const results = await Promise.all(requests.map(filters => API.fetchHFModels(filters)));
    const map = new Map();

    for (const result of results) {
      if (!result || result.error || !Array.isArray(result.models)) continue;
      for (const model of result.models) {
        if (!model || !model.id || model.id === this.modelInfo.modelId) continue;
        if (!map.has(model.id)) {
          map.set(model.id, model);
        }
      }
    }

    return Array.from(map.values());
  },

  buildModelProfile(modelInfo, preferredCategory) {
    const params = inferParameterCount(modelInfo);
    const paramsB = params ? Math.round(params / 1e8) / 10 : null;
    const title = (modelInfo.title || '').toLowerCase();
    const repo = (modelInfo.repoName || '').toLowerCase();
    const tags = Array.isArray(modelInfo.tags) ? modelInfo.tags.map(t => String(t).toLowerCase()) : [];
    const pipelineTag = this.detectPipelineTag(modelInfo);
    const category = preferredCategory && preferredCategory !== 'all'
      ? preferredCategory
      : this.detectModelCategory(modelInfo, pipelineTag);

    const informativeTokens = this.extractInformativeTokens([
      repo,
      title,
      modelInfo.modelId || '',
      ...tags
    ]);

    return {
      params,
      paramsB,
      pipelineTag,
      category,
      primaryToken: informativeTokens[0] || '',
      secondaryToken: informativeTokens[1] || '',
      familyLabel: this.formatFamilyLabel(informativeTokens[0] || repo || title),
      tokens: informativeTokens,
      author: modelInfo.author || ''
    };
  },

  detectPipelineTag(modelInfo) {
    const tags = Array.isArray(modelInfo.tags) ? modelInfo.tags : [];
    const pipelineCandidates = [
      'text-generation',
      'image-text-to-text',
      'feature-extraction',
      'fill-mask',
      'sentence-similarity',
      'text-classification',
      'text-ranking',
      'text-to-image',
      'image-to-image',
      'automatic-speech-recognition',
      'text-to-speech',
      'audio-classification',
      'text-to-audio',
      'visual-question-answering',
      'document-question-answering',
      'video-text-to-text'
    ];

    const matched = tags.find(tag => pipelineCandidates.includes(tag));
    return matched || 'all';
  },

  detectModelCategory(modelInfo, pipelineTag) {
    const id = (modelInfo.modelId || '').toLowerCase();
    const title = (modelInfo.title || '').toLowerCase();
    const tags = Array.isArray(modelInfo.tags) ? modelInfo.tags.map(t => String(t).toLowerCase()) : [];
    const haystack = [id, title, ...tags, pipelineTag || ''].join(' ');

    if (
      pipelineTag === 'text-ranking' ||
      tags.includes('text-ranking') ||
      haystack.includes('reranker') ||
      haystack.includes('bge-reranker')
    ) {
      return 'reranker';
    }

    if (
      pipelineTag === 'feature-extraction' ||
      pipelineTag === 'sentence-similarity' ||
      tags.includes('sentence-transformers') ||
      haystack.includes('embedding') ||
      haystack.includes('embed')
    ) {
      return 'embedding';
    }

    if (
      pipelineTag === 'text-to-image' ||
      pipelineTag === 'image-to-image' ||
      pipelineTag === 'unconditional-image-generation'
    ) {
      return 'image-generation';
    }

    if (
      pipelineTag === 'image-text-to-text' ||
      pipelineTag === 'visual-question-answering' ||
      pipelineTag === 'document-question-answering' ||
      pipelineTag === 'video-text-to-text' ||
      tags.includes('vision') ||
      haystack.includes('multimodal') ||
      /(^|[^a-z])vl([^a-z]|$)/.test(haystack)
    ) {
      return 'multimodal';
    }

    if (
      pipelineTag === 'automatic-speech-recognition' ||
      pipelineTag === 'text-to-speech' ||
      pipelineTag === 'audio-to-audio' ||
      pipelineTag === 'audio-classification' ||
      pipelineTag === 'text-to-audio' ||
      haystack.includes('asr') ||
      haystack.includes('tts') ||
      haystack.includes('whisper')
    ) {
      return 'speech';
    }

    if (
      pipelineTag === 'text-generation' ||
      pipelineTag === 'conversational' ||
      haystack.includes('chat') ||
      haystack.includes('instruct') ||
      haystack.includes('assistant')
    ) {
      return 'chat-llm';
    }

    return 'other';
  },

  extractInformativeTokens(parts) {
    const generic = new Set([
      'instruct', 'chat', 'base', 'hf', 'gguf', 'awq', 'gptq', 'int4', 'int8', 'fp16',
      'preview', 'mini', 'small', 'medium', 'large', 'xl', 'it', 'sft', 'rlhf', 'ft',
      'model', 'models', 'text', 'vision', 'vlm', 'v1', 'v2', 'v3', 'latest'
    ]);
    const familyMatchers = [
      /qwen[\d\.]*(?:-vl)?/,
      /llama[\d\.\-]*/,
      /gemma[\d\.\-]*/,
      /mistral[\d\.\-]*/,
      /mixtral[\d\.\-]*/,
      /deepseek[\w\.\-]*/,
      /yi[\d\.\-]*/,
      /glm[\d\.\-]*/,
      /internlm[\d\.\-]*/,
      /phi[\d\.\-]*/,
      /olmo[\d\.\-]*/,
      /command[\w\.\-]*/,
      /baichuan[\d\.\-]*/
    ];

    const tokens = [];
    for (const part of parts) {
      for (const matcher of familyMatchers) {
        const match = String(part).match(matcher);
        if (match) tokens.push(match[0]);
      }

      String(part)
        .toLowerCase()
        .split(/[^a-z0-9\.]+/)
        .filter(Boolean)
        .forEach(token => {
          if (token.length < 3) return;
          if (/^\d+(\.\d+)?b$/.test(token)) return;
          if (generic.has(token)) return;
          tokens.push(token);
        });
    }

    return [...new Set(tokens)];
  },

  scoreCandidate(model, profile, settings) {
    const id = model.id || '';
    const pipelineTag = model.pipeline_tag || '';
    const tags = Array.isArray(model.tags) ? model.tags : [];
    const params = inferParameterCount({
      modelId: id,
      parameterCount: this.findParameterCount(tags, id),
      tags
    });
    if (!params) return null;

    const paramsB = Math.round(params / 1e8) / 10;
    const candidateTokens = this.extractInformativeTokens([id, ...tags]);
    const familyOverlap = candidateTokens.filter(token => profile.tokens.includes(token)).length;
    const authorMatch = this.modelInfo.author && id.startsWith(`${this.modelInfo.author}/`);
    const candidateCategory = this.detectModelCategory({
      modelId: id,
      title: id,
      tags
    }, pipelineTag);
    const categoryMatch = profile.category === 'all' || !profile.category || candidateCategory === profile.category;
    const estimate = estimateVRAM({
      modelId: id,
      parameterCount: `${paramsB}B`
    }, {
      precision: settings.recommendPrecision || 'fp16',
      userVramGB: (settings.vramGB || 24) * (settings.gpuCount || 1)
    });

    if (!authorMatch && familyOverlap === 0) return null;
    if (!categoryMatch && profile.category !== 'all') return null;

    const sizeDelta = profile.params ? ((params - profile.params) / profile.params) : 0;
    const closeness = profile.params ? Math.max(0, 1 - Math.min(Math.abs(sizeDelta), 1.5)) : 0.4;
    const compatibilityScore = estimate.status === 'ok' ? 1 : estimate.status === 'warning' ? 0.55 : 0.1;
    const downloadScore = Math.min(Math.log10((model.downloads || 0) + 10) / 6, 1);
    const familyScore = Math.min(familyOverlap / Math.max(profile.tokens.length || 1, 1), 1);
    const totalScore = (
      familyScore * 0.32 +
      (authorMatch ? 0.22 : 0) +
      closeness * 0.2 +
      compatibilityScore * 0.14 +
      (categoryMatch ? 0.07 : 0) +
      downloadScore * 0.05
    );

    return {
      id,
      pipelineTag,
      downloads: model.downloads || 0,
      paramsB,
      parameterCount: `${paramsB}B`,
      estimate,
      status: estimate.status,
      category: candidateCategory,
      familyScore,
      authorMatch,
      categoryMatch,
      sizeDelta,
      score: totalScore,
      reason: this.buildReason({
        authorMatch,
        familyOverlap,
        categoryMatch,
        candidateCategory,
        sizeDelta,
        paramsB,
        profile,
        estimate,
        precision: settings.recommendPrecision || 'fp16'
      })
    };
  },

  buildReason(context) {
    const reasonBits = [];
    if (context.authorMatch) reasonBits.push('同作者');
    if (context.familyOverlap > 0) reasonBits.push('同家族');
    if (context.categoryMatch) reasonBits.push(`同类：${this.getCategoryLabel(context.candidateCategory)}`);

    if (context.profile.paramsB && context.sizeDelta <= -0.2) {
      reasonBits.push(`比当前 ${context.profile.paramsB}B 更小`);
    } else if (context.profile.paramsB && context.sizeDelta >= 0.25) {
      reasonBits.push(`比当前 ${context.profile.paramsB}B 更强`);
    } else if (context.profile.paramsB) {
      reasonBits.push(`和当前 ${context.profile.paramsB}B 同级`);
    }

    const ability = context.estimate.status === 'ok'
      ? `按 ${context.precision.toUpperCase()} 估算约 ${context.estimate.vramGB} GB，您的机器可稳妥运行`
      : context.estimate.status === 'warning'
        ? `按 ${context.precision.toUpperCase()} 估算约 ${context.estimate.vramGB} GB，能跑但比较吃紧`
        : `按 ${context.precision.toUpperCase()} 估算约 ${context.estimate.vramGB} GB，显存压力较大`;

    return `${reasonBits.join(' · ')}。${ability}。`;
  },

  groupCandidates(candidates, profile) {
    const groups = {
      smaller: [],
      similar: [],
      stronger: []
    };

    for (const candidate of candidates.sort((a, b) => b.score - a.score || b.downloads - a.downloads)) {
      if (profile.paramsB && candidate.paramsB <= profile.paramsB * 0.8) {
        if (groups.smaller.length < 4) groups.smaller.push(candidate);
        continue;
      }
      if (profile.paramsB && candidate.paramsB >= profile.paramsB * 1.25) {
        if (groups.stronger.length < 4) groups.stronger.push(candidate);
        continue;
      }
      if (groups.similar.length < 5) groups.similar.push(candidate);
    }

    return [
      {
        key: 'smaller',
        title: '更小更稳',
        description: '更适合先跑通、压低显存占用或提高上下文余量。',
        items: groups.smaller
      },
      {
        key: 'similar',
        title: '同级替代',
        description: '同一档位里更接近当前模型的替代选择。',
        items: groups.similar
      },
      {
        key: 'stronger',
        title: '更强进阶',
        description: '参数更大，能力上限更高，但更吃显存。',
        items: groups.stronger
      }
    ].filter(group => group.items.length > 0);
  },

  renderGroups(groups) {
    if (!groups.length) {
      return '<div class="hf-assistant-card"><div style="color: #6b7280; font-size: 12px;">没找到足够可信的同家族同类候选模型。</div></div>';
    }

    return groups.map(group => `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${group.title}</div>
        <div style="font-size: 11px; color: #6b7280; margin-bottom: 10px; line-height: 1.6;">${group.description}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${group.items.map(item => this.renderCandidate(item)).join('')}
        </div>
      </div>
    `).join('');
  },

  renderCandidate(item) {
    const statusColor = item.status === 'ok' ? '#16a34a' : item.status === 'warning' ? '#ca8a04' : '#dc2626';
    const statusBg = item.status === 'ok' ? '#dcfce7' : item.status === 'warning' ? '#fef9c3' : '#fee2e2';
    const statusText = item.status === 'ok' ? '✅ 稳妥' : item.status === 'warning' ? '⚠️ 较紧' : '❌ 吃显存';

    return `
      <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; gap: 8px; align-items: flex-start;">
          <a href="https://huggingface.co/${item.id}" target="_blank"
             class="hf-assistant-link" style="font-size: 12px; font-weight: 600; word-break: break-all; flex: 1;">
            ${this.escapeHtml(item.id)}
          </a>
          <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; white-space: nowrap;">
            ${statusText}
          </span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 6px;">
          <span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 999px; font-size: 10px;">📊 ${item.parameterCount}</span>
          <span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 999px; font-size: 10px;">🏷️ ${this.escapeHtml(this.getCategoryLabel(item.category))}</span>
          ${item.downloads ? `<span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 999px; font-size: 10px;">⬇️ ${this.formatDownloads(item.downloads)}</span>` : ''}
        </div>
        <div style="font-size: 11px; color: #4b5563; background: #f9fafb; border-radius: 6px; padding: 8px; line-height: 1.6;">
          ${this.escapeHtml(item.reason)}
        </div>
      </div>
    `;
  },

  findParameterCount(tags, id) {
    for (const tag of tags) {
      const match = String(tag).match(/(\d+\.?\d*)\s*[Bb]/);
      if (match) return `${match[1]}B`;
    }
    const idMatch = String(id).match(/(\d+\.?\d*)\s*[Bb]/i);
    return idMatch ? `${idMatch[1]}B` : null;
  },

  renderCategoryOptions(selectedCategory) {
    const current = selectedCategory || 'all';
    return this.CATEGORY_OPTIONS.map(([value, label]) => `
      <option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>
    `).join('');
  },

  getCategoryLabel(category) {
    return Object.fromEntries(this.CATEGORY_OPTIONS)[category || 'all'] || '全部';
  },

  getPrimaryPipelineForCategory(category) {
    const map = {
      all: 'all',
      'chat-llm': 'text-generation',
      embedding: 'feature-extraction',
      reranker: 'text-ranking',
      'image-generation': 'text-to-image',
      multimodal: 'image-text-to-text',
      speech: 'automatic-speech-recognition',
      other: 'all'
    };
    return map[category || 'all'] || 'all';
  },

  formatFamilyLabel(token) {
    if (!token) return '';
    return token
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  },

  formatDownloads(num) {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
  },

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
