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

  async function init() {
    try {
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      await Sidebar.init();

      if (isModelDetailPage()) {
        const modelInfo = PageScraper.extractModelInfo();
        if (modelInfo) {
          modelInfo.platform = isHF ? 'hf' : 'modelscope';
          modelInfo.files = PageScraper.extractFileList();
          Sidebar.setModelInfo(modelInfo);
        }
        adjustPageLayout();
      } else {
        Sidebar.setModelInfo(null);
      }

    } catch (err) {
      console.error('HF Model Assistant init error:', err);
    }
  }

  function adjustPageLayout() {
    if (!isHF) return;
    const main = document.querySelector('main, .container, #main-content');
    if (main) {
      main.style.marginRight = '360px';
    }
  }

  function resetPageLayout() {
    if (!isHF) return;
    const main = document.querySelector('main, .container, #main-content');
    if (main) {
      main.style.marginRight = '';
    }
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        if (isModelDetailPage()) {
          const modelInfo = PageScraper.extractModelInfo();
          if (modelInfo) {
            modelInfo.platform = isHF ? 'hf' : 'modelscope';
            modelInfo.files = PageScraper.extractFileList();
            Sidebar.setModelInfo(modelInfo);
          }
          adjustPageLayout();
        } else {
          Sidebar.setModelInfo(null);
          resetPageLayout();
        }
      }, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

  init();
})();
