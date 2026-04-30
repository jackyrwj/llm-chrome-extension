const Sidebar = {
  container: null,
  shadowRoot: null,
  isOpen: true,
  currentTab: 'overview',
  modelInfo: null,

  async init() {
    const settings = await Storage.getAll();
    this.isOpen = settings.sidebarDefaultOpen !== false;
    this.currentTab = 'overview';

    this.createSidebar();
    this.bindEvents();

    if (!this.isOpen) {
      this.collapse();
    }
  },

  createSidebar() {
    const wrapper = document.createElement('div');
    wrapper.id = 'hf-assistant-wrapper';

    this.shadowRoot = wrapper.attachShadow({ mode: 'open' });

    const template = `
      <style>${this.getStyles()}</style>
      <div id="hf-assistant-sidebar" class="hf-assistant-sidebar">
        <div class="hf-assistant-header">
          <span class="hf-assistant-title">🤖 <span data-i18n="sidebarTitle">模型助手</span></span>
          <div class="hf-assistant-actions">
            <button class="hf-assistant-btn" id="hf-settings-btn" title="设置">⚙️</button>
            <button class="hf-assistant-btn" id="hf-assistant-toggle" title="折叠">✕</button>
          </div>
        </div>
        <div class="hf-assistant-tabs">
          <button class="hf-assistant-tab active" data-tab="overview" data-i18n="tabOverview">概览</button>
          <button class="hf-assistant-tab" data-tab="deploy" data-i18n="tabDeploy">部署</button>
          <button class="hf-assistant-tab" data-tab="download" data-i18n="tabDownload">下载</button>
          <button class="hf-assistant-tab" data-tab="favorites" data-i18n="tabFavorites">收藏</button>
          <button class="hf-assistant-tab" data-tab="recommend" data-i18n="tabRecommend">推荐</button>
        </div>
        <div class="hf-assistant-content">
          <div class="hf-assistant-panel active" id="panel-overview"></div>
          <div class="hf-assistant-panel" id="panel-deploy"></div>
          <div class="hf-assistant-panel" id="panel-download"></div>
          <div class="hf-assistant-panel" id="panel-favorites"></div>
          <div class="hf-assistant-panel" id="panel-recommend"></div>
          <div class="hf-assistant-panel" id="panel-settings"></div>
        </div>
        <div class="hf-assistant-toast" id="hf-assistant-toast"></div>
      </div>
      <div id="hf-assistant-collapsed" class="hf-assistant-collapsed" style="display: none;">
        <button class="hf-assistant-expand-btn" title="展开">🤖</button>
      </div>
    `;

    this.shadowRoot.innerHTML = template;
    this.container = wrapper;
    document.body.appendChild(wrapper);
  },

  getStyles() {
    return `
      .hf-assistant-sidebar {
        position: fixed; top: 0; right: 0; width: 360px; height: 100vh;
        background: #ffffff; border-left: 1px solid #e5e7eb;
        box-shadow: -2px 0 8px rgba(0,0,0,0.08); z-index: 99999;
        display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px; line-height: 1.5; color: #1f2937;
        transition: transform 0.3s ease;
      }
      .hf-assistant-sidebar.collapsed { transform: translateX(100%); }
      .hf-assistant-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;
      }
      .hf-assistant-title { font-weight: 600; font-size: 14px; }
      .hf-assistant-actions { display: flex; gap: 4px; }
      .hf-assistant-btn {
        background: transparent; border: none; cursor: pointer;
        padding: 4px 8px; border-radius: 4px; font-size: 14px;
      }
      .hf-assistant-btn:hover { background: #e5e7eb; }
      .hf-assistant-tabs {
        display: flex; border-bottom: 1px solid #e5e7eb; background: #ffffff;
      }
      .hf-assistant-tab {
        flex: 1; padding: 10px 8px; border: none; background: transparent;
        cursor: pointer; font-size: 12px; font-weight: 500; color: #6b7280;
        border-bottom: 2px solid transparent;
      }
      .hf-assistant-tab:hover { color: #374151; background: #f9fafb; }
      .hf-assistant-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
      .hf-assistant-content { flex: 1; overflow-y: auto; }
      .hf-assistant-panel { display: none; padding: 16px; }
      .hf-assistant-panel.active { display: block; }
      .hf-assistant-collapsed {
        position: fixed; top: 80px; right: 0; z-index: 99999;
      }
      .hf-assistant-expand-btn {
        width: 40px; height: 40px; background: #ffffff; border: 1px solid #e5e7eb;
        border-right: none; border-radius: 8px 0 0 8px; cursor: pointer;
        font-size: 18px; box-shadow: -2px 0 8px rgba(0,0,0,0.08);
      }
      .hf-assistant-toast {
        position: absolute; bottom: 16px; left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #1f2937; color: #ffffff; padding: 8px 16px;
        border-radius: 6px; font-size: 12px; opacity: 0;
        transition: all 0.3s ease; pointer-events: none;
      }
      .hf-assistant-toast.show {
        transform: translateX(-50%) translateY(0); opacity: 1;
      }
      .hf-assistant-card {
        background: #f9fafb; border: 1px solid #e5e7eb;
        border-radius: 8px; padding: 12px; margin-bottom: 12px;
      }
      .hf-assistant-card-title {
        font-weight: 600; font-size: 12px; color: #374151;
        margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .hf-assistant-inline-action {
        border: none; background: transparent; color: #2563eb;
        font-size: 11px; font-weight: 500; cursor: pointer;
        padding: 0; white-space: nowrap;
      }
      .hf-assistant-inline-action:hover {
        color: #1d4ed8; text-decoration: underline;
      }
      .hf-assistant-select, .hf-assistant-input {
        width: 100%; padding: 6px 8px; border: 1px solid #d1d5db;
        border-radius: 6px; font-size: 12px; background: #ffffff; margin-bottom: 8px;
      }
      .hf-assistant-label {
        display: block; font-size: 11px; font-weight: 500;
        color: #6b7280; margin-bottom: 4px;
      }
      .hf-assistant-command {
        background: #1f2937; color: #e5e7eb; padding: 12px;
        border-radius: 6px; font-family: monospace; font-size: 11px;
        line-height: 1.6; overflow-x: auto; white-space: normal;
        word-break: break-all; position: relative;
      }
      #command-text {
        display: block;
        white-space: pre-wrap;
      }
      .hf-assistant-command-copy {
        position: absolute; top: 8px; right: 8px;
        background: #374151; color: #ffffff; border: none;
        padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
      }
      .hf-assistant-command-copy:hover { background: #4b5563; }
      .hf-assistant-status-ok { color: #16a34a; }
      .hf-assistant-status-warning { color: #ca8a04; }
      .hf-assistant-status-insufficient { color: #dc2626; }
      .hf-assistant-link { color: #2563eb; text-decoration: none; }
      .hf-assistant-link:hover { text-decoration: underline; }
      .hf-assistant-history-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px; background: #f9fafb; border-radius: 6px;
        margin-bottom: 6px; font-size: 11px;
      }
      .hf-assistant-history-cmd {
        flex: 1; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; margin-right: 8px; font-family: monospace;
      }
      .settings-active { color: #2563eb; background: #eff6ff !important; }
      .hf-settings-section { margin-bottom: 20px; }
      .hf-settings-section-title {
        font-size: 10px; font-weight: 600; color: #9ca3af;
        text-transform: uppercase; letter-spacing: 0.6px;
        margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;
      }
      .hf-settings-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 10px; gap: 8px;
      }
      .hf-settings-label { font-size: 12px; color: #374151; flex: 1; }
      .hf-settings-ctrl { flex-shrink: 0; }
    `;
  },

  bindEvents() {
    const root = this.shadowRoot;

    root.querySelectorAll('.hf-assistant-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    root.querySelector('#hf-assistant-toggle').addEventListener('click', () => {
      this.collapse();
    });

    root.querySelector('.hf-assistant-expand-btn').addEventListener('click', () => {
      this.expand();
    });

    root.querySelector('#hf-settings-btn').addEventListener('click', () => {
      if (this.currentTab === 'settings') {
        this.switchTab(this._prevTab || 'overview');
      } else {
        this._prevTab = this.currentTab;
        this.switchTab('settings');
      }
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const root = this.shadowRoot;
    const isSettings = tabName === 'settings';

    // 设置图标激活状态
    root.querySelector('#hf-settings-btn').classList.toggle('settings-active', isSettings);

    // 普通 tab 仅在非设置模式下高亮
    root.querySelectorAll('.hf-assistant-tab').forEach(t => {
      t.classList.toggle('active', !isSettings && t.dataset.tab === tabName);
    });

    root.querySelectorAll('.hf-assistant-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tabName}`);
    });

    const modelOnlyTabs = ['overview', 'deploy', 'download'];
    if (modelOnlyTabs.includes(tabName) && !this.modelInfo) {
      this.renderNoModelPlaceholder(this.getPanel(tabName));
      return;
    }

    if (tabName === 'overview' && typeof OverviewTab !== 'undefined') {
      OverviewTab.render(this.getPanel('overview'), this.modelInfo);
    } else if (tabName === 'deploy' && typeof DeployTab !== 'undefined') {
      DeployTab.render(this.getPanel('deploy'), this.modelInfo);
    } else if (tabName === 'download' && typeof DownloadTab !== 'undefined') {
      DownloadTab.render(this.getPanel('download'), this.modelInfo);
    } else if (tabName === 'favorites' && typeof FavoritesTab !== 'undefined') {
      FavoritesTab.render(this.getPanel('favorites'));
    } else if (tabName === 'recommend' && typeof RecommendTab !== 'undefined') {
      RecommendTab.render(this.getPanel('recommend'), this.modelInfo);
    } else if (tabName === 'settings') {
      this.renderSettings(this.getPanel('settings'));
    }
  },

  renderNoModelPlaceholder(panel) {
    panel.innerHTML = `
      <div class="hf-assistant-card" style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 32px; margin-bottom: 12px;">📄</div>
        <div style="font-size: 13px; color: #374151; font-weight: 500; margin-bottom: 8px;">${t('viewOnModelPage')}</div>
        <div style="font-size: 11px; color: #6b7280;">${t('viewOnModelPageDesc')}</div>
      </div>
    `;
  },

  collapse() {
    this.isOpen = false;
    this.shadowRoot.querySelector('.hf-assistant-sidebar').classList.add('collapsed');
    this.shadowRoot.querySelector('.hf-assistant-collapsed').style.display = 'block';
  },

  expand() {
    this.isOpen = true;
    this.shadowRoot.querySelector('.hf-assistant-sidebar').classList.remove('collapsed');
    this.shadowRoot.querySelector('.hf-assistant-collapsed').style.display = 'none';
  },

  getPanel(name) {
    return this.shadowRoot.querySelector(`#panel-${name}`);
  },

  async renderSettings(panel) {
    const settings = await Storage.getAll();

    const row = (label, control) => `
      <div class="hf-settings-row">
        <span class="hf-settings-label">${label}</span>
        ${control}
      </div>`;

    const sel = (id, opts, val) => `
      <select class="hf-settings-ctrl hf-assistant-select" id="${id}" style="width:140px;margin:0;">
        ${opts.map(([v, l]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>`;

    panel.innerHTML = `
      <div class="hf-settings-section">
        <div class="hf-settings-section-title">通用</div>
        ${row('默认部署工具', sel('s-default-tool', [
          ['ollama','Ollama'],['vllm','vLLM'],['sglang','SGLang'],
          ['llamacpp','llama.cpp'],['transformers','Transformers'],['tgi','TGI']
        ], settings.defaultTool))}
        ${row('我的显存', `<div style="display:flex;align-items:center;gap:4px;">
          <input type="number" id="s-vram-gb" class="hf-settings-ctrl hf-assistant-input"
            style="width:72px;margin:0;text-align:right;" value="${settings.vramGB}" min="1" max="9999">
          <span style="font-size:12px;color:#6b7280;">GB</span>
        </div>`)}
        ${row('GPU 数量', `<div style="display:flex;align-items:center;gap:4px;">
          <input type="number" id="s-gpu-count" class="hf-settings-ctrl hf-assistant-input"
            style="width:72px;margin:0;text-align:right;" value="${settings.gpuCount}" min="1" max="16">
          <span style="font-size:12px;color:#6b7280;">张</span>
        </div>`)}
        ${row('推荐精度', sel('s-recommend-precision', [
          ['fp16','FP16'],['int8','INT8'],['int4','INT4'],['q4','Q4']
        ], settings.recommendPrecision))}
        ${row('首选镜像站', sel('s-mirror', [
          ['hf-mirror','hf-mirror.com'],['modelscope','ModelScope']
        ], settings.preferredMirror))}
        ${row('界面语言', sel('s-language', [
          ['zh','中文'],['en','English']
        ], settings.language))}
        <div class="hf-settings-row">
          <span class="hf-settings-label">自动展开侧边栏</span>
          <input type="checkbox" id="s-sidebar-open" class="hf-settings-ctrl" ${settings.sidebarDefaultOpen ? 'checked' : ''}>
        </div>
      </div>

      <div class="hf-settings-section">
        <div class="hf-settings-section-title">翻译</div>
        ${row('翻译服务', sel('s-trans-provider', [
          ['none','不使用'],['google_free','Google（免费）'],
          ['deepl','DeepL'],['openai','OpenAI']
        ], settings.translationProvider))}
        <div id="s-apikey-row" style="${['deepl','openai'].includes(settings.translationProvider) ? '' : 'display:none;'}">
          ${row('API Key', `<input type="password" id="s-apikey" class="hf-settings-ctrl hf-assistant-input"
            style="width:140px;margin:0;" placeholder="输入 API Key" value="${settings.translationApiKey || ''}">`)}
        </div>
      </div>

      <div style="margin-top:4px;padding-top:12px;border-top:1px solid #e5e7eb;">
        <div style="font-size:10px;color:#9ca3af;text-align:center;">修改即时生效，无需保存</div>
      </div>
    `;

    const save = (key, val) => Storage.setMultiple({ [key]: val });

    panel.querySelector('#s-default-tool').addEventListener('change', e => save('defaultTool', e.target.value));
    panel.querySelector('#s-vram-gb').addEventListener('change', e => save('vramGB', Math.max(1, parseInt(e.target.value) || 64)));
    panel.querySelector('#s-gpu-count').addEventListener('change', e => save('gpuCount', Math.max(1, parseInt(e.target.value) || 1)));
    panel.querySelector('#s-recommend-precision').addEventListener('change', e => save('recommendPrecision', e.target.value));
    panel.querySelector('#s-mirror').addEventListener('change', e => save('preferredMirror', e.target.value));
    panel.querySelector('#s-language').addEventListener('change', e => save('language', e.target.value));
    panel.querySelector('#s-sidebar-open').addEventListener('change', e => save('sidebarDefaultOpen', e.target.checked));

    const providerSel = panel.querySelector('#s-trans-provider');
    const apikeyRow = panel.querySelector('#s-apikey-row');
    providerSel.addEventListener('change', e => {
      save('translationProvider', e.target.value);
      apikeyRow.style.display = ['deepl', 'openai'].includes(e.target.value) ? '' : 'none';
    });
    panel.querySelector('#s-apikey').addEventListener('change', e => save('translationApiKey', e.target.value));
  },

  showToast(message) {
    const toast = this.shadowRoot.querySelector('#hf-assistant-toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  },

  setModelInfo(info) {
    this.modelInfo = info;
    this.switchTab(this.currentTab);
  }
};
