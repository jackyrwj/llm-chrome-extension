const GPU_PRESETS = [
  { group: '消费级 — NVIDIA',  list: [
    { name: 'RTX 5090',            vram: 32  },
    { name: 'RTX 5080',            vram: 16  },
    { name: 'RTX 4090',            vram: 24  },
    { name: 'RTX 4080 Super',      vram: 16  },
    { name: 'RTX 4080',            vram: 16  },
    { name: 'RTX 4070 Ti Super',   vram: 16  },
    { name: 'RTX 4070 Ti',         vram: 12  },
    { name: 'RTX 4070 Super',      vram: 12  },
    { name: 'RTX 4070',            vram: 12  },
    { name: 'RTX 3090 Ti / 3090',  vram: 24  },
    { name: 'RTX 3080 Ti',         vram: 12  },
    { name: 'RTX 3080',            vram: 10  },
  ]},
  { group: '消费级 — AMD / Apple', list: [
    { name: 'RX 7900 XTX',         vram: 24  },
    { name: 'RX 7900 XT',          vram: 20  },
    { name: 'Apple M4 Ultra',      vram: 192 },
    { name: 'Apple M4 Max (128G)', vram: 128 },
    { name: 'Apple M4 Max (64G)',  vram: 64  },
    { name: 'Apple M4 Pro (48G)',  vram: 48  },
    { name: 'Apple M3 Ultra',      vram: 192 },
    { name: 'Apple M3 Max (128G)', vram: 128 },
    { name: 'Apple M2 Ultra',      vram: 192 },
    { name: 'Apple M2 Max (96G)',   vram: 96 },
  ]},
  { group: '专业级 — NVIDIA',  list: [
    { name: 'RTX 6000 Ada',        vram: 48  },
    { name: 'RTX 5000 Ada',        vram: 32  },
    { name: 'RTX 4500 Ada',        vram: 24  },
    { name: 'RTX 4000 Ada',        vram: 20  },
    { name: 'RTX A6000',           vram: 48  },
    { name: 'RTX A5000',           vram: 24  },
    { name: 'RTX A4000',           vram: 16  },
  ]},
  { group: '数据中心 — NVIDIA', list: [
    { name: 'H200 SXM (141GB)',    vram: 141 },
    { name: 'H200 NVL (94GB)',     vram: 94  },
    { name: 'H100 SXM (80GB)',     vram: 80  },
    { name: 'H100 PCIe (80GB)',    vram: 80  },
    { name: 'H20 (96GB)',          vram: 96  },
    { name: 'A100 SXM (80GB)',     vram: 80  },
    { name: 'A100 PCIe (80GB)',    vram: 80  },
    { name: 'A100 PCIe (40GB)',    vram: 40  },
    { name: 'A800 (80GB)',         vram: 80  },
    { name: 'L40S (48GB)',         vram: 48  },
    { name: 'L40 (48GB)',          vram: 48  },
    { name: 'L4 (24GB)',           vram: 24  },
    { name: 'A40 (48GB)',          vram: 48  },
    { name: 'A30 (24GB)',          vram: 24  },
    { name: 'A10 (24GB)',          vram: 24  },
    { name: 'V100 SXM2 (32GB)',    vram: 32  },
    { name: 'V100 PCIe (16GB)',    vram: 16  },
    { name: 'T4 (16GB)',           vram: 16  },
  ]},
  { group: '国产 AI 芯片', list: [
    { name: '华为 昇腾 910C (96GB)',   vram: 96 },
    { name: '华为 昇腾 910B3 (64GB)',  vram: 64 },
    { name: '华为 昇腾 910B (64GB)',   vram: 64 },
    { name: '华为 昇腾 310P (16GB)',   vram: 16 },
    { name: '寒武纪 MLU590 (64GB)',    vram: 64 },
    { name: '天数智芯 BI-150 (80GB)',  vram: 80 },
    { name: '摩尔线程 MTT S4000 (48GB)', vram: 48 },
    { name: '燧原 T20 (32GB)',         vram: 32 },
    { name: '沐曦 MXC500 (32GB)',      vram: 32 },
  ]},
];

const DeployTab = {
  rendered: false,
  currentTool: 'ollama',
  currentParams: {},
  debounceTimer: null,
  currentCommand: '',
  commandFavorited: false,
  pendingCommandFavorite: null,

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;
    const settings = await Storage.getAll();
    this.currentTool = settings.defaultTool || 'ollama';
    this.currentParams = {};
    this.currentCommand = '';
    this.commandFavorited = false;

    if (this.pendingCommandFavorite && modelInfo && this.pendingCommandFavorite.modelId === modelInfo.modelId) {
      this.currentTool = this.pendingCommandFavorite.tool;
      this.currentParams = { ...(this.pendingCommandFavorite.params || {}) };
      this.pendingCommandFavorite = null;
    }

    let html = `
      <div class="hf-assistant-card" id="vram-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">${t('vramEstimate')}</div>
          <button type="button" class="hf-assistant-inline-action" id="vram-config-toggle">⚙️配置</button>
        </div>
        <div id="vram-config-form" style="display:none;border-top:1px solid #e5e7eb;padding-top:10px;margin-bottom:10px;">
          <div style="margin-bottom:8px;">
            <label class="hf-assistant-label" style="margin-bottom:4px;">硬件预设</label>
            <select id="vram-gpu-select" class="hf-assistant-select" style="margin-bottom:0;">
              ${GPU_PRESETS.map(g =>
                `<optgroup label="${g.group}">${g.list.map(gpu =>
                  `<option value="${gpu.vram}" data-name="${gpu.name}">${gpu.name} · ${gpu.vram}GB</option>`
                ).join('')}</optgroup>`
              ).join('')}
              <optgroup label="其他"><option value="custom">自定义...</option></optgroup>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">
            <div>
              <label class="hf-assistant-label" style="margin-bottom:2px;">每卡显存 (GB)</label>
              <input type="number" id="vram-config-gb" class="hf-assistant-input" style="margin-bottom:0;" min="1" max="9999">
            </div>
            <div>
              <label class="hf-assistant-label" style="margin-bottom:2px;">GPU 数量</label>
              <input type="number" id="vram-config-gpu" class="hf-assistant-input" style="margin-bottom:0;" min="1" max="512"
                list="gpu-count-list">
              <datalist id="gpu-count-list">
                <option value="1"><option value="2"><option value="4">
                <option value="8"><option value="16"><option value="32">
                <option value="64"><option value="128">
              </datalist>
            </div>
          </div>
          <div id="vram-total-label" style="font-size:11px;color:#6b7280;min-height:16px;"></div>
        </div>
        <div id="vram-display"><div style="color:#9ca3af;font-size:11px;">加载模型信息中…</div></div>
      </div>

      <div class="hf-assistant-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">命令 · ${getToolLabel(this.currentTool)}</div>
          <button type="button" class="hf-assistant-inline-action" id="cmd-config-toggle">⚙️配置</button>
        </div>
        <div id="cmd-config-form" style="display:none;margin-bottom:10px;">
          <div style="margin-bottom:10px;">
            <label class="hf-assistant-label" style="margin-bottom:2px;font-size:11px;">部署工具</label>
            <select class="hf-assistant-select" id="cmd-config-tool" style="margin-bottom:0;">
              ${getSupportedTools().map(t => `<option value="${t}" ${t === this.currentTool ? 'selected' : ''}>${getToolLabel(t)}</option>`).join('')}
            </select>
          </div>
          <div id="cmd-config-params"></div>
        </div>
        <div class="hf-assistant-command" id="command-display">
          <button class="hf-assistant-command-copy" id="copy-cmd-btn">${t('copyCommand')}</button>
          <button class="hf-assistant-command-copy" id="favorite-cmd-btn" style="right:84px;">${t('favoriteCommand')}</button>
          <span id="command-text">加载中…</span>
        </div>
        <div style="margin-top:8px;color:#6b7280;font-size:11px;line-height:1.5;">
          收藏后会出现在“收藏”Tab 对应模型下面，可继续复用。
        </div>
      </div>

      <div class="hf-assistant-card" id="gguf-card" style="display: none;">
        <div class="hf-assistant-card-title">GGUF 推荐</div>
        <div id="gguf-display"></div>
      </div>
    `;

    container.innerHTML = html;
    this.rendered = true;

    this.bindEvents(container);
    this.renderParams(container);
    this.updateCommand(container);

    // VRAM card inline config toggle
    const vramToggle = container.querySelector('#vram-config-toggle');
    const vramForm = container.querySelector('#vram-config-form');
    vramToggle.addEventListener('click', () => {
      const expanded = vramForm.style.display === 'none';
      vramForm.style.display = expanded ? 'block' : 'none';
      vramToggle.textContent = expanded ? '✕' : '⚙️配置';
    });

    const gpuSelect  = container.querySelector('#vram-gpu-select');
    const vramInput  = container.querySelector('#vram-config-gb');
    const countInput = container.querySelector('#vram-config-gpu');
    const totalLabel = container.querySelector('#vram-total-label');

    const updateTotal = () => {
      const perCard = parseInt(vramInput.value) || 0;
      const count   = parseInt(countInput.value) || 1;
      const total   = perCard * count;
      totalLabel.textContent = count > 1 ? `合计 ${total} GB` : '';
      Storage.set('vramGB', total || perCard)
        .then(() => Storage.set('gpuCount', count))
        .then(() => this.updateVramEstimate(container));
    };

    // Restore saved state
    const savedGPU   = settings.selectedGPU || '';
    const savedVram  = settings.vramPerCard || settings.vramGB || 24;
    const savedCount = settings.gpuCount || 1;
    countInput.value = savedCount;

    // Find matching preset option by name
    let matched = false;
    for (const opt of gpuSelect.options) {
      if (opt.dataset.name === savedGPU) {
        gpuSelect.value = opt.value;
        vramInput.value = savedVram; // allow override even from preset
        matched = true;
        break;
      }
    }
    if (!matched) {
      gpuSelect.value = 'custom';
      vramInput.value = savedVram;
    }
    updateTotal();

    gpuSelect.addEventListener('change', () => {
      const val = gpuSelect.value;
      if (val === 'custom') {
        vramInput.value = '';
        vramInput.focus();
        Storage.set('selectedGPU', '');
      } else {
        vramInput.value = val;
        const name = gpuSelect.options[gpuSelect.selectedIndex]?.dataset.name || '';
        Storage.set('selectedGPU', name);
      }
      updateTotal();
    });

    vramInput.addEventListener('input', () => {
      // If user edits VRAM manually, switch preset to custom
      const selectedName = gpuSelect.options[gpuSelect.selectedIndex]?.dataset.name || '';
      const presetVram = parseInt(gpuSelect.value);
      if (selectedName && parseInt(vramInput.value) !== presetVram) {
        gpuSelect.value = 'custom';
        Storage.set('selectedGPU', '');
      }
      Storage.set('vramPerCard', parseInt(vramInput.value) || 0);
    });
    vramInput.addEventListener('change', updateTotal);
    countInput.addEventListener('change', updateTotal);

    // Command card inline config toggle + tool switcher
    const cmdToggle = container.querySelector('#cmd-config-toggle');
    const cmdForm = container.querySelector('#cmd-config-form');
    cmdToggle.addEventListener('click', () => {
      const expanded = cmdForm.style.display === 'none';
      cmdForm.style.display = expanded ? 'block' : 'none';
      cmdToggle.textContent = expanded ? '✕' : '⚙️配置';
    });

    container.querySelector('#cmd-config-tool').addEventListener('change', e => {
      this.currentTool = e.target.value;
      this.currentParams = {};
      Storage.set('defaultTool', this.currentTool);
      container.querySelector('.hf-assistant-card-title').textContent = `命令 · ${getToolLabel(this.currentTool)}`;
      this.renderParams(container);
      this.updateCommand(container);
    });

    // 异步拉取模型 config（num_hidden_layers、hidden_size、num_key_value_heads 等）
    // 拿到后刷新显存估算
    if (modelInfo && modelInfo.modelId) {
      API.fetchModelConfig(modelInfo.modelId).then(result => {
        if (result && result.config) {
          this.modelInfo.config = result.config;
          this.updateVramEstimate(container);
        }
      });
    }
  },

  bindEvents(container) {

    container.querySelector('#copy-cmd-btn').addEventListener('click', () => {
      const cmd = container.querySelector('#command-text').textContent;
      navigator.clipboard.writeText(cmd).then(() => {
        Sidebar.showToast(t('copied'));
      });
    });

    container.querySelector('#favorite-cmd-btn').addEventListener('click', async () => {
      if (!this.modelInfo || !this.currentCommand) return;

      if (this.commandFavorited) {
        await Storage.removeCommandFavorite(this.modelInfo.modelId, this.currentTool, this.currentCommand);
        Sidebar.showToast(t('commandRemovedFromFavorites'));
      } else {
        await Storage.addCommandFavorite(
          this.modelInfo.modelId,
          this.modelInfo.modelscopeUrl || '',
          this.currentTool,
          this.currentCommand,
          this.currentParams
        );
        Sidebar.showToast(t('commandSavedToFavorites'));
      }

      await this.updateCommandFavoriteState(container);
      if (Sidebar.currentTab === 'favorites' && typeof FavoritesTab !== 'undefined') {
        FavoritesTab.rendered = false;
        FavoritesTab.render(Sidebar.getPanel('favorites'));
      }
    });
  },

  syncParamValue(target) {
    if (!target || !target.dataset || !target.dataset.param) return;

    const paramKey = target.dataset.param;
    let val = target.value;

    if (target.type === 'checkbox') {
      val = target.checked;
    } else if (target.type === 'number' || target.type === 'range') {
      val = target.value === '' ? '' : parseFloat(target.value);
    }

    this.currentParams[paramKey] = val;
  },

  renderParams(container) {
    const paramsContainer = container.querySelector('#cmd-config-params');
    const params = getToolParams(this.currentTool);

    const esc = s => String(s).replace(/"/g, '&quot;');
    const tip = cfg => cfg.description
      ? `<span class="hf-assistant-param-tip" data-tip="${esc(cfg.description)}">ⓘ</span>` : '';

    const buildField = (key, config) => {
      const value = this.currentParams[key] !== undefined ? this.currentParams[key] : config.default;
      const flag = config.flag || key;

      if (config.type === 'checkbox') {
        return `
          <div class="hf-param-row" style="margin-bottom:6px;">
            <input type="checkbox" data-param="${key}" ${value ? 'checked' : ''} style="flex-shrink:0;margin:0;">
            <label class="hf-assistant-label" style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;">${flag}${tip(config)}</label>
          </div>
        `;
      }
      if (config.type === 'number') {
        return `
          <div class="hf-param-row">
            <label class="hf-assistant-label">${flag}${tip(config)}</label>
            <input type="number" class="hf-assistant-input" data-param="${key}"
              value="${value}" min="${config.min || 0}" max="${config.max || 999999}">
          </div>
        `;
      }
      if (config.type === 'select') {
        const options = config.options.map(opt =>
          `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
        ).join('');
        return `
          <div class="hf-param-row">
            <label class="hf-assistant-label">${flag}${tip(config)}</label>
            <select class="hf-assistant-select" data-param="${key}">${options}</select>
          </div>
        `;
      }
      if (config.type === 'range') {
        return `
          <div style="margin-bottom:6px;">
            <label class="hf-assistant-label" style="margin-bottom:4px;">${flag} <span class="hf-assistant-range-val" data-range-for="${key}">(${value})</span>${tip(config)}</label>
            <input type="range" class="hf-assistant-input" data-param="${key}" style="margin-bottom:0;"
              value="${value}" min="${config.min}" max="${config.max}" step="${config.step || 0.1}">
          </div>
        `;
      }
      if (config.type === 'text') {
        return `
          <div style="margin-bottom:6px;">
            <label class="hf-assistant-label" style="margin-bottom:4px;">${flag}${tip(config)}</label>
            <input type="text" class="hf-assistant-input" data-param="${key}" style="margin-bottom:0;"
              value="${esc(value || '')}" placeholder="${esc(config.placeholder || '')}">
          </div>
        `;
      }
      return '';
    };

    const commonEntries = [];
    const advancedGroups = new Map();
    for (const [key, config] of Object.entries(params)) {
      if (config.common) {
        commonEntries.push([key, config]);
      } else {
        const g = config.group || '其他';
        if (!advancedGroups.has(g)) advancedGroups.set(g, []);
        advancedGroups.get(g).push([key, config]);
      }
    }

    let html = '';
    for (const [key, config] of commonEntries) html += buildField(key, config);

    if (advancedGroups.size > 0) {
      const isExpanded = this.advancedExpanded || false;
      html += `
        <button id="params-advanced-toggle" style="
          width:100%; margin-top:4px; padding:6px; border:1px dashed #d1d5db;
          border-radius:6px; background:transparent; cursor:pointer;
          font-size:11px; color:#6b7280; text-align:center;">
          ${isExpanded ? '▲ 收起高级参数' : '▼ 展开高级参数'}
        </button>
        <div id="params-advanced" style="display:${isExpanded ? 'block' : 'none'}; margin-top:8px;">
      `;
      for (const [groupName, entries] of advancedGroups) {
        html += `<div class="hf-assistant-param-group">${groupName}</div>`;
        for (const [key, config] of entries) html += buildField(key, config);
      }
      html += '</div>';
    }

    paramsContainer.innerHTML = html;

    const toggleBtn = paramsContainer.querySelector('#params-advanced-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.advancedExpanded = !this.advancedExpanded;
        const adv = paramsContainer.querySelector('#params-advanced');
        adv.style.display = this.advancedExpanded ? 'block' : 'none';
        toggleBtn.textContent = this.advancedExpanded ? '▲ 收起高级参数' : '▼ 展开高级参数';
      });
    }

    // JS tooltip（挂到 body，避免被 overflow:auto 截断）
    let tooltipEl = document.getElementById('hf-param-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'hf-param-tooltip';
      document.body.appendChild(tooltipEl);
    }
    paramsContainer.querySelectorAll('.hf-assistant-param-tip').forEach(el => {
      el.addEventListener('mouseenter', () => {
        tooltipEl.textContent = el.dataset.tip;
        tooltipEl.style.display = 'block';
        const r = el.getBoundingClientRect();
        const tw = tooltipEl.offsetWidth;
        const th = tooltipEl.offsetHeight;
        let left = r.left + r.width / 2 - tw / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
        let top = r.top - th - 8;
        if (top < 8) top = r.bottom + 8;
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
      });
      el.addEventListener('mouseleave', () => {
        tooltipEl.style.display = 'none';
      });
    });

    // Range sliders: update value badge live
    paramsContainer.querySelectorAll('input[type="range"][data-param]').forEach(el => {
      el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const badge = paramsContainer.querySelector(`[data-range-for="${e.target.dataset.param}"]`);
        if (badge) badge.textContent = `(${val})`;
        this.syncParamValue(e.target);
        this.updateCommand(container);
      });
    });

    paramsContainer.querySelectorAll('[data-param]').forEach(el => {
      if (el.type === 'range') return;
      const handler = (e) => {
        this.syncParamValue(e.target);
        this.updateCommand(container);
      };

      if (el.tagName === 'SELECT' || el.type === 'checkbox') {
        el.addEventListener('change', handler);
      } else {
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    });

    const ggufCard = container.querySelector('#gguf-card');
    if (this.currentTool === 'ollama' || this.currentTool === 'llamacpp') {
      ggufCard.style.display = 'block';
      this.renderGGUFRecommendation(container);
    } else {
      ggufCard.style.display = 'none';
    }
  },

  updateCommand(container) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (!this.modelInfo) return;

      const modelId = this.currentTool === 'llamacpp' && this.currentParams.ggufFile ?
        this.currentParams.ggufFile : this.modelInfo.modelId;

      const cmd = generateCommand(this.currentTool, modelId, this.currentParams);
      const cmdEl = container.querySelector('#command-text');
      cmdEl.textContent = cmd;
      cmdEl.style.paddingTop = '28px';
      this.currentCommand = cmd;
      this.updateCommandFavoriteState(container);

      this.updateVramEstimate(container);
    }, 100);
  },

  async updateCommandFavoriteState(container) {
    const btn = container.querySelector('#favorite-cmd-btn');
    if (!btn || !this.modelInfo || !this.currentCommand) return;

    const isFavorited = await Storage.isCommandFavorited(
      this.modelInfo.modelId,
      this.currentTool,
      this.currentCommand
    );
    this.commandFavorited = isFavorited;
    btn.textContent = isFavorited ? t('unfavoriteCommand') : t('favoriteCommand');
    btn.style.background = isFavorited ? '#92400e' : '#374151';
  },

  queueFavoriteCommand(modelId, commandEntry) {
    this.pendingCommandFavorite = {
      modelId,
      tool: commandEntry.tool,
      params: { ...(commandEntry.params || {}) }
    };
  },

  async updateVramEstimate(container) {
    if (!this.modelInfo) return;

    const settings = await Storage.getAll();
    const userVramGB = settings.vramGB || 64;
    const precision = this.inferPrecision();

    const estimate = estimateVRAM(this.modelInfo, {
      precision,
      tool: this.currentTool,
      userVramGB,
      maxModelLen: this.currentParams.maxModelLen || this.currentParams.ctx || 4096
    });

    const vramDisplay = container.querySelector('#vram-display');
    if (!vramDisplay) return;

    if (estimate.vramGB === null) {
      vramDisplay.innerHTML = '<div style="color:#9ca3af;font-size:11px;">无法识别模型参数量</div>';
      return;
    }

    const statusClass = `hf-assistant-status-${estimate.status}`;
    const statusText = estimate.status === 'ok' ? t('vramOk') :
                       estimate.status === 'warning' ? t('vramWarning') : t('vramInsufficient');
    const sourceTag = estimate.configLoaded
      ? '<span style="color:#16a34a;">● 实际配置</span>'
      : '<span style="color:#ca8a04;">● 估算值</span>';

    vramDisplay.innerHTML = `
      <div style="font-size:18px;font-weight:600;margin-bottom:4px;">${estimate.vramGB} GB</div>
      <div class="${statusClass}">${statusText}</div>
      <div style="color:#6b7280;font-size:10px;margin-top:6px;">
        ${estimate.paramsB}B 参数 · ${estimate.precision} · ${sourceTag}
      </div>
    `;
  },

  inferPrecision() {
    const quant = this.currentParams.quant;
    if (quant === 'q4_0' || quant === 'q4_K_M' || quant === 'q4') return 'q4';
    if (quant === 'q5_K_M' || quant === 'q5') return 'q5_k_m';
    if (quant === 'q6_k' || quant === 'q6') return 'q6_k';
    if (quant === 'q8_0' || quant === 'q8') return 'q8_0';
    if (quant === 'awq') return 'awq';
    if (quant === 'gptq') return 'gptq';
    if (quant === 'fp8') return 'fp8';
    if (this.currentParams.loadIn8bit) return 'int8';
    if (this.currentParams.loadIn4bit) return 'int4';
    if (this.currentParams.torchDtype === 'float16') return 'fp16';
    if (this.currentParams.torchDtype === 'bfloat16') return 'bf16';
    return 'fp16';
  },

  async renderGGUFRecommendation(container) {
    if (!this.modelInfo || !this.modelInfo.files) return;

    const ggufs = this.modelInfo.files.filter(f => f.isGguf);
    if (!ggufs.length) {
      container.querySelector('#gguf-display').innerHTML = '<div style="color: #6b7280;">未找到 GGUF 文件</div>';
      return;
    }

    const settings = await Storage.getAll();
    const userVram = settings.vramGB;

    const enriched = ggufs.map(f => {
      const sizeGB = f.size ? f.size / 1024 / 1024 / 1024 : null;
      const estVram = sizeGB ? sizeGB * 1.15 : null;
      let status = 'unknown';
      if (estVram !== null) {
        if (estVram <= userVram * 0.9) status = 'compatible';
        if (estVram > userVram * 1.1) status = 'too-large';
      }
      return { ...f, sizeGB, estVram, status };
    });

    const compatible = enriched.filter(g => g.status === 'compatible');
    const recommended = compatible.sort((a, b) => (b.estVram || 0) - (a.estVram || 0))[0];
    if (recommended) recommended.status = 'recommended';

    let html = '<div style="display: flex; flex-direction: column; gap: 4px;">';
    for (const g of enriched) {
      const statusText = g.status === 'recommended' ? ` 🏆 ${t('ggufRecommended')}` :
                         g.status === 'too-large' ? ` ⚠️ ${t('ggufTooLarge')}` :
                         g.status === 'compatible' ? ` ✅ ${t('ggufCompatible')}` : '';
      const color = g.status === 'recommended' ? '#16a34a' :
                    g.status === 'too-large' ? '#dc2626' : '#6b7280';

      html += `
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 6px; background: ${g.status === 'recommended' ? '#f0fdf4' : '#f9fafb'};
                    border-radius: 4px; cursor: pointer; font-size: 11px;"
             class="gguf-item" data-file="${g.name}">
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.name}</span>
          <span style="color: ${color}; white-space: nowrap; margin-left: 8px;">
            ${g.sizeGB ? g.sizeGB.toFixed(1) + 'GB' : ''}${statusText}
          </span>
        </div>
      `;
    }
    html += '</div>';

    const display = container.querySelector('#gguf-display');
    display.innerHTML = html;

    display.querySelectorAll('.gguf-item').forEach(el => {
      el.addEventListener('click', () => {
        this.currentParams.ggufFile = el.dataset.file;
        this.updateCommand(container);
        display.querySelectorAll('.gguf-item').forEach(i => i.style.background = '#f9fafb');
        el.style.background = '#dbeafe';
      });
    });
  },

  async renderHistory() {}
};
