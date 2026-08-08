(function() {
  'use strict';

  if (window.__HF_ASSISTANT_INJECTED__) return;
  window.__HF_ASSISTANT_INJECTED__ = true;

  const hostname = window.location.hostname;
  const isHF = hostname === 'huggingface.co';
  const isModelScope = hostname === 'www.modelscope.cn' || hostname === 'modelscope.cn';

  if (!isHF && !isModelScope) return;

  const platform = isHF ? 'hf' : 'modelscope';

  function getModelId() {
    const parts = window.location.pathname.split('/').filter(Boolean);

    if (isHF) {
      const excluded = ['spaces', 'datasets', 'docs', 'blog', 'search', 'settings',
        'organizations', 'users', 'papers', 'login', 'join', 'logout', 'api',
        'pricing', 'enterprise'];
      if (parts.length < 2 || excluded.includes(parts[0])) return null;
      return `${parts[0]}/${parts[1]}`;
    }

    if (isModelScope) {
      if (parts[0] !== 'models' || parts.length < 3) return null;
      return `${parts[1]}/${parts[2]}`;
    }

    return null;
  }

  // 右侧栏锚点：候选选择器按优先级尝试，找不到就等 MutationObserver 再试。
  // 两个站都是 SPA，右侧栏渲染晚于 content script 是常态。
  const RAIL_SELECTORS = isHF
    ? ['main aside', 'aside']
    : ['.model-detail-right', '.right-container', 'main aside', 'aside'];

  function findRail() {
    for (const sel of RAIL_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  let currentModelId = null;

  function ensureCard() {
    const modelId = getModelId();

    if (!modelId) {
      if (Card.isMounted()) {
        Card.unmount();
        currentModelId = null;
      }
      return;
    }

    // 同模型且卡片仍在：什么都不做（避免被 SPA 的无关 DOM 变更触发重渲染）
    if (modelId === currentModelId && Card.isMounted()) return;

    const rail = findRail();
    if (!rail) return; // 等下一次 mutation 再试

    Card.unmount();
    Card.mount(rail);
    currentModelId = modelId;
    Card.render({ platform, modelId });
  }

  // 统一兜底：URL 变化（SPA 导航）和 DOM 变化（右侧栏晚渲染、卡片被抹掉）
  // 都走 ensureCard，去重逻辑在函数内部。
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      currentModelId = null;
    }
    ensureCard();
  }).observe(document, { subtree: true, childList: true });

  ensureCard();
})();
