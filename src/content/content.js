(function() {
  'use strict';

  if (window.__HF_ASSISTANT_INJECTED__) return;
  window.__HF_ASSISTANT_INJECTED__ = true;

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) return;

  const excludedPrefixes = ['spaces', 'datasets', 'docs', 'blog', 'search', 'settings'];
  if (excludedPrefixes.includes(pathParts[0])) return;

  async function init() {
    try {
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      await Sidebar.init();

      const modelInfo = PageScraper.extractModelInfo();
      if (modelInfo) {
        modelInfo.files = PageScraper.extractFileList();
        Sidebar.setModelInfo(modelInfo);
      }

      adjustPageLayout();

    } catch (err) {
      console.error('HF Model Assistant init error:', err);
    }
  }

  function adjustPageLayout() {
    const main = document.querySelector('main, .container, #main-content');
    if (main) {
      main.style.marginRight = '360px';
    }
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        const modelInfo = PageScraper.extractModelInfo();
        if (modelInfo) {
          modelInfo.files = PageScraper.extractFileList();
          Sidebar.setModelInfo(modelInfo);
        }
      }, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

  init();
})();
