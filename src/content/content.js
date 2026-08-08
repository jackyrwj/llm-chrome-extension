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

  // 右侧栏锚点：先试已知选择器，失败则按几何特征找——视口右侧、
  // 宽度 240~480px、高度足够的列容器。两个站都是 SPA 且 class 名不稳定，
  // 几何特征比 class 名可靠（SPA 改版不碎）。
  const RAIL_SELECTORS = isHF
    ? ['main aside', 'aside']
    : ['main aside', 'aside'];

  let lastGeometryScan = 0;
  function findRailByGeometry() {
    // 全量遍历开销不小，限频：只在选择器失败时调用，且 500ms 内最多一次
    const now = Date.now();
    if (now - lastGeometryScan < 500) return null;
    lastGeometryScan = now;

    const vw = window.innerWidth;
    let best = null;
    for (const el of document.querySelectorAll('main *')) {
      if (el === Card.host || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 240 || r.width > 480) continue;
      if (r.left < vw * 0.55) continue;
      if (r.height < 200) continue;
      // 取满足条件的最外层容器（高度最大者），prepend 才能落在栏顶
      if (!best || r.height > best.getBoundingClientRect().height) best = el;
    }
    return best;
  }

  function findRail() {
    for (const sel of RAIL_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return findRailByGeometry();
  }

  let currentModelId = null;
  let railMisses = 0;

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
    if (!rail) {
      // 右栏还没渲染出来（SPA 常态），等下一次 mutation；连续找不到就报一次诊断
      railMisses += 1;
      if (railMisses === 50) {
        console.warn(
          '[HF Assistant] 未找到页面右侧栏，卡片无法注入。' +
          '请把页面 URL 和右侧栏外层 div 的 class 反馈给开发者。'
        );
      }
      return;
    }
    railMisses = 0;

    Card.unmount();
    Card.mount(rail);
    currentModelId = modelId;
    console.info('[HF Assistant] 卡片已注入', rail);
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
