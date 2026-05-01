const Sidebar = {
  container: null,
  shadowRoot: null,
  isOpen: true,
  currentTab: 'overview',
  modelInfo: null,
  currentWidth: 360,
  layoutStyleEl: null,

  async init() {
    const settings = await Storage.getAll();
    this.isOpen = settings.sidebarDefaultOpen !== false;
    this.currentTab = 'overview';
    this.currentWidth = settings.sidebarWidth || 360;

    this.createSidebar();
    this.ensurePageLayoutStyles();
    this.bindEvents();
    this.bindResizeDrag();
    window.addEventListener('resize', () => this.updatePageMargin(this.currentWidth));

    if (!this.isOpen) {
      this.collapse();
    }
    this.updatePageMargin(this.currentWidth);
  },

  createSidebar() {
    const wrapper = document.createElement('div');
    wrapper.id = 'hf-assistant-wrapper';

    this.shadowRoot = wrapper.attachShadow({ mode: 'open' });

    const template = `
      <style>${this.getStyles()}</style>
      <div id="hf-assistant-sidebar" class="hf-assistant-sidebar" style="width:${this.currentWidth}px;">
        <div class="hf-assistant-resize-handle" id="hf-resize-handle"></div>
        <div class="hf-assistant-header">
          <span class="hf-assistant-title">🤖 <span data-i18n="sidebarTitle">模型助手</span></span>
          <div class="hf-assistant-actions">
            <span id="hf-favorites-btn" style="cursor:pointer;font-size:12px;color:#4b5563;padding:4px 8px;border-radius:4px;transition:all 0.2s;user-select:none;">☆ 我的收藏</span>
            <button class="hf-assistant-btn" id="hf-assistant-toggle" title="折叠">✕</button>
          </div>
        </div>
        <div class="hf-assistant-tabs">
          <button class="hf-assistant-tab active" data-tab="overview" data-i18n="tabOverview">概览</button>
          <button class="hf-assistant-tab" data-tab="deploy" data-i18n="tabDeploy">部署</button>
          <button class="hf-assistant-tab" data-tab="request" data-i18n="tabRequest">请求</button>
          <button class="hf-assistant-tab" data-tab="download" data-i18n="tabDownload">下载</button>
          <button class="hf-assistant-tab" data-tab="recommend" data-i18n="tabRecommend">推荐</button>
        </div>
        <div class="hf-assistant-content">
          <div class="hf-assistant-panel active" id="panel-overview"></div>
          <div class="hf-assistant-panel" id="panel-deploy"></div>
          <div class="hf-assistant-panel" id="panel-request"></div>
          <div class="hf-assistant-panel" id="panel-download"></div>
          <div class="hf-assistant-panel" id="panel-favorites"></div>
          <div class="hf-assistant-panel" id="panel-recommend"></div>
        </div>
        <div class="hf-assistant-footer">
          <button type="button" class="hf-assistant-donate-link" id="hf-donate-toggle">
            <span style="font-size:13px;">🍵</span> 支持开发者
          </button>
          <div class="hf-assistant-donate-panel" id="hf-donate-panel" style="display:none;">
            <a href="https://buymeacoffee.com/jackyrwj" target="_blank" class="hf-assistant-donate-bmc">
              ☕ Buy Me a Coffee
            </a>
            <div class="hf-assistant-donate-wechat">
              <img id="hf-wechat-qr" alt="微信收款码" style="width:120px;height:120px;border-radius:6px;border:1px solid #e5e7eb;cursor:zoom-in;">
              <span style="font-size:10px;color:#9ca3af;margin-top:4px;">微信扫码打赏</span>
            </div>
          </div>
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

  ensurePageLayoutStyles() {
    if (this.layoutStyleEl && document.contains(this.layoutStyleEl)) return;

    const style = document.createElement('style');
    style.id = 'hf-assistant-page-layout-style';
    style.textContent = `
      html.hf-assistant-layout {
        --hf-assistant-offset: 0px;
      }

      html.hf-assistant-layout,
      html.hf-assistant-layout body {
        max-width: 100%;
        overflow-x: hidden;
      }

      html.hf-assistant-layout body {
        transition: padding-right 0.2s ease;
      }

      html.hf-assistant-layout.hf-platform-hf {
        padding-right: var(--hf-assistant-offset);
      }

      html.hf-assistant-layout.hf-platform-modelscope body {
        padding-right: 0;
      }
    `;

    document.head.appendChild(style);
    this.layoutStyleEl = style;
  },

  getStyles() {
    return `
      *, *::before, *::after { box-sizing: border-box; }
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
      .hf-assistant-action-pill {
        background: #ffffff; border: 1px solid #d1d5db; cursor: pointer;
        padding: 4px 10px; border-radius: 999px; font-size: 12px;
        color: #4b5563; white-space: nowrap;
      }
      .hf-assistant-action-pill:hover { background: #f3f4f6; border-color: #9ca3af; }
      #hf-favorites-btn:hover { background: #f3f4f6; }
      .top-action-active { color: #2563eb; background: #eff6ff !important; }
      .hf-assistant-btn {
        background: transparent; border: none; cursor: pointer;
        padding: 4px 8px; border-radius: 4px; font-size: 14px; transition: background 0.2s;
      }
      .hf-assistant-btn:hover { background: #e5e7eb; }
      .hf-assistant-tabs { display: flex; border-bottom: 1px solid #e5e7eb; background: #ffffff; }
      .hf-assistant-tab {
        flex: 1; padding: 10px 8px; border: none; background: transparent;
        cursor: pointer; font-size: 12px; font-weight: 500; color: #6b7280;
        border-bottom: 2px solid transparent; transition: all 0.2s;
      }
      .hf-assistant-tab:hover { color: #374151; background: #f9fafb; }
      .hf-assistant-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
      .hf-assistant-content { flex: 1; overflow-y: auto; padding: 0; }
      .hf-assistant-content::-webkit-scrollbar { width: 6px; }
      .hf-assistant-content::-webkit-scrollbar-track { background: transparent; }
      .hf-assistant-content::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
      .hf-assistant-content::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      .hf-assistant-panel { display: none; padding: 16px; }
      .hf-assistant-panel.active { display: block; }
      .hf-assistant-collapsed { position: fixed; top: 80px; right: 0; z-index: 99999; }
      .hf-assistant-expand-btn {
        width: 40px; height: 40px; background: #ffffff; border: 1px solid #e5e7eb;
        border-right: none; border-radius: 8px 0 0 8px; cursor: pointer;
        font-size: 18px; box-shadow: -2px 0 8px rgba(0,0,0,0.08);
      }
      .hf-assistant-footer {
        padding: 8px 16px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        text-align: center;
        flex-shrink: 0;
      }
      .hf-assistant-donate-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #6b7280;
        text-decoration: none;
        padding: 4px 10px;
        border-radius: 999px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        transition: all 0.2s;
      }
      .hf-assistant-donate-link:hover {
        color: #92400e;
        background: #fef3c7;
        border-color: #fcd34d;
      }
      .hf-assistant-donate-panel {
        margin-top: 10px;
        padding: 12px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .hf-assistant-donate-bmc {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #2563eb;
        text-decoration: none;
        padding: 6px 14px;
        border-radius: 999px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        transition: all 0.2s;
      }
      .hf-assistant-donate-bmc:hover {
        background: #dbeafe;
      }
      .hf-assistant-donate-wechat {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .hf-assistant-toast {
        position: absolute; bottom: 16px; left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #1f2937; color: #ffffff; padding: 8px 16px;
        border-radius: 6px; font-size: 12px; opacity: 0;
        transition: all 0.3s ease; pointer-events: none; white-space: nowrap;
      }
      .hf-assistant-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
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
        font-size: 11px; font-weight: 500; cursor: pointer; padding: 0; white-space: nowrap;
      }
      .hf-assistant-inline-action:hover { color: #1d4ed8; text-decoration: underline; }
      .hf-assistant-select, .hf-assistant-input {
        width: 100%; padding: 6px 8px; border: 1px solid #d1d5db;
        border-radius: 6px; font-size: 12px; background: #ffffff; margin-bottom: 8px;
        box-sizing: border-box;
      }
      .hf-assistant-select:focus, .hf-assistant-input:focus {
        outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
      }
      .hf-assistant-label { display: block; font-size: 11px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
      .hf-assistant-command {
        background: #1f2937; color: #e5e7eb; padding: 12px;
        border-radius: 6px; font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
        font-size: 11px; line-height: 1.6; overflow-x: auto;
        white-space: pre-wrap; word-break: break-all; position: relative;
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
      .hf-assistant-param-group {
        font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;
        letter-spacing: 0.6px; margin: 12px 0 6px; padding-bottom: 4px;
        border-bottom: 1px solid #e5e7eb;
      }
      .hf-assistant-param-group:first-child { margin-top: 4px; }
      .hf-assistant-param-desc { display: none; }
      .hf-param-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .hf-param-row .hf-assistant-label { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hf-param-row .hf-assistant-input[type="number"], .hf-param-row .hf-assistant-select { width: 100px; flex-shrink: 0; margin: 0; }
      .hf-assistant-param-tip {
        display: inline-block; margin-left: 3px; cursor: help; color: #9ca3af;
        font-size: 11px; font-style: normal; font-weight: 400;
        vertical-align: middle; line-height: 1; user-select: none;
      }
      .hf-assistant-param-tip:hover { color: #6b7280; }
      .hf-assistant-range-val { font-weight: 400; color: #374151; }
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
      .hf-assistant-resize-handle {
        position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
        cursor: col-resize; z-index: 1; background: transparent; transition: background 0.15s;
      }
      .hf-assistant-resize-handle:hover, .hf-assistant-resize-handle.dragging {
        background: rgba(37, 99, 235, 0.25);
      }
      /* Download tab */
      .hf-download-recommend {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border: 1px solid #2563eb; border-radius: 10px; padding: 14px; margin-bottom: 16px;
      }
      .hf-download-recommend-title {
        font-weight: 600; font-size: 13px; color: #1e40af; margin-bottom: 10px;
        display: flex; align-items: center; gap: 6px;
      }
      .hf-download-recommend-meta {
        font-size: 11px; color: #3b82f6; margin-top: 8px; padding-top: 8px;
        border-top: 1px solid #bfdbfe;
      }
      .hf-download-recommend-meta div { margin-bottom: 3px; }
      .hf-download-segmented { display: flex; gap: 4px; margin-bottom: 12px; }
      .hf-download-segment {
        flex: 1; padding: 6px 4px; border: 1px solid #d1d5db; background: #ffffff;
        border-radius: 6px; font-size: 11px; font-weight: 500; color: #6b7280;
        cursor: pointer; text-align: center; transition: all 0.2s;
      }
      .hf-download-segment:hover { background: #f9fafb; color: #374151; }
      .hf-download-segment.active { background: #2563eb; color: #ffffff; border-color: #2563eb; }
      .hf-download-segment[data-disabled="true"] { opacity: 0.4; cursor: not-allowed; }
      .hf-download-advanced-toggle {
        display: flex; align-items: center; gap: 6px; padding: 8px 0;
        font-size: 12px; font-weight: 500; color: #374151;
        cursor: pointer; background: none; border: none; width: 100%; text-align: left;
      }
      .hf-download-advanced-toggle:hover { color: #2563eb; }
      .hf-download-advanced-content { display: none; padding: 8px 0 4px; }
      .hf-download-advanced-content.open { display: block; }
      .hf-download-file-filters {
        display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
        font-size: 12px; margin-bottom: 10px;
      }
      .hf-download-file-filter {
        display: flex; align-items: center; gap: 5px; padding: 4px 6px;
        background: #f9fafb; border-radius: 4px; cursor: pointer;
      }
      .hf-download-file-filter.disabled { opacity: 0.5; cursor: not-allowed; }
      .hf-download-file-filter input { margin: 0; cursor: pointer; }
      .hf-download-filter-note {
        font-size: 11px; color: #ca8a04; margin-bottom: 8px; padding: 4px 8px;
        background: #fefce8; border-radius: 4px;
      }
      .hf-download-model-info {
        font-size: 12px; color: #6b7280; margin-bottom: 12px; padding-bottom: 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      .hf-download-model-info strong { color: #374151; }
      .hf-download-tip {
        font-size: 11px; color: #6b7280; padding: 8px 10px; background: #f9fafb;
        border-radius: 6px; margin-top: 8px; line-height: 1.5;
      }
      .hf-download-tip.warning { color: #92400e; background: #fef3c7; }
      .hf-download-tip code {
        background: #e5e7eb; padding: 1px 4px; border-radius: 3px;
        font-size: 10px; font-family: "SF Mono", Monaco, monospace;
      }
      .hf-download-mirror-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .hf-download-mirror-row .hf-assistant-label { margin: 0; flex-shrink: 0; }
      .hf-download-mirror-row .hf-assistant-select { margin: 0; flex: 1; }
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

    root.querySelector('#hf-favorites-btn').addEventListener('click', () => {
      if (this.currentTab === 'favorites') {
        this.switchTab(this._prevTab || 'overview');
      } else {
        this._prevTab = this.currentTab;
        this.switchTab('favorites');
      }
    });

    const donateToggle = root.querySelector('#hf-donate-toggle');
    const donatePanel = root.querySelector('#hf-donate-panel');
    if (donateToggle && donatePanel) {
      donateToggle.addEventListener('click', () => {
        const isOpen = donatePanel.style.display !== 'none';
        donatePanel.style.display = isOpen ? 'none' : 'flex';
      });
    }

    const qrImg = root.querySelector('#hf-wechat-qr');
    if (qrImg) {
      qrImg.src = chrome.runtime.getURL('src/assets/wechat-qr.png');
      qrImg.addEventListener('click', () => {
        const enlarged = document.createElement('div');
        enlarged.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:100000;cursor:zoom-out;';
        enlarged.innerHTML = `<img src="${qrImg.src}" style="max-width:80vw;max-height:80vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">`;
        enlarged.addEventListener('click', () => enlarged.remove());
        document.body.appendChild(enlarged);
      });
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const root = this.shadowRoot;
    const isFavorites = tabName === 'favorites';

    root.querySelector('#hf-favorites-btn').classList.toggle('top-action-active', isFavorites);

    root.querySelectorAll('.hf-assistant-tab').forEach(t => {
      t.classList.toggle('active', !isFavorites && t.dataset.tab === tabName);
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
    } else if (tabName === 'request' && typeof RequestTab !== 'undefined') {
      RequestTab.render(this.getPanel('request'), this.modelInfo);
    } else if (tabName === 'download' && typeof DownloadTab !== 'undefined') {
      DownloadTab.render(this.getPanel('download'), this.modelInfo);
    } else if (tabName === 'favorites' && typeof FavoritesTab !== 'undefined') {
      FavoritesTab.render(this.getPanel('favorites'));
    } else if (tabName === 'recommend' && typeof RecommendTab !== 'undefined') {
      RecommendTab.render(this.getPanel('recommend'), this.modelInfo);
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
    this.updatePageMargin(0);
  },

  expand() {
    this.isOpen = true;
    this.shadowRoot.querySelector('.hf-assistant-sidebar').classList.remove('collapsed');
    this.shadowRoot.querySelector('.hf-assistant-collapsed').style.display = 'none';
    this.updatePageMargin(this.currentWidth);
  },

  getPanel(name) {
    return this.shadowRoot.querySelector(`#panel-${name}`);
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
  },

  bindResizeDrag() {
    const handle = this.shadowRoot.querySelector('#hf-resize-handle');
    const sidebar = this.shadowRoot.querySelector('#hf-assistant-sidebar');
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = this.currentWidth;
      handle.classList.add('dragging');

      const onMove = (e) => {
        const delta = startX - e.clientX;
        const newWidth = Math.min(Math.max(startWidth + delta, 280), 700);
        this.currentWidth = newWidth;
        sidebar.style.width = newWidth + 'px';
        this.updatePageMargin(newWidth);
      };

      const onUp = () => {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        Storage.set('sidebarWidth', this.currentWidth);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  updatePageMargin(width) {
    const pad = this.isOpen ? width : 0;
    const platform = window.__HF_ASSISTANT_PLATFORM__;
    this.ensurePageLayoutStyles();
    document.documentElement.classList.add('hf-assistant-layout');
    document.documentElement.classList.toggle('hf-platform-modelscope', platform === 'modelscope');
    document.documentElement.classList.toggle('hf-platform-hf', platform !== 'modelscope');
    document.documentElement.style.setProperty('--hf-assistant-offset', platform === 'modelscope' ? '0px' : `${pad}px`);
  },

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.shadowRoot = null;
    this.rendered = false;
  }
};
