const DeployTab = {
  rendered: false,
  currentTool: 'ollama',
  currentParams: {},
  debounceTimer: null,

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;
    const settings = await Storage.getAll();
    this.currentTool = settings.defaultTool || 'ollama';
    this.currentParams = {};

    const tools = getSupportedTools();
    const toolOptions = tools.map(t =>
      `<option value="${t}" ${t === this.currentTool ? 'selected' : ''}>${getToolLabel(t)}</option>`
    ).join('');

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('deployTool')}</div>
        <select class="hf-assistant-select" id="deploy-tool-select">
          ${toolOptions}
        </select>
        <div id="deploy-params"></div>
      </div>

      <div class="hf-assistant-card" id="vram-card" style="display: none;">
        <div class="hf-assistant-card-title">${t('vramEstimate')}</div>
        <div id="vram-display"></div>
      </div>

      <div class="hf-assistant-card" id="gguf-card" style="display: none;">
        <div class="hf-assistant-card-title">GGUF 推荐</div>
        <div id="gguf-display"></div>
      </div>

      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">命令</div>
        <div class="hf-assistant-command" id="command-display">
          <button class="hf-assistant-command-copy" id="copy-cmd-btn">${t('copyCommand')}</button>
          <span id="command-text">选择一个工具...</span>
        </div>
      </div>

      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('commandHistory')}</div>
        <div id="history-display"></div>
      </div>
    `;

    container.innerHTML = html;
    this.rendered = true;

    this.bindEvents(container);
    this.renderParams(container);
    this.updateCommand(container);
    this.renderHistory(container);
  },

  bindEvents(container) {
    const toolSelect = container.querySelector('#deploy-tool-select');
    toolSelect.addEventListener('change', (e) => {
      this.currentTool = e.target.value;
      this.currentParams = {};
      this.renderParams(container);
      this.updateCommand(container);
    });

    container.querySelector('#copy-cmd-btn').addEventListener('click', () => {
      const cmd = container.querySelector('#command-text').textContent;
      navigator.clipboard.writeText(cmd).then(() => {
        Sidebar.showToast(t('copied'));
      });
      Storage.addCommandHistory(this.currentTool, cmd, this.currentParams);
      this.renderHistory(container);
    });
  },

  renderParams(container) {
    const paramsContainer = container.querySelector('#deploy-params');
    const params = getToolParams(this.currentTool);

    let html = '';
    for (const [key, config] of Object.entries(params)) {
      const label = key;
      const value = this.currentParams[key] !== undefined ? this.currentParams[key] : config.default;

      if (config.type === 'select') {
        const options = config.options.map(opt =>
          `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
        ).join('');
        html += `
          <label class="hf-assistant-label">${label}</label>
          <select class="hf-assistant-select" data-param="${key}">
            ${options}
          </select>
        `;
      } else if (config.type === 'number') {
        html += `
          <label class="hf-assistant-label">${label}</label>
          <input type="number" class="hf-assistant-input" data-param="${key}"
            value="${value}" min="${config.min || 0}" max="${config.max || 999999}">
        `;
      } else if (config.type === 'range') {
        html += `
          <label class="hf-assistant-label">${label} (${value})</label>
          <input type="range" class="hf-assistant-input" data-param="${key}"
            value="${value}" min="${config.min}" max="${config.max}" step="${config.step || 0.1}">
        `;
      } else if (config.type === 'text') {
        html += `
          <label class="hf-assistant-label">${label}</label>
          <input type="text" class="hf-assistant-input" data-param="${key}"
            value="${value || ''}" placeholder="${config.placeholder || ''}">
        `;
      } else if (config.type === 'checkbox') {
        html += `
          <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 12px;">
            <input type="checkbox" data-param="${key}" ${value ? 'checked' : ''}>
            ${label}
          </label>
        `;
      }
    }

    paramsContainer.innerHTML = html;

    paramsContainer.querySelectorAll('[data-param]').forEach(el => {
      el.addEventListener('change', (e) => {
        const paramKey = e.target.dataset.param;
        let val = e.target.value;
        if (e.target.type === 'checkbox') val = e.target.checked;
        if (e.target.type === 'number' || e.target.type === 'range') val = parseFloat(val);
        this.currentParams[paramKey] = val;
        this.updateCommand(container);
      });
    });
    // Also listen for input events on text fields
    paramsContainer.querySelectorAll('input[data-param][type="text"]').forEach(el => {
      el.addEventListener('input', (e) => {
        this.currentParams[e.target.dataset.param] = e.target.value;
        this.updateCommand(container);
      });
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
      container.querySelector('#command-text').textContent = cmd;

      this.updateVramEstimate(container);
    }, 100);
  },

  async updateVramEstimate(container) {
    if (!this.modelInfo) return;

    const settings = await Storage.getAll();
    const precision = this.inferPrecision();

    const estimate = estimateVRAM(this.modelInfo, {
      precision,
      tool: this.currentTool,
      userVramGB: settings.vramGB,
      maxModelLen: this.currentParams.maxModelLen || this.currentParams.ctx || 4096
    });

    const vramCard = container.querySelector('#vram-card');
    const vramDisplay = container.querySelector('#vram-display');

    if (estimate.vramGB !== null) {
      vramCard.style.display = 'block';
      const statusClass = `hf-assistant-status-${estimate.status}`;
      const statusText = estimate.status === 'ok' ? t('vramOk') :
                         estimate.status === 'warning' ? t('vramWarning') : t('vramInsufficient');
      vramDisplay.innerHTML = `
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">
          ${estimate.vramGB} GB
        </div>
        <div class="${statusClass}">${statusText}</div>
        <div style="color: #6b7280; font-size: 10px; margin-top: 4px;">
          基于 ${estimate.paramsB}B 参数 x ${estimate.precision}
        </div>
      `;
    } else {
      vramCard.style.display = 'none';
    }
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

  async renderHistory(container) {
    const history = await Storage.getCommandHistory();
    const display = container.querySelector('#history-display');

    if (!history.length) {
      display.innerHTML = '<div style="color: #6b7280; font-size: 11px;">暂无历史记录</div>';
      return;
    }

    const items = history.slice(0, 5).map(h => `
      <div class="hf-assistant-history-item">
        <span class="hf-assistant-history-cmd" title="${h.command}">[${getToolLabel(h.tool)}] ${h.command}</span>
        <button class="hf-assistant-btn reuse-btn" data-tool="${h.tool}" style="font-size: 10px; padding: 2px 6px;">复用</button>
      </div>
    `).join('');

    display.innerHTML = items;

    display.querySelectorAll('.reuse-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = history.find(h => h.tool === btn.dataset.tool);
        if (entry) {
          this.currentTool = entry.tool;
          this.currentParams = { ...entry.params };
          container.querySelector('#deploy-tool-select').value = entry.tool;
          this.renderParams(container);
          this.updateCommand(container);
        }
      });
    });
  }
};
