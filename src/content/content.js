(function() {
  'use strict';

  if (window.__HF_ASSISTANT_INJECTED__) return;
  window.__HF_ASSISTANT_INJECTED__ = true;

  const hostname = window.location.hostname;
  const isHF = hostname === 'huggingface.co';
  const isModelScope = hostname === 'www.modelscope.cn' || hostname === 'modelscope.cn';

  if (!isHF && !isModelScope) return;

  // Store platform info globally
  window.__HF_ASSISTANT_PLATFORM__ = isHF ? 'hf' : 'modelscope';
  let refreshTimer = null;
  let refreshAttempts = 0;

  function isModelDetailPage() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);

    if (isHF) {
      if (pathParts.length < 2) return false;
      const excludedPrefixes = ['spaces', 'datasets', 'docs', 'blog', 'search', 'settings', 'organizations', 'users', 'papers', 'login', 'join', 'logout', 'api', 'pricing', 'enterprise'];
      return !excludedPrefixes.includes(pathParts[0]);
    }

    if (isModelScope) {
      return pathParts[0] === 'models' && pathParts.length >= 3;
    }

    return false;
  }

  function populateModelInfo() {
    if (!Sidebar.container) return false;

    const modelInfo = PageScraper.extractModelInfo();
    if (modelInfo) {
      modelInfo.platform = isHF ? 'hf' : 'modelscope';
      modelInfo.files = PageScraper.extractFileList();
      Sidebar.setModelInfo(modelInfo);
      Sidebar.updatePageMargin(Sidebar.currentWidth || 360);
      refreshAttempts = 0;
      return true;
    }

    // Some SPA renders land after our content script. Retry a few times without blocking the page.
    if (refreshAttempts < 4) {
      refreshAttempts += 1;
      scheduleRefresh(250 * refreshAttempts);
    }
    return false;
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      populateModelInfo();
    }, delay);
  }

  async function init() {
    try {
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      if (!isModelDetailPage()) return;

      await Sidebar.init();
      scheduleRefresh(0);

    } catch (err) {
      console.error('HF Model Assistant init error:', err);
    }
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      refreshAttempts = 0;

      const onDetail = isModelDetailPage();
      const sidebarExists = !!Sidebar.container;

      if (onDetail && !sidebarExists) {
        Sidebar.init().then(() => scheduleRefresh(0));
      } else if (!onDetail && sidebarExists) {
        Sidebar.destroy();
      } else if (onDetail && sidebarExists) {
        scheduleRefresh(300);
      }
    }
  }).observe(document, { subtree: true, childList: true });

  init();
})();
