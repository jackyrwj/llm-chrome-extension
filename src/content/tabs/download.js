const DownloadTab = {
  state: {
    modelInfo: null,
    settings: null,
    selectedTool: 'hf_cli',
    selectedMirror: 'hf-mirror',
    advancedOpen: false,
    fileFilters: {
      safetensors: true,
      bin: true,
      gguf: true,
      config: true,
      tokenizer: true,
    },
    localDir: '',
    hfToken: '',
  },

  TOOLS: [
    { id: 'hf_cli',  label: 'huggingface-cli' },
    { id: 'git_lfs', label: 'git-lfs' },
    { id: 'python',  label: 'Python' },
    { id: 'browser', label: '浏览器' },
  ],

  MIRRORS: [
    { id: 'hf-mirror',  label: 'hf-mirror.com（推荐）' },
    { id: 'official',   label: '官方 huggingface.co' },
    { id: 'modelscope', label: 'ModelScope' },
  ],

  async render(container, modelInfo) {
    this.state.modelInfo = modelInfo;
    this.state.settings = await Storage.getAll();
    this.state.selectedMirror = this.state.settings.preferredMirror || 'hf-mirror';
    this.state.localDir = modelInfo
      ? './' + modelInfo.modelId.replace(/\//g, '_')
      : './model';

    container.innerHTML = this.buildHTML();
    this.bindEvents(container);
  },

  getMirrorBase(mirror, tool) {
    if (mirror === 'official')   return 'https://huggingface.co';
    if (mirror === 'hf-mirror')  return 'https://hf-mirror.com';
    if (mirror === 'modelscope') {
      return tool === 'git_lfs' ? 'https://www.modelscope.cn/models' : 'https://www.modelscope.cn';
    }
    return 'https://huggingface.co';
  },

  buildEnvLine(mirrorBase, platform) {
    if (!mirrorBase || mirrorBase === 'https://huggingface.co') return '';
    return platform === 'windows'
      ? `$env:HF_ENDPOINT="${mirrorBase}"`
      : `export HF_ENDPOINT=${mirrorBase}`;
  },

  getPlatform() {
    return (navigator.platform || '').includes('Win') ? 'windows' : 'unix';
  },

  buildCommand() {
    const { modelInfo, selectedTool, selectedMirror, localDir, hfToken, fileFilters } = this.state;
    if (!modelInfo) return '';
    const modelId = modelInfo.modelId;
    const platform = this.getPlatform();
    const mirrorBase = this.getMirrorBase(selectedMirror, selectedTool);

    if (selectedTool === 'hf_cli') {
      const parts = [];
      const env = this.buildEnvLine(mirrorBase, platform);
      if (env) parts.push('$ ' + env);

      let cmd = `$ huggingface-cli download ${modelId}`;
      if (localDir) cmd += ` \\\n  --local-dir ${localDir}`;

      const allOn = Object.values(fileFilters).every(v => v);
      if (!allOn) {
        const includes = [];
        if (fileFilters.safetensors) includes.push('*.safetensors');
        if (fileFilters.bin)         includes.push('*.bin');
        if (fileFilters.gguf)        includes.push('*.gguf');
        if (fileFilters.config)      includes.push('config.json');
        if (fileFilters.tokenizer)   includes.push('tokenizer*');
        if (includes.length) cmd += ` \\\n  --include "${includes.join('" "')}"`;
      }
      if (hfToken) cmd += ` \\\n  --token ${hfToken}`;
      parts.push(cmd);
      return parts.join('\n');
    }

    if (selectedTool === 'git_lfs') {
      const repoUrl = selectedMirror === 'modelscope' && modelInfo.modelscopeUrl
        ? modelInfo.modelscopeUrl
        : `${mirrorBase}/${modelId}`;
      const skipLine = platform === 'windows'
        ? '$ $env:GIT_LFS_SKIP_SMUDGE="1"'
        : '$ GIT_LFS_SKIP_SMUDGE=1';
      return `${skipLine}\n$ git clone ${repoUrl}.git`;
    }

    if (selectedTool === 'python') {
      let code = '';
      if (mirrorBase !== 'https://huggingface.co') {
        code += `import os\nos.environ["HF_ENDPOINT"] = "${mirrorBase}"\n\n`;
      }
      code += `from huggingface_hub import snapshot_download\n\n`;
      code += `snapshot_download(\n    repo_id="${modelId}"`;
      if (localDir) code += `,\n    local_dir="${localDir}"`;
      if (hfToken)  code += `,\n    token="${hfToken}"`;
      code += '\n)';
      return code;
    }

    if (selectedTool === 'browser') {
      return `${mirrorBase}/${modelId}/tree/main`;
    }

    return '';
  },

  getTips() {
    const { selectedTool, selectedMirror, modelInfo, hfToken, fileFilters } = this.state;
    const tips = [];
    if (selectedTool === 'hf_cli')   tips.push('💡 前置条件：pip install huggingface_hub');
    if (selectedTool === 'git_lfs')  tips.push('💡 前置条件：需安装 git-lfs');
    if (selectedTool === 'python')   tips.push('💡 前置条件：pip install huggingface_hub');
    if (selectedTool === 'browser')  tips.push('💡 在浏览器中打开文件列表，手动下载所需文件');
    if (selectedMirror === 'hf-mirror') tips.push('🌐 使用社区镜像，国内访问较快');
    if (selectedMirror === 'modelscope' && modelInfo && !modelInfo.modelscopeUrl)
      tips.push('⚠️ 该模型在 ModelScope 上未找到对应版本，已回退到 hf-mirror');
    if (modelInfo && modelInfo.isGated && !hfToken)
      tips.push('⚠️ 该模型需要授权，请在高级选项中填写 HF Token');
    if (!Object.values(fileFilters).every(v => v))
      tips.push('📁 已启用文件过滤，仅下载选中类型');
    return tips;
  },

  getModelSizeText() {
    const { modelInfo } = this.state;
    if (!modelInfo || !modelInfo.files || modelInfo.files.length === 0) return '大小未知';
    const totalBytes = modelInfo.files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (totalBytes === 0) return '大小未知';
    if (totalBytes >= 1024 ** 3) return `~${(totalBytes / 1024 ** 3).toFixed(1)} GB`;
    if (totalBytes >= 1024 ** 2) return `~${(totalBytes / 1024 ** 2).toFixed(0)} MB`;
    return `~${(totalBytes / 1024).toFixed(0)} KB`;
  },

  esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  buildHTML() {
    const { modelInfo, selectedTool, selectedMirror, advancedOpen, fileFilters, localDir, hfToken } = this.state;
    const toolLabel = this.TOOLS.find(t => t.id === selectedTool)?.label || selectedTool;
    const cmd = this.buildCommand();
    const tips = this.getTips();

    const toolBtns = this.TOOLS.map(tool => {
      const active = selectedTool === tool.id ? 'active' : '';
      return `<button class="hf-download-segment ${active}" data-tool="${tool.id}">${tool.label}</button>`;
    }).join('');

    const mirrorOpts = this.MIRRORS.map(m =>
      `<option value="${m.id}" ${selectedMirror === m.id ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    const filterItems = [
      { key: 'safetensors', label: '.safetensors' },
      { key: 'bin',         label: '.bin' },
      { key: 'gguf',        label: '.gguf' },
      { key: 'config',      label: 'config.json' },
      { key: 'tokenizer',   label: 'tokenizer' },
    ];
    const filtersDisabled = selectedTool === 'git_lfs';
    const filterHTML = filterItems.map(item => `
      <label class="hf-download-file-filter ${filtersDisabled ? 'disabled' : ''}">
        <input type="checkbox" data-filter="${item.key}"
          ${fileFilters[item.key] ? 'checked' : ''} ${filtersDisabled ? 'disabled' : ''}>
        <span>${item.label}</span>
      </label>`).join('');

    const tipsHTML = tips.length
      ? `<div style="margin-top:8px;font-size:11px;color:#6b7280;line-height:1.7;">${tips.map(this.esc.bind(this)).join('<br>')}</div>`
      : '';

    const msWarning = selectedMirror === 'modelscope' && modelInfo && !modelInfo.modelscopeUrl
      ? `<div style="font-size:11px;color:#ca8a04;margin-top:4px;">⚠️ 该模型在 ModelScope 上未找到，命令已自动回退到 hf-mirror</div>`
      : '';

    const tokenRow = modelInfo && modelInfo.isGated
      ? `<div style="margin-top:8px;">
           <label class="hf-assistant-label" style="margin-bottom:4px;">HF Token（授权模型必填）</label>
           <input type="password" class="hf-assistant-input" id="dl-hf-token"
             placeholder="hf_xxxx" value="${this.esc(hfToken)}" style="margin-bottom:0;">
         </div>`
      : '';

    return `
      ${modelInfo ? `<div class="hf-download-model-info"><strong>${this.esc(modelInfo.modelId)}</strong> · ${this.getModelSizeText()}</div>` : ''}

      <div class="hf-assistant-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <div class="hf-assistant-card-title" style="margin:0;">命令 · ${toolLabel}</div>
          <button type="button" class="hf-assistant-inline-action" id="dl-copy-btn">复制</button>
        </div>
        <div class="hf-assistant-command">
          <span id="dl-command-text" style="display:block;white-space:pre-wrap;word-break:break-all;font-size:10px;line-height:1.6;">${this.esc(cmd)}</span>
        </div>
        ${tipsHTML}
      </div>

      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title" style="margin-bottom:10px;">配置</div>

        <div style="margin-bottom:10px;">
          <label class="hf-assistant-label" style="margin-bottom:4px;">下载工具</label>
          <div class="hf-download-segmented">${toolBtns}</div>
        </div>

        <div style="margin-bottom:8px;">
          <label class="hf-assistant-label" style="margin-bottom:4px;">网络 / 镜像</label>
          <select class="hf-assistant-select" id="dl-mirror-select" style="margin-bottom:0;">${mirrorOpts}</select>
          ${msWarning}
        </div>

        <div style="margin-bottom:6px;">
          <label class="hf-assistant-label" style="margin-bottom:4px;">本地目录</label>
          <input type="text" class="hf-assistant-input" id="dl-local-dir"
            value="${this.esc(localDir)}" style="margin-bottom:0;">
        </div>

        <details id="dl-advanced" ${advancedOpen ? 'open' : ''} style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:#6b7280;user-select:none;padding:4px 0;list-style:none;display:flex;align-items:center;gap:4px;">
            <span id="dl-adv-arrow" style="display:inline-block;transition:transform 0.15s;${advancedOpen ? 'transform:rotate(90deg)' : ''}">▶</span>
            高级选项
          </summary>
          <div style="padding-top:8px;">
            <label class="hf-assistant-label" style="margin-bottom:6px;">
              文件类型过滤${filtersDisabled ? '（git-lfs 不支持）' : ''}
            </label>
            <div class="hf-download-file-filters">${filterHTML}</div>
            ${tokenRow}
          </div>
        </details>
      </div>
    `;
  },

  bindEvents(container) {
    container.querySelectorAll('.hf-download-segment').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.selectedTool = btn.dataset.tool;
        this.refresh(container);
      });
    });

    const mirror = container.querySelector('#dl-mirror-select');
    if (mirror) mirror.addEventListener('change', e => {
      this.state.selectedMirror = e.target.value;
      this.refresh(container);
    });

    const dirInput = container.querySelector('#dl-local-dir');
    if (dirInput) dirInput.addEventListener('input', e => {
      this.state.localDir = e.target.value;
      this.updateCommand(container);
    });

    const tokenInput = container.querySelector('#dl-hf-token');
    if (tokenInput) tokenInput.addEventListener('input', e => {
      this.state.hfToken = e.target.value;
      this.updateCommand(container);
    });

    container.querySelectorAll('[data-filter]').forEach(cb => {
      cb.addEventListener('change', e => {
        this.state.fileFilters[e.target.dataset.filter] = e.target.checked;
        this.updateCommand(container);
      });
    });

    const details = container.querySelector('#dl-advanced');
    const arrow = container.querySelector('#dl-adv-arrow');
    if (details) details.addEventListener('toggle', () => {
      this.state.advancedOpen = details.open;
      if (arrow) arrow.style.transform = details.open ? 'rotate(90deg)' : '';
    });

    const copyBtn = container.querySelector('#dl-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.buildCommand())
        .then(() => Sidebar.showToast(t('copied')));
    });
  },

  updateCommand(container) {
    const el = container.querySelector('#dl-command-text');
    if (el) el.textContent = this.buildCommand();
  },

  refresh(container) {
    container.innerHTML = this.buildHTML();
    this.bindEvents(container);
  },
};
