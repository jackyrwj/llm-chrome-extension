const DownloadTab = {
  state: {
    modelInfo: null,
    settings: null,
    selectedTool: 'hf_cli',
    selectedMirror: 'hf-mirror',
    advancedOpen: false,
    fileFilters: {
      safetensors: true,
      pytorch: true,
      gguf: true,
      config: true,
      tokenizer: true,
      other: true
    },
    localDir: '',
    hfToken: ''
  },

  // Tool config for rendering and command generation
  tools: {
    hf_cli: { id: 'hf_cli', label: t('huggingfaceCli'), desc: t('quickDownload') },
    git_lfs: { id: 'git_lfs', label: t('gitLfs'), desc: t('fullClone') },
    python: { id: 'python', label: t('pythonCode'), desc: t('codeIntegration') },
    browser: { id: 'browser', label: t('browser'), desc: t('browseFiles') }
  },

  async render(container, modelInfo) {
    this.state.modelInfo = modelInfo;
    this.state.settings = await Storage.getAll();
    this.state.selectedMirror = this.state.settings.preferredMirror || 'hf-mirror';
    this.state.localDir = modelInfo
      ? './' + modelInfo.modelId.replace(/\//g, '_')
      : './model';

    const recommended = this.recommendTool();
    this.state.selectedTool = recommended.tool;

    container.innerHTML = this.buildHTML();
    this.bindEvents(container);
  },

  recommendTool() {
    const { modelInfo, settings } = this.state;
    if (!modelInfo) return { tool: 'hf_cli', reason: t('quickDownload') };

    const hasModelScope = !!(modelInfo.modelscopeUrl);
    const preferredMirror = settings.preferredMirror || 'hf-mirror';

    if (preferredMirror === 'modelscope' && hasModelScope) {
      return { tool: 'git_lfs', reason: t('fullClone'), mirror: 'modelscope' };
    }

    return { tool: 'hf_cli', reason: t('quickDownload') };
  },

  getPlatform() {
    const p = navigator.platform || '';
    if (p.includes('Win')) return 'windows';
    return 'unix';
  },

  getMirrorUrl(mirror, tool) {
    if (mirror === 'hf-mirror') return 'https://hf-mirror.com';
    if (mirror === 'official') return 'https://huggingface.co';
    if (mirror === 'modelscope') {
      if (tool === 'git_lfs') return 'https://www.modelscope.cn/models';
      return 'https://www.modelscope.cn';
    }
    return 'https://huggingface.co';
  },

  buildEnvVar(mirrorUrl, platform) {
    if (!mirrorUrl || mirrorUrl === 'https://huggingface.co') return '';
    if (platform === 'windows') {
      return `$env:HF_ENDPOINT="${mirrorUrl}"`;
    }
    return `export HF_ENDPOINT=${mirrorUrl}`;
  },

  buildCommand(tool, mirror, opts = {}) {
    const { modelInfo, localDir, hfToken, fileFilters } = this.state;
    if (!modelInfo) return '';

    const modelId = modelInfo.modelId;
    const platform = this.getPlatform();
    const mirrorUrl = this.getMirrorUrl(mirror, tool);

    if (tool === 'hf_cli') {
      let cmd = '';
      const env = this.buildEnvVar(mirrorUrl, platform);
      if (env) cmd += '$ ' + env + '\n';
      cmd += `$ huggingface-cli download ${modelId}`;
      if (localDir) cmd += ` \\\n  --local-dir ${localDir}`;

      // File filtering
      const includes = [];
      if (fileFilters.safetensors) includes.push('*.safetensors');
      if (fileFilters.pytorch) includes.push('*.bin');
      if (fileFilters.gguf) includes.push('*.gguf');
      if (fileFilters.config) includes.push('config.json');
      if (fileFilters.tokenizer) includes.push('tokenizer*');

      const allOn = Object.values(fileFilters).every(v => v);
      if (!allOn && includes.length > 0) {
        cmd += ` \\\n  --include "${includes.join('" "')}"`;
      }

      if (hfToken) cmd += ` \\\n  --token ${hfToken}`;
      return cmd.trim();
    }

    if (tool === 'git_lfs') {
      let cmd = '';
      if (platform === 'windows') {
        cmd += '$ $env:GIT_LFS_SKIP_SMUDGE="1"\n';
      } else {
        cmd += '$ GIT_LFS_SKIP_SMUDGE=1\n';
      }
      const baseUrl = mirror === 'modelscope' && modelInfo.modelscopeUrl
        ? modelInfo.modelscopeUrl
        : `${mirrorUrl}/${modelId}`;
      cmd += `$ git clone ${baseUrl}.git`;
      return cmd.trim();
    }

    if (tool === 'python') {
      let code = 'from huggingface_hub import snapshot_download\n\n';
      const env = this.buildEnvVar(mirrorUrl, platform);
      if (env && platform === 'unix') {
        code = `import os\nos.environ["HF_ENDPOINT"] = "${mirrorUrl}"\n\n` + code;
      }
      code += `snapshot_download(\n`;
      code += `    repo_id="${modelId}"`;
      if (localDir) code += `,\n    local_dir="${localDir}"`;
      code += '\n)';
      return code;
    }

    if (tool === 'browser') {
      return `${mirrorUrl}/${modelId}/tree/main`;
    }

    return '';
  },

  getTip() {
    const { selectedTool, selectedMirror, fileFilters, modelInfo, hfToken } = this.state;
    const tips = [];
    const platform = this.getPlatform();

    if (selectedTool === 'hf_cli') tips.push(`💡 ${t('tipNeedHuggingfaceHub')}`);
    if (selectedTool === 'git_lfs') tips.push(`💡 ${t('tipNeedGitLfs')}`);
    if (selectedTool === 'python') tips.push(`💡 ${t('tipNeedHuggingfaceHub')}`);
    if (selectedMirror === 'hf-mirror') tips.push(`🌐 ${t('tipMirrorCommunity')}`);
    if (selectedMirror === 'modelscope') tips.push(`🌐 ${t('tipModelScopeDiff')}`);
    if (modelInfo && modelInfo.isGated && !hfToken) tips.push(`⚠️ ${t('tipNeedToken')}`);

    const allOn = Object.values(fileFilters).every(v => v);
    if (!allOn) tips.push(`📁 ${t('tipFileFilter')}`);
    if (platform === 'windows') tips.push(`🖥️ ${t('tipWindowsPowerShell')}`);

    return tips.join('\n');
  },

  getModelSizeText() {
    const { modelInfo } = this.state;
    if (!modelInfo || !modelInfo.files || modelInfo.files.length === 0) {
      return t('unknownSize');
    }
    const totalBytes = modelInfo.files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (totalBytes === 0) return t('unknownSize');
    if (totalBytes >= 1024 * 1024 * 1024) {
      return `~${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    }
    if (totalBytes >= 1024 * 1024) {
      return `~${(totalBytes / (1024 * 1024)).toFixed(0)}MB`;
    }
    return `~${(totalBytes / 1024).toFixed(0)}KB`;
  },

  buildHTML() {
    const { modelInfo, selectedTool, selectedMirror, advancedOpen, fileFilters, localDir, hfToken } = this.state;

    let html = '';

    // ① Model Info Bar
    if (modelInfo) {
      html += `<div class="hf-download-model-info">
          <strong>${modelInfo.modelId}</strong> · ${this.getModelSizeText()}
        </div>`;
    }

    // ② Recommended Solution Card
    const recommended = this.recommendTool();
    const recCmd = this.buildCommand(recommended.tool, recommended.mirror || selectedMirror, { isRecommended: true });
    html += `<div class="hf-assistant-card" style="border-color:#2563eb;">
        <div class="hf-assistant-card-title" style="color:#2563eb;">⭐ ${t('recommendedSolution')}</div>
        <div class="hf-assistant-command" style="position:relative;padding-bottom:36px;margin-bottom:8px;">
          <span style="white-space:pre-wrap;word-break:break-all;">${this.escapeHtml(recCmd)}</span>
          <div style="position:absolute;bottom:6px;right:6px;display:flex;gap:4px;">
            <button class="hf-assistant-command-copy" data-action="copy-recommended">${t('copy')}</button>
          </div>
        </div>
        <div style="font-size:11px;color:#3b82f6;line-height:1.6;">
          <div>💡 ${t('recommendedFor')}: ${recommended.reason}</div>
          <div>⚠️ ${t('prerequisite')}: ${t('tipNeedHuggingfaceHub')}</div>
        </div>
      </div>`;

    // ③ Tool + Mirror card
    html += `<div class="hf-assistant-card">`;
    html += `<div class="hf-assistant-card-title" style="margin-bottom:10px;">${t('downloadTool')}</div>`;
    html += `<div class="hf-download-segmented">`;
    Object.values(this.tools).forEach(tool => {
      const active = selectedTool === tool.id ? 'active' : '';
      html += `<button class="hf-download-segment ${active}" data-tool="${tool.id}" title="${tool.desc}">${tool.label}</button>`;
    });
    html += `</div>`;

    // Network Settings
    html += `<div class="hf-download-mirror-row" style="margin-bottom:0;">
        <span class="hf-assistant-label">${t('networkSettings')}</span>
        <select class="hf-assistant-select" id="dl-mirror-select" style="margin-bottom:0;">
          <option value="hf-mirror" ${selectedMirror === 'hf-mirror' ? 'selected' : ''}>${t('mirrorHfMirror')}</option>
          <option value="official" ${selectedMirror === 'official' ? 'selected' : ''}>${t('official')}</option>
          <option value="modelscope" ${selectedMirror === 'modelscope' ? 'selected' : ''}>${t('modelscope')}</option>
        </select>
      </div>`;

    // ModelScope warning (inside card)
    if (selectedMirror === 'modelscope' && modelInfo && !modelInfo.modelscopeUrl) {
      html += `<div class="hf-download-tip warning" style="margin-top:10px;margin-bottom:0;">⚠️ ${t('modelscopeNotAvailable')}。${t('modelscopeFallback')}。</div>`;
    }

    html += `</div>`; // end tool + mirror card

    // ④ Advanced Options card
    html += `<div class="hf-assistant-card">`;
    html += `<button class="hf-download-advanced-toggle" id="dl-advanced-toggle" style="padding:0;">
        <span style="font-size:10px;">${advancedOpen ? '▲' : '▼'}</span> ${t('advancedOptions')}
      </button>
      <div class="hf-download-advanced-content ${advancedOpen ? 'open' : ''}" id="dl-advanced-content">`;

    // File Filtering
    const filtersDisabled = selectedTool === 'git_lfs';
    html += `<div class="hf-assistant-param-group" style="margin-top:8px;">${t('fileFiltering')}</div>`;
    if (filtersDisabled) {
      html += `<div class="hf-download-filter-note">${t('gitLfsNoFilter')}</div>`;
    }
    html += `<div class="hf-download-file-filters">`;
    const filterItems = [
      { key: 'safetensors', label: '.safetensors' },
      { key: 'pytorch', label: '.bin' },
      { key: 'config', label: 'config.json' },
      { key: 'tokenizer', label: 'tokenizer' },
      { key: 'gguf', label: '.gguf' },
      { key: 'other', label: t('allFiles') }
    ];
    filterItems.forEach(item => {
      const checked = fileFilters[item.key] ? 'checked' : '';
      html += `<label class="hf-download-file-filter ${filtersDisabled ? 'disabled' : ''}">
          <input type="checkbox" data-filter="${item.key}" ${checked} ${filtersDisabled ? 'disabled' : ''}>
          <span>${item.label}</span>
        </label>`;
    });
    html += `</div>`;

    // Local Directory
    html += `<div class="hf-assistant-label" style="margin-top:8px;">${t('localDirectory')}</div>
        <input type="text" class="hf-assistant-input" id="dl-local-dir" value="${this.escapeHtml(localDir)}" style="margin-bottom:0;">`;

    // Authentication (for gated models)
    if (modelInfo && modelInfo.isGated) {
      html += `<div class="hf-assistant-param-group">${t('authentication')}</div>
          <div class="hf-assistant-label">${t('gatedModelTokenHint')}</div>
          <input type="password" class="hf-assistant-input" id="dl-hf-token" placeholder="${t('howToUseToken')}" value="${this.escapeHtml(hfToken)}" style="margin-bottom:0;">`;
    }

    html += `</div></div>`; // end advanced content + card

    // ⑤ Generated Command Block
    const customCmd = this.buildCommand(selectedTool, selectedMirror);
    html += `<div class="hf-assistant-card">
        <div class="hf-assistant-card-title" style="margin-bottom:10px;">${t('generatedCommand')}</div>
        <div class="hf-assistant-command" style="position:relative;padding-bottom:36px;margin-bottom:8px;">
          <span style="white-space:pre-wrap;word-break:break-all;">${this.escapeHtml(customCmd)}</span>
          <div style="position:absolute;bottom:6px;right:6px;display:flex;gap:4px;">
            <button class="hf-assistant-command-copy" data-action="copy-custom">${t('copy')}</button>
            <button class="hf-assistant-command-copy" data-action="open-terminal" style="right:44px;">${t('openInTerminal')}</button>
          </div>
        </div>`;

    // Dynamic Tips
    const tipText = this.getTip();
    if (tipText) {
      html += `<div class="hf-download-tip" style="margin-top:0;">${this.escapeHtml(tipText).replace(/\n/g, '<br>')}</div>`;
    }

    html += `</div>`; // end command card

    return html;
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  bindEvents(container) {
    // Tool segments
    container.querySelectorAll('.hf-download-segment').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.selectedTool = btn.dataset.tool;
        this.refreshUI(container);
      });
    });

    // Mirror select
    const mirrorSelect = container.querySelector('#dl-mirror-select');
    if (mirrorSelect) {
      mirrorSelect.addEventListener('change', (e) => {
        this.state.selectedMirror = e.target.value;
        this.refreshUI(container);
      });
    }

    // Advanced toggle
    const advToggle = container.querySelector('#dl-advanced-toggle');
    if (advToggle) {
      advToggle.addEventListener('click', () => {
        this.state.advancedOpen = !this.state.advancedOpen;
        this.refreshUI(container);
      });
    }

    // File filters
    container.querySelectorAll('[data-filter]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        this.state.fileFilters[e.target.dataset.filter] = e.target.checked;
        this.refreshUI(container);
      });
    });

    // Local dir
    const dirInput = container.querySelector('#dl-local-dir');
    if (dirInput) {
      dirInput.addEventListener('change', (e) => {
        this.state.localDir = e.target.value;
        this.refreshUI(container);
      });
    }

    // HF Token
    const tokenInput = container.querySelector('#dl-hf-token');
    if (tokenInput) {
      tokenInput.addEventListener('change', (e) => {
        this.state.hfToken = e.target.value;
        this.refreshUI(container);
      });
    }

    // Copy recommended
    const copyRec = container.querySelector('[data-action="copy-recommended"]');
    if (copyRec) {
      copyRec.addEventListener('click', () => {
        const recommended = this.recommendTool();
        const cmd = this.buildCommand(recommended.tool, recommended.mirror || this.state.selectedMirror);
        navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
      });
    }

    // Copy custom
    const copyCustom = container.querySelector('[data-action="copy-custom"]');
    if (copyCustom) {
      copyCustom.addEventListener('click', () => {
        const cmd = container.querySelector('#dl-custom-cmd').textContent;
        navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
      });
    }

    // Open in terminal (one-liner)
    const openTerm = container.querySelector('[data-action="open-terminal"]');
    if (openTerm) {
      openTerm.addEventListener('click', () => {
        const cmd = this.buildCommand(this.state.selectedTool, this.state.selectedMirror);
        const oneLiner = cmd.replace(/\n/g, ' && ');
        navigator.clipboard.writeText(oneLiner).then(() => Sidebar.showToast(t('copied')));
      });
    }
  },

  refreshUI(container) {
    // Re-render only the dynamic parts to avoid full DOM rebuild
    // For simplicity, we re-render the whole tab
    container.innerHTML = this.buildHTML();
    this.bindEvents(container);
  }
};
