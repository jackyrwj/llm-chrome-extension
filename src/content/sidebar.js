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
            <button class="hf-assistant-btn" id="hf-assistant-favorite" title="收藏">☆</button>
            <button class="hf-assistant-btn" id="hf-assistant-toggle" title="折叠">✕</button>
          </div>
        </div>
        <div class="hf-assistant-tabs">
          <button class="hf-assistant-tab active" data-tab="overview" data-i18n="tabOverview">概览</button>
          <button class="hf-assistant-tab" data-tab="deploy" data-i18n="tabDeploy">部署</button>
          <button class="hf-assistant-tab" data-tab="download" data-i18n="tabDownload">下载</button>
          <button class="hf-assistant-tab" data-tab="tools" data-i18n="tabTools">工具</button>
        </div>
        <div class="hf-assistant-content">
          <div class="hf-assistant-panel active" id="panel-overview"></div>
          <div class="hf-assistant-panel" id="panel-deploy"></div>
          <div class="hf-assistant-panel" id="panel-download"></div>
          <div class="hf-assistant-panel" id="panel-tools"></div>
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
        line-height: 1.6; overflow-x: auto; white-space: pre-wrap;
        word-break: break-all; position: relative;
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

    root.querySelector('#hf-assistant-favorite').addEventListener('click', () => {
      this.toggleFavorite();
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const root = this.shadowRoot;

    root.querySelectorAll('.hf-assistant-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    root.querySelectorAll('.hf-assistant-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tabName}`);
    });

    if (tabName === 'overview' && typeof OverviewTab !== 'undefined') {
      OverviewTab.render(this.getPanel('overview'), this.modelInfo);
    } else if (tabName === 'deploy' && typeof DeployTab !== 'undefined') {
      DeployTab.render(this.getPanel('deploy'), this.modelInfo);
    } else if (tabName === 'download' && typeof DownloadTab !== 'undefined') {
      DownloadTab.render(this.getPanel('download'), this.modelInfo);
    } else if (tabName === 'tools' && typeof ToolsTab !== 'undefined') {
      ToolsTab.render(this.getPanel('tools'), this.modelInfo);
    }
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

  async toggleFavorite() {
    if (!this.modelInfo) return;
    const isFav = await Storage.isFavorite(this.modelInfo.modelId);
    const btn = this.shadowRoot.querySelector('#hf-assistant-favorite');

    if (isFav) {
      await Storage.removeFavorite(this.modelInfo.modelId);
      btn.textContent = '☆';
    } else {
      const modelscopeUrl = this.modelInfo.modelscopeUrl || '';
      await Storage.addFavorite(this.modelInfo.modelId, modelscopeUrl);
      btn.textContent = '★';
    }
  },

  async updateFavoriteButton() {
    if (!this.modelInfo) return;
    const isFav = await Storage.isFavorite(this.modelInfo.modelId);
    const btn = this.shadowRoot.querySelector('#hf-assistant-favorite');
    btn.textContent = isFav ? '★' : '☆';
  },

  showToast(message) {
    const toast = this.shadowRoot.querySelector('#hf-assistant-toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  },

  setModelInfo(info) {
    this.modelInfo = info;
    this.updateFavoriteButton();
    this.switchTab(this.currentTab);
  }
};
