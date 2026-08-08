// 嵌入模型页右侧栏顶部的卡片：信息 → 下载 → 部署，三区固定顺序。
// 硬数据原则：只渲染真实拿到的字段，拿不到就不渲染该行（docs/adr/0001）。
const Card = {
  host: null,
  shadow: null,
  state: { platform: null, modelId: null, tool: 'vllm', source: 'modelscope' },

  mount(anchor) {
    this.host = document.createElement('div');
    this.host.id = 'hfma-card-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    anchor.prepend(this.host);
    return this.host;
  },

  isMounted() {
    return !!this.host && this.host.isConnected;
  },

  unmount() {
    if (this.host) this.host.remove();
    this.host = null;
    this.shadow = null;
  },

  esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  },

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return null;
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  },

  formatNum(num) {
    if (num == null) return null;
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
  },

  formatParams(count) {
    if (!count) return null;
    return `${(count / 1e9).toFixed(1)}B`;
  },

  getStyles() {
    return `
      :host { all: initial; }
      .hfma-card {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px; line-height: 1.5; color: #1f2937;
        background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 12px; margin-bottom: 16px;
      }
      .hfma-title {
        font-weight: 600; font-size: 12px; color: #6b7280;
        text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
      }
      .hfma-section { border-top: 1px solid #f3f4f6; padding-top: 10px; margin-top: 10px; }
      .hfma-section:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
      .hfma-section-title {
        font-weight: 600; font-size: 11px; color: #374151; margin-bottom: 6px;
      }
      .hfma-row { display: flex; gap: 6px; padding: 1px 0; }
      .hfma-label { color: #6b7280; flex-shrink: 0; }
      .hfma-value { color: #111827; font-weight: 500; word-break: break-all; }
      .hfma-stats { color: #6b7280; font-size: 11px; }
      .hfma-badge-ok { color: #16a34a; font-size: 11px; }
      .hfma-badge-warn { color: #ca8a04; font-size: 11px; }
      .hfma-badge-none { color: #9ca3af; font-size: 11px; }
      .hfma-cmd {
        background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px;
        padding: 8px; margin-top: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px; line-height: 1.6; color: #111827;
        white-space: pre-wrap; word-break: break-all;
      }
      .hfma-actions { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
      .hfma-btn {
        border: 1px solid #d1d5db; background: #ffffff; color: #374151;
        border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer;
      }
      .hfma-btn:hover { background: #f9fafb; }
      .hfma-segment { display: inline-flex; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
      .hfma-segment button {
        border: none; background: #ffffff; color: #6b7280;
        padding: 3px 10px; font-size: 11px; cursor: pointer;
      }
      .hfma-segment button.active { background: #eff6ff; color: #2563eb; font-weight: 500; }
      .hfma-link { color: #2563eb; text-decoration: none; font-size: 11px; word-break: break-all; }
      .hfma-link:hover { text-decoration: underline; }
      .hfma-muted { color: #9ca3af; font-size: 11px; }

      @media (prefers-color-scheme: dark) {
        .hfma-card { background: #1f2937; border-color: #374151; color: #e5e7eb; }
        .hfma-title, .hfma-label, .hfma-stats { color: #9ca3af; }
        .hfma-section-title { color: #d1d5db; }
        .hfma-section { border-top-color: #374151; }
        .hfma-value { color: #f9fafb; }
        .hfma-cmd { background: #111827; border-color: #374151; color: #e5e7eb; }
        .hfma-btn { background: #374151; border-color: #4b5563; color: #e5e7eb; }
        .hfma-btn:hover { background: #4b5563; }
        .hfma-segment { border-color: #4b5563; }
        .hfma-segment button { background: #1f2937; color: #9ca3af; }
        .hfma-segment button.active { background: #1e3a5f; color: #93c5fd; }
        .hfma-link { color: #93c5fd; }
      }
    `;
  },

  async render(state) {
    this.state = { ...this.state, ...state, tool: 'vllm' };
    if (!this.shadow) return;

    this.shadow.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="hfma-card">
        <div class="hfma-title">🤖 ${t('cardTitle')}</div>
        <div class="hfma-section" data-section="info"><div class="hfma-muted">${t('loading')}</div></div>
        <div class="hfma-section" data-section="download"></div>
        <div class="hfma-section" data-section="deploy"></div>
      </div>
    `;

    if (this.state.platform === 'modelscope') {
      await this.renderModelScope();
    } else {
      await this.renderHf();
    }
  },

  section(name) {
    return this.shadow.querySelector(`[data-section="${name}"]`);
  },

  bindCopy(el, getText) {
    const btn = el.querySelector('[data-copy]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(getText()).then(() => {
        btn.textContent = t('copied');
        setTimeout(() => { btn.textContent = t('copy'); }, 1500);
      });
    });
  },

  // ── HF 模型页 ──────────────────────────────────────────────
  async renderHf() {
    const { modelId } = this.state;
    const [modelRes, mappingRes] = await Promise.all([
      API.fetchModelData(modelId),
      API.lookupMapping(modelId),
    ]);

    const data = modelRes.data || null;
    this.renderInfoSection(data);

    let mirror = null;
    if (mappingRes && mappingRes.match) {
      mirror = { msId: mappingRes.match.msId, msUrl: mappingRes.match.msUrl, verified: true };
    } else {
      mirror = await this.searchMirrorFallback(modelId);
    }

    this.renderDownloadSection(data, mirror);
    this.renderDeploySection(mirror, modelId);
  },

  renderInfoSection(data) {
    const el = this.section('info');
    if (!data) {
      el.innerHTML = `<div class="hfma-muted">${t('loadFailed')}</div>`;
      return;
    }

    const rows = [];
    const st = data.safetensors;
    if (st && st.parameters) {
      const total = Object.values(st.parameters).reduce((a, b) => a + b, 0);
      if (total > 0) rows.push([t('params'), this.formatParams(total)]);
      const dtypes = Object.keys(st.parameters);
      if (dtypes.length) rows.push([t('precision'), dtypes.join(', ')]);
    } else if (data.config && data.config.torch_dtype) {
      rows.push([t('precision'), data.config.torch_dtype]);
    }
    if (data.config && data.config.max_position_embeddings) {
      rows.push([t('context'), `${(data.config.max_position_embeddings / 1024).toFixed(0)}k`]);
    }
    const license = (data.cardData && data.cardData.license)
      || (data.tags || []).find(tag => tag.startsWith('license:'))?.slice(8);
    if (license) rows.push([t('license'), license]);
    if (data.lastModified) rows.push([t('updated'), data.lastModified.slice(0, 10)]);

    const stats = [];
    if (data.likes != null) stats.push(`❤ ${this.formatNum(data.likes)}`);
    if (data.downloads != null) stats.push(`⬇ ${this.formatNum(data.downloads)}`);

    el.innerHTML = `
      <div class="hfma-section-title">${t('sectionInfo')}</div>
      ${stats.length ? `<div class="hfma-stats">${stats.join(' · ')}</div>` : ''}
      ${rows.map(([k, v]) => `
        <div class="hfma-row">
          <span class="hfma-label">${this.esc(k)}</span>
          <span class="hfma-value">${this.esc(v)}</span>
        </div>`).join('')}
    `;
  },

  totalWeightBytes(data) {
    if (!data || !Array.isArray(data.siblings)) return null;
    const total = data.siblings
      .filter(f => /\.(safetensors|bin|gguf)$/i.test(f.rfilename || ''))
      .reduce((sum, f) => sum + (f.size || 0), 0);
    return total > 0 ? total : null;
  },

  async searchMirrorFallback(modelId) {
    // 搜索兜底要跨域打多次 API，结果（含"没找到"）缓存 7 天；
    // 已验证映射走 mapping.json 本地查表，不需要缓存。
    const cached = await Storage.getMappingCache(modelId);
    if (cached) return cached.mirror || null;

    const repo = modelId.split('/')[1] || modelId;
    const keywords = [...new Set([modelId, repo, repo.replace(/-hf$/i, '')])];

    let best = null;
    let bestScore = 0;
    for (const keyword of keywords) {
      const res = await API.searchModelScope(keyword);
      if (res.error || !res.data) continue;
      const results = res.data.data || res.data.results || [];
      for (const r of results) {
        const score = API.calculateMatchScore(modelId, r);
        if (score > bestScore) { bestScore = score; best = r; }
      }
      if (bestScore > 0.5) break;
    }

    let mirror = null;
    if (best && bestScore > 0.5) {
      const msId = best.model_id || best.name;
      if (msId) {
        mirror = { msId, msUrl: `https://www.modelscope.cn/models/${msId}`, verified: false };
      }
    }

    await Storage.setMappingCache(modelId, { mirror });
    return mirror;
  },

  renderDownloadSection(data, mirror) {
    const el = this.section('download');
    const { modelId } = this.state;
    const sizeText = this.formatBytes(this.totalWeightBytes(data));

    const badge = mirror
      ? (mirror.verified
        ? `<span class="hfma-badge-ok">✓ ${t('verifiedMirror')}</span>`
        : `<span class="hfma-badge-warn">⚠ ${t('unverifiedMirror')}</span>`)
      : `<span class="hfma-badge-none">${t('noMirror')}</span>`;

    const sources = mirror ? ['modelscope', 'hf'] : ['hf'];
    if (!sources.includes(this.state.source)) this.state.source = sources[0];

    const renderCmd = () => {
      const src = this.state.source;
      return src === 'modelscope' && mirror
        ? Commands.downloadCommand('modelscope', mirror.msId)
        : Commands.downloadCommand('hf', modelId);
    };

    el.innerHTML = `
      <div class="hfma-section-title">${t('sectionDownload')}${sizeText ? ` · ${t('weights')} ${sizeText}` : ''}</div>
      <div>${badge}${mirror ? ` <a class="hfma-link" href="${this.esc(mirror.msUrl)}" target="_blank" rel="noopener">${this.esc(mirror.msId)}</a>` : ''}</div>
      <div class="hfma-actions">
        <span class="hfma-segment">
          ${sources.map(s => `<button data-source="${s}" class="${this.state.source === s ? 'active' : ''}">${s === 'modelscope' ? t('sourceModelScope') : t('sourceHF')}</button>`).join('')}
        </span>
        <button class="hfma-btn" data-copy>${t('copy')}</button>
      </div>
      <div class="hfma-cmd" data-cmd>${this.esc(renderCmd())}</div>
    `;

    el.querySelectorAll('[data-source]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.source = btn.dataset.source;
        el.querySelectorAll('[data-source]').forEach(b => b.classList.toggle('active', b === btn));
        el.querySelector('[data-cmd]').textContent = renderCmd();
      });
    });
    this.bindCopy(el, renderCmd);
  },

  renderDeploySection(mirror, modelId) {
    const el = this.section('deploy');
    // 有已验证镜像时 vLLM 默认走 ModelScope 拉权重（国内服务器直连 HF 不可达）
    const useMs = !!(mirror && mirror.verified);
    const renderCmd = () => {
      if (this.state.tool === 'vllm' && useMs) {
        return Commands.vllmModelScopeCommand(mirror.msId);
      }
      return Commands.deployCommand(this.state.tool, modelId);
    };

    el.innerHTML = `
      <div class="hfma-section-title">${t('sectionDeploy')}</div>
      <div class="hfma-actions">
        <span class="hfma-segment">
          ${Commands.DEPLOY_TOOLS.map(tool =>
            `<button data-tool="${tool}" class="${this.state.tool === tool ? 'active' : ''}">${tool === 'vllm' ? 'vLLM' : 'SGLang'}</button>`).join('')}
        </span>
        <button class="hfma-btn" data-copy>${t('copy')}</button>
      </div>
      <div class="hfma-cmd" data-cmd>${this.esc(renderCmd())}</div>
    `;

    el.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.tool = btn.dataset.tool;
        el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b === btn));
        el.querySelector('[data-cmd]').textContent = renderCmd();
      });
    });
    this.bindCopy(el, renderCmd);
  },

  // ── ModelScope 模型页 ──────────────────────────────────────
  async renderModelScope() {
    const { modelId } = this.state;
    const [msRes, mappingRes] = await Promise.all([
      API.fetchMsModelData(modelId),
      API.lookupMapping(modelId, 'fromModelScope'),
    ]);

    this.renderMsInfoSection(msRes.data || null);

    // ModelScope 页上本家就是下载源，无需镜像查找
    const el = this.section('download');
    el.innerHTML = `
      <div class="hfma-section-title">${t('sectionDownload')}</div>
      <div class="hfma-actions"><button class="hfma-btn" data-copy>${t('copy')}</button></div>
      <div class="hfma-cmd" data-cmd>${this.esc(Commands.downloadCommand('modelscope', modelId))}</div>
      ${mappingRes && mappingRes.match
        ? `<div style="margin-top:6px;"><a class="hfma-link" href="${this.esc(mappingRes.match.hfUrl)}" target="_blank" rel="noopener">${t('viewOnHf')}: ${this.esc(mappingRes.match.hfId)}</a></div>`
        : ''}
    `;
    this.bindCopy(el, () => Commands.downloadCommand('modelscope', modelId));

    this.renderDeploySection({ msId: modelId, verified: true }, modelId);
  },

  renderMsInfoSection(data) {
    const el = this.section('info');
    if (!data || !data.info) {
      el.innerHTML = `<div class="hfma-muted">${t('loadFailed')}</div>`;
      return;
    }

    const info = data.info.Data || data.info;
    const rows = [];
    if (info.License) rows.push([t('license'), info.License]);
    if (info.LastUpdatedTime || info.GmtModified) {
      rows.push([t('updated'), String(info.LastUpdatedTime || info.GmtModified).slice(0, 10)]);
    }
    const stats = [];
    if (info.Likes != null) stats.push(`❤ ${this.formatNum(info.Likes)}`);
    if (info.Downloads != null) stats.push(`⬇ ${this.formatNum(info.Downloads)}`);

    let sizeText = null;
    const files = data.files && (data.files.Data ? data.files.Data.Files : null);
    if (Array.isArray(files)) {
      const total = files
        .filter(f => /\.(safetensors|bin|gguf)$/i.test(f.Path || f.Name || ''))
        .reduce((sum, f) => sum + (f.Size || 0), 0);
      sizeText = this.formatBytes(total);
      if (sizeText) rows.push([t('weights'), sizeText]);
    }

    el.innerHTML = `
      <div class="hfma-section-title">${t('sectionInfo')}</div>
      ${stats.length ? `<div class="hfma-stats">${stats.join(' · ')}</div>` : ''}
      ${rows.map(([k, v]) => `
        <div class="hfma-row">
          <span class="hfma-label">${this.esc(k)}</span>
          <span class="hfma-value">${this.esc(v)}</span>
        </div>`).join('')}
    `;
  },
};
