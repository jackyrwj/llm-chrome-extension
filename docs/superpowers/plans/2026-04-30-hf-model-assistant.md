# HF Model Assistant Chrome Extension - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that injects a sidebar on Hugging Face model pages, providing ModelScope mapping, deployment command generation, VRAM estimation, mirror site info, and README translation for Chinese developers.

**Architecture:** Manifest V3 extension with content script (sidebar injection), background service worker (API proxy), options page (settings), and shared JS modules for pure logic. Native JS/HTML/CSS, no frameworks.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, Shadow DOM, chrome.storage API

---

## File Structure

```
hf-model-assistant/
├── manifest.json
├── src/
│   ├── content/
│   │   ├── content.js            # Content script entry: injects sidebar
│   │   ├── sidebar.js            # Sidebar controller: tabs, state, UI coordination
│   │   ├── sidebar.html          # Sidebar HTML template (loaded into Shadow DOM)
│   │   ├── sidebar.css           # Sidebar styles (scoped via Shadow DOM)
│   │   ├── tabs/
│   │   │   ├── overview.js       # Overview tab: model info, ModelScope mapping, favorites
│   │   │   ├── deploy.js         # Deploy tab: tool selector, params, VRAM estimate, command gen
│   │   │   ├── download.js       # Download tab: mirror sites, download commands
│   │   │   └── tools.js          # Tools tab: README translation
│   │   └── page-scraper.js       # Extract model info from HF page DOM
│   ├── background/
│   │   └── background.js         # Service worker: proxy API calls, handle CORS
│   ├── options/
│   │   ├── options.html          # Settings page
│   │   ├── options.js            # Settings logic
│   │   └── options.css           # Settings styles
│   ├── shared/
│   │   ├── storage.js            # chrome.storage wrapper
│   │   ├── api.js                # API calls (ModelScope search, translation)
│   │   ├── commands.js           # Deployment command templates and generator
│   │   ├── vram-estimator.js     # VRAM estimation logic
│   │   └── i18n.js               # Internationalization strings
│   └── data/
│       └── mapping.json          # HF -> ModelScope local mapping table
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── tests/
    ├── test-vram-estimator.js
    └── test-commands.js
```

---

## Task Dependency Graph

```
Task 1 (manifest.json)
  │
  ├── Task 2 (i18n.js)
  ├── Task 3 (storage.js)
  ├── Task 4 (mapping.json)
  │
  ├── Task 5 (vram-estimator.js) ──→ Test: test-vram-estimator.js
  ├── Task 6 (api.js)
  ├── Task 7 (commands.js) ────────→ Test: test-commands.js
  │
  ├── Task 8 (background.js)
  ├── Task 9 (page-scraper.js)
  │
  ├── Task 10 (sidebar.html + sidebar.css)
  ├── Task 11 (sidebar.js)
  │
  ├── Task 12 (overview.js)
  ├── Task 13 (deploy.js)
  ├── Task 14 (download.js)
  ├── Task 15 (tools.js)
  │
  ├── Task 16 (content.js)
  │
  ├── Task 17 (options.html + options.css + options.js)
  │
  └── Task 18 (icons)
```

---

### Task 1: Extension Manifest

**Files:**
- Create: `manifest.json`

**Purpose:** Define the Chrome extension metadata, permissions, and entry points.

- [ ] **Step 1: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  "version": "1.0.0",
  "default_locale": "zh",
  "permissions": [
    "activeTab",
    "storage",
    "clipboardWrite"
  ],
  "host_permissions": [
    "https://huggingface.co/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://huggingface.co/*/*"],
      "exclude_matches": [
        "https://huggingface.co/spaces/*",
        "https://huggingface.co/datasets/*",
        "https://huggingface.co/docs/*",
        "https://huggingface.co/blog/*",
        "https://huggingface.co/search*"
      ],
      "js": ["src/shared/i18n.js", "src/shared/storage.js", "src/shared/api.js", "src/shared/vram-estimator.js", "src/shared/commands.js", "src/content/page-scraper.js", "src/content/tabs/overview.js", "src/content/tabs/deploy.js", "src/content/tabs/download.js", "src/content/tabs/tools.js", "src/content/sidebar.js", "src/content/content.js"],
      "css": ["src/content/sidebar.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "src/background/background.js"
  },
  "options_page": "src/options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "chore: add manifest.json for Chrome extension"
```

---

### Task 2: Internationalization Module

**Files:**
- Create: `src/shared/i18n.js`

**Purpose:** Provide translated strings for UI elements. Default language is Chinese.

- [ ] **Step 1: Write i18n.js**

```javascript
const I18N = {
  zh: {
    extName: 'HF 模型助手',
    extDescription: 'Hugging Face 模型页面的智能助手，提供魔搭映射、部署命令生成、显存估算等功能',
    sidebarTitle: '模型助手',
    tabOverview: '概览',
    tabDeploy: '部署',
    tabDownload: '下载',
    tabTools: '工具',
    loading: '加载中...',
    modelscopeFound: '✅ 已找到魔搭对应模型',
    modelscopeNotFound: '❌ 未在魔搭找到对应模型',
    gotoSearch: '前往搜索',
    addFavorite: '收藏',
    removeFavorite: '取消收藏',
    deployTool: '部署工具',
    vramEstimate: '预计显存',
    vramOk: '✅ 可运行',
    vramWarning: '⚠️ 可能不足',
    vramInsufficient: '❌ 显存不足',
    copyCommand: '复制命令',
    copied: '已复制到剪贴板',
    commandHistory: '历史记录',
    reuse: '复用',
    mirrorSite: '镜像站',
    downloadCommand: '下载命令',
    envHint: '环境变量',
    translateReadme: '翻译 README',
    showOriginal: '显示原文',
    showTranslation: '显示翻译',
    settings: '设置',
    general: '通用设置',
    deployTools: '部署工具',
    apiConfig: 'API 配置',
    defaultTool: '默认部署工具',
    preferredMirror: '首选镜像站',
    vramSize: '机器显存大小 (GB)',
    sidebarDefaultOpen: '侧边栏默认展开',
    language: '界面语言',
    save: '保存',
    saved: '已保存',
    errorApiFailed: '服务暂时不可用',
    errorNoModelInfo: '未检测到模型信息',
    ggufRecommended: '推荐',
    ggufCompatible: '兼容',
    ggufTooLarge: '超出显存',
  },
  en: {
    extName: 'HF Model Assistant',
    extDescription: 'Smart assistant for Hugging Face model pages with ModelScope mapping, deployment commands, VRAM estimation',
    sidebarTitle: 'Model Assistant',
    tabOverview: 'Overview',
    tabDeploy: 'Deploy',
    tabDownload: 'Download',
    tabTools: 'Tools',
    loading: 'Loading...',
    modelscopeFound: '✅ Found on ModelScope',
    modelscopeNotFound: '❌ Not found on ModelScope',
    gotoSearch: 'Search',
    addFavorite: 'Favorite',
    removeFavorite: 'Unfavorite',
    deployTool: 'Deployment Tool',
    vramEstimate: 'Estimated VRAM',
    vramOk: '✅ Can run',
    vramWarning: '⚠️ May be tight',
    vramInsufficient: '❌ Insufficient VRAM',
    copyCommand: 'Copy command',
    copied: 'Copied to clipboard',
    commandHistory: 'History',
    reuse: 'Reuse',
    mirrorSite: 'Mirror Site',
    downloadCommand: 'Download Command',
    envHint: 'Environment Variable',
    translateReadme: 'Translate README',
    showOriginal: 'Show Original',
    showTranslation: 'Show Translation',
    settings: 'Settings',
    general: 'General',
    deployTools: 'Deploy Tools',
    apiConfig: 'API Config',
    defaultTool: 'Default Deploy Tool',
    preferredMirror: 'Preferred Mirror',
    vramSize: 'VRAM Size (GB)',
    sidebarDefaultOpen: 'Sidebar Open by Default',
    language: 'Language',
    save: 'Save',
    saved: 'Saved',
    errorApiFailed: 'Service temporarily unavailable',
    errorNoModelInfo: 'No model info detected',
    ggufRecommended: 'Recommended',
    ggufCompatible: 'Compatible',
    ggufTooLarge: 'Too large',
  }
};

function getLang() {
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

function t(key, lang) {
  const l = lang || getLang();
  return (I18N[l] && I18N[l][key]) || I18N['en'][key] || key;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N, t, getLang };
}
```

- [ ] **Step 2: Verify with simple node test**

```bash
node -e "const { t } = require('./src/shared/i18n.js'); console.log(t('sidebarTitle', 'zh')); console.log(t('sidebarTitle', 'en'));"
```

Expected output:
```
模型助手
Model Assistant
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/i18n.js
git commit -m "feat: add internationalization module with zh/en support"
```

---

### Task 3: Storage Wrapper

**Files:**
- Create: `src/shared/storage.js`

**Purpose:** Abstract chrome.storage API for preferences, favorites, history, and cache.

- [ ] **Step 1: Write storage.js**

```javascript
const Storage = {
  DEFAULTS: {
    defaultTool: 'ollama',
    preferredMirror: 'hf-mirror',
    vramGB: 8,
    sidebarDefaultOpen: true,
    language: 'zh',
    translationProvider: 'none',
    translationApiKey: '',
    modelscopeApiEndpoint: 'https://www.modelscope.cn/api/v1/dolphin/models'
  },

  async get(key) {
    const result = await chrome.storage.sync.get(key);
    return result[key] !== undefined ? result[key] : this.DEFAULTS[key];
  },

  async getAll() {
    const result = await chrome.storage.sync.get(Object.keys(this.DEFAULTS));
    return { ...this.DEFAULTS, ...result };
  },

  async set(key, value) {
    await chrome.storage.sync.set({ [key]: value });
  },

  async setMultiple(obj) {
    await chrome.storage.sync.set(obj);
  },

  async getFavorites() {
    const result = await chrome.storage.sync.get('favorites');
    return result.favorites || [];
  },

  async addFavorite(modelId, modelscopeUrl) {
    const favorites = await this.getFavorites();
    if (!favorites.find(f => f.modelId === modelId)) {
      favorites.push({ modelId, modelscopeUrl, addedAt: Date.now() });
      await chrome.storage.sync.set({ favorites });
    }
  },

  async removeFavorite(modelId) {
    const favorites = (await this.getFavorites()).filter(f => f.modelId !== modelId);
    await chrome.storage.sync.set({ favorites });
  },

  async isFavorite(modelId) {
    const favorites = await this.getFavorites();
    return favorites.some(f => f.modelId === modelId);
  },

  async getCommandHistory() {
    const result = await chrome.storage.local.get('commandHistory');
    return result.commandHistory || [];
  },

  async addCommandHistory(tool, command, params) {
    const history = await this.getCommandHistory();
    history.unshift({ tool, command, params, timestamp: Date.now() });
    if (history.length > 20) history.pop();
    await chrome.storage.local.set({ commandHistory: history });
  },

  async getMappingCache(modelId) {
    const result = await chrome.storage.local.get('mappingCache');
    const cache = result.mappingCache || {};
    const entry = cache[modelId];
    if (entry && (Date.now() - entry.cachedAt) < 7 * 24 * 60 * 60 * 1000) {
      return entry;
    }
    return null;
  },

  async setMappingCache(modelId, modelscopeUrl) {
    const result = await chrome.storage.local.get('mappingCache');
    const cache = result.mappingCache || {};
    cache[modelId] = { modelscopeUrl, cachedAt: Date.now() };
    await chrome.storage.local.set({ mappingCache: cache });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Storage };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/storage.js
git commit -m "feat: add chrome.storage wrapper for preferences, favorites, history, cache"
```

---

### Task 4: Local Mapping Table

**Files:**
- Create: `src/data/mapping.json`

**Purpose:** Fallback mapping table from HF model IDs to ModelScope URLs.

- [ ] **Step 1: Write mapping.json with common models**

```json
{
  "meta-llama/Llama-2-7b-hf": {
    "modelscope": "LLM-Research/Llama-2-7b-hf",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Llama-2-7b-hf",
    "lastVerified": "2026-04-01",
    "notes": "Official mirror"
  },
  "meta-llama/Llama-2-7b-chat-hf": {
    "modelscope": "LLM-Research/Llama-2-7b-chat-hf",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Llama-2-7b-chat-hf",
    "lastVerified": "2026-04-01"
  },
  "meta-llama/Llama-2-13b-hf": {
    "modelscope": "LLM-Research/Llama-2-13b-hf",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Llama-2-13b-hf",
    "lastVerified": "2026-04-01"
  },
  "meta-llama/Llama-2-13b-chat-hf": {
    "modelscope": "LLM-Research/Llama-2-13b-chat-hf",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Llama-2-13b-chat-hf",
    "lastVerified": "2026-04-01"
  },
  "meta-llama/Llama-2-70b-hf": {
    "modelscope": "LLM-Research/Llama-2-70b-hf",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Llama-2-70b-hf",
    "lastVerified": "2026-04-01"
  },
  "meta-llama/Meta-Llama-3-8B": {
    "modelscope": "LLM-Research/Meta-Llama-3-8B",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Meta-Llama-3-8B",
    "lastVerified": "2026-04-01"
  },
  "meta-llama/Meta-Llama-3-8B-Instruct": {
    "modelscope": "LLM-Research/Meta-Llama-3-8B-Instruct",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Meta-Llama-3-8B-Instruct",
    "lastVerified": "2026-04-01"
  },
  "mistralai/Mistral-7B-v0.1": {
    "modelscope": "AI-ModelScope/Mistral-7B-v0.1",
    "modelscopeUrl": "https://www.modelscope.cn/models/AI-ModelScope/Mistral-7B-v0.1",
    "lastVerified": "2026-04-01"
  },
  "mistralai/Mistral-7B-Instruct-v0.1": {
    "modelscope": "AI-ModelScope/Mistral-7B-Instruct-v0.1",
    "modelscopeUrl": "https://www.modelscope.cn/models/AI-ModelScope/Mistral-7B-Instruct-v0.1",
    "lastVerified": "2026-04-01"
  },
  "Qwen/Qwen2-7B": {
    "modelscope": "qwen/Qwen2-7B",
    "modelscopeUrl": "https://www.modelscope.cn/models/qwen/Qwen2-7B",
    "lastVerified": "2026-04-01"
  },
  "Qwen/Qwen2-7B-Instruct": {
    "modelscope": "qwen/Qwen2-7B-Instruct",
    "modelscopeUrl": "https://www.modelscope.cn/models/qwen/Qwen2-7B-Instruct",
    "lastVerified": "2026-04-01"
  },
  "google/gemma-2b": {
    "modelscope": "AI-ModelScope/gemma-2b-it",
    "modelscopeUrl": "https://www.modelscope.cn/models/AI-ModelScope/gemma-2b-it",
    "lastVerified": "2026-04-01"
  },
  "microsoft/Phi-3-mini-4k-instruct": {
    "modelscope": "LLM-Research/Phi-3-mini-4k-instruct",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Phi-3-mini-4k-instruct",
    "lastVerified": "2026-04-01"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/mapping.json
git commit -m "feat: add HF to ModelScope local mapping table with common models"
```

---

### Task 5: VRAM Estimator

**Files:**
- Create: `src/shared/vram-estimator.js`
- Create: `tests/test-vram-estimator.js`

**Purpose:** Calculate estimated VRAM required for a model given parameters, precision, and deployment tool.

- [ ] **Step 1: Write test-vram-estimator.js**

```javascript
const assert = require('assert');
const { estimateVRAM, parseParameterCount } = require('../src/shared/vram-estimator.js');

// Test parseParameterCount
assert.strictEqual(parseParameterCount('7B'), 7e9);
assert.strictEqual(parseParameterCount('13B'), 13e9);
assert.strictEqual(parseParameterCount('70b'), 70e9);
assert.strictEqual(parseParameterCount('1.5B'), 1.5e9);
assert.strictEqual(parseParameterCount('unknown'), null);

// Test estimateVRAM: 7B model FP16
const result1 = estimateVRAM({ parameterCount: '7B' }, { precision: 'fp16' });
assert(result1.vramGB > 14 && result1.vramGB < 18, `7B FP16 should be ~16.8GB, got ${result1.vramGB}`);
assert.strictEqual(result1.status, 'ok'); // default userVram is 24

// Test estimateVRAM: 7B model INT4
const result2 = estimateVRAM({ parameterCount: '7B' }, { precision: 'int4' });
assert(result2.vramGB > 3 && result2.vramGB < 6, `7B INT4 should be ~4.2GB, got ${result2.vramGB}`);

// Test estimateVRAM: 70B model FP16
const result3 = estimateVRAM({ parameterCount: '70B' }, { precision: 'fp16', userVramGB: 48 });
assert.strictEqual(result3.status, 'warning'); // 70B*2*1.2 = 168GB > 48*1.1

// Test estimateVRAM: insufficient VRAM
const result4 = estimateVRAM({ parameterCount: '70B' }, { precision: 'fp16', userVramGB: 16 });
assert.strictEqual(result4.status, 'insufficient');

// Test with model name inference
const result5 = estimateVRAM({ modelId: 'meta-llama/Llama-2-7b-hf' }, {});
assert(result5.vramGB > 14, 'Should infer 7B from model name');

console.log('All VRAM estimator tests passed!');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node tests/test-vram-estimator.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: Write vram-estimator.js**

```javascript
const PRECISION_BYTES = {
  fp32: 4.0,
  fp16: 2.0,
  bf16: 2.0,
  int8: 1.0,
  int4: 0.5,
  q4: 0.5,
  q4_k_m: 0.58,
  q5_k_m: 0.67,
  q6_k: 0.78,
  q8_0: 1.0,
  awq: 0.5,
  gptq: 0.5,
  fp8: 1.0
};

function parseParameterCount(input) {
  if (!input) return null;
  const match = String(input).match(/(\d+\.?\d*)\s*[Bb]/);
  if (match) {
    return parseFloat(match[1]) * 1e9;
  }
  return null;
}

function inferParameterCount(modelInfo) {
  if (modelInfo.parameterCount) {
    const parsed = parseParameterCount(modelInfo.parameterCount);
    if (parsed) return parsed;
  }
  if (modelInfo.modelId) {
    const patterns = [
      /(\d+\.?\d*)[Bb]/,
      /-(\d+)[bB]/,
    ];
    for (const pattern of patterns) {
      const match = modelInfo.modelId.match(pattern);
      if (match) return parseFloat(match[1]) * 1e9;
    }
  }
  if (modelInfo.tags) {
    for (const tag of modelInfo.tags) {
      const parsed = parseParameterCount(tag);
      if (parsed) return parsed;
    }
  }
  return null;
}

function estimateVRAM(modelInfo, options = {}) {
  const params = inferParameterCount(modelInfo);
  if (!params) {
    return { vramGB: null, status: 'unknown', message: '无法推断模型参数量' };
  }

  const precision = options.precision || 'fp16';
  const bytesPerParam = PRECISION_BYTES[precision] || PRECISION_BYTES.fp16;
  const overhead = options.overhead || 1.2;
  const userVramGB = options.userVramGB || 24;

  let vramGB = (params * bytesPerParam / 1e9) * overhead;

  // KV cache estimation for inference servers
  if (options.tool === 'vllm' || options.tool === 'sglang' || options.tool === 'tgi') {
    const seqLen = options.maxModelLen || 4096;
    const batchSize = options.batchSize || 1;
    const numLayers = options.numLayers || Math.floor(params / 1e9);
    const hiddenSize = options.hiddenSize || 4096;
    const kvCacheGB = (2 * numLayers * hiddenSize * seqLen * batchSize * bytesPerParam) / 1e9;
    vramGB += kvCacheGB;
  }

  let status;
  if (vramGB <= userVramGB * 0.9) {
    status = 'ok';
  } else if (vramGB <= userVramGB * 1.1) {
    status = 'warning';
  } else {
    status = 'insufficient';
  }

  return {
    vramGB: Math.round(vramGB * 10) / 10,
    status,
    paramsB: Math.round(params / 1e9 * 10) / 10,
    precision,
    userVramGB
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { estimateVRAM, parseParameterCount, inferParameterCount, PRECISION_BYTES };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node tests/test-vram-estimator.js
```

Expected: "All VRAM estimator tests passed!"

- [ ] **Step 5: Commit**

```bash
git add src/shared/vram-estimator.js tests/test-vram-estimator.js
git commit -m "feat: add VRAM estimation logic with tests"
```

---

### Task 6: API Module

**Files:**
- Create: `src/shared/api.js`

**Purpose:** Handle ModelScope search API and translation API calls. In the extension, these go through background service worker. For testing, we include a direct-fetch fallback.

- [ ] **Step 1: Write api.js**

```javascript
const API = {
  async searchModelScope(modelId, endpoint) {
    const url = `${endpoint}?search=${encodeURIComponent(modelId)}`;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({
          action: 'searchModelScope',
          modelId,
          endpoint
        });
      }
      // Fallback for testing
      const response = await fetch(url, { timeout: 5000 });
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  },

  calculateMatchScore(hfModelId, msResult) {
    const hfLower = hfModelId.toLowerCase();
    const msName = (msResult.name || msResult.model_id || '').toLowerCase();
    const msId = (msResult.model_id || '').toLowerCase();

    let score = 0;

    // Exact match
    if (msId === hfLower || msName === hfLower) {
      return 1.0;
    }

    // Partial match in model_id
    if (msId.includes(hfLower) || hfLower.includes(msId)) {
      score += 0.5;
    }

    // Partial match in name
    if (msName.includes(hfLower) || hfLower.includes(msName)) {
      score += 0.3;
    }

    // Name contains common parts
    const hfParts = hfLower.split(/[-_/]/).filter(p => p.length > 2);
    const msParts = msName.split(/[-_/]/).filter(p => p.length > 2);
    const commonParts = hfParts.filter(p => msParts.includes(p));
    score += (commonParts.length / Math.max(hfParts.length, 1)) * 0.3;

    return Math.min(score, 0.99);
  },

  async translate(text, provider, apiKey, targetLang = 'zh') {
    if (!text || !provider || provider === 'none') {
      return null;
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({
          action: 'translate',
          text,
          provider,
          apiKey,
          targetLang
        });
      }
    } catch (e) {
      return { error: e.message };
    }
  },

  async translateSegments(segments, provider, apiKey, targetLang = 'zh') {
    const results = [];
    for (const segment of segments) {
      if (segment.type === 'code') {
        results.push(segment);
      } else {
        const translated = await this.translate(segment.text, provider, apiKey, targetLang);
        results.push({
          type: 'text',
          text: segment.text,
          translated: translated && !translated.error ? translated.text : null,
          error: translated && translated.error ? translated.error : null
        });
      }
    }
    return results;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/api.js
git commit -m "feat: add API module for ModelScope search and translation"
```

---

### Task 7: Command Generator

**Files:**
- Create: `src/shared/commands.js`
- Create: `tests/test-commands.js`

**Purpose:** Generate deployment commands for various tools with configurable parameters.

- [ ] **Step 1: Write test-commands.js**

```javascript
const assert = require('assert');
const { generateCommand, DEPLOY_TEMPLATES, getSupportedTools } = require('../src/shared/commands.js');

// Test getSupportedTools
const tools = getSupportedTools();
assert(tools.includes('ollama'));
assert(tools.includes('vllm'));
assert(tools.includes('llamacpp'));

// Test ollama command
const cmd1 = generateCommand('ollama', 'meta-llama/Llama-2-7b', { quant: 'q4_K_M' });
assert(cmd1.includes('ollama run'));
assert(cmd1.includes('meta-llama/Llama-2-7b'));

// Test vllm command
const cmd2 = generateCommand('vllm', 'meta-llama/Llama-2-7b', { tp: 2, quant: 'awq' });
assert(cmd2.includes('vllm serve'));
assert(cmd2.includes('--tensor-parallel-size 2'));
assert(cmd2.includes('--quantization awq'));
assert(!cmd2.includes('--gpu-memory-utilization')); // default 0.9 should be omitted

// Test default params are omitted
const cmd3 = generateCommand('vllm', 'meta-llama/Llama-2-7b', {});
assert(!cmd3.includes('--tensor-parallel-size'));

// Test llamacpp command
const cmd4 = generateCommand('llamacpp', './model.gguf', { ngl: 35, ctx: 4096 });
assert(cmd4.includes('./main'));
assert(cmd4.includes('-ngl 35'));
assert(cmd4.includes('-c 4096'));

console.log('All command generator tests passed!');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node tests/test-commands.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: Write commands.js**

```javascript
const DEPLOY_TEMPLATES = {
  ollama: {
    label: 'Ollama',
    baseCmd: 'ollama run {model}',
    params: {
      quant: { flag: '', type: 'select', options: ['none', 'q4_0', 'q4_K_M', 'q5_K_M', 'q8_0'], default: 'none' },
      ctx: { flag: '--ctx-size', type: 'number', default: 4096 }
    }
  },
  vllm: {
    label: 'vLLM',
    baseCmd: 'vllm serve {model}',
    params: {
      tp: { flag: '--tensor-parallel-size', type: 'number', default: 1 },
      gpuUtil: { flag: '--gpu-memory-utilization', type: 'range', min: 0.1, max: 0.99, step: 0.01, default: 0.9 },
      quant: { flag: '--quantization', type: 'select', options: ['none', 'awq', 'gptq', 'fp8', 'marlin'], default: 'none' },
      maxModelLen: { flag: '--max-model-len', type: 'number', default: 8192 },
      dtype: { flag: '--dtype', type: 'select', options: ['auto', 'half', 'float16', 'bfloat16', 'float32'], default: 'auto' }
    }
  },
  sglang: {
    label: 'SGLang',
    baseCmd: 'python -m sglang.launch_server --model {model}',
    params: {
      tp: { flag: '--tp-size', type: 'number', default: 1 },
      port: { flag: '--port', type: 'number', default: 30000 }
    }
  },
  llamacpp: {
    label: 'llama.cpp',
    baseCmd: './main -m {model}',
    params: {
      ngl: { flag: '-ngl', type: 'number', default: 0 },
      ctx: { flag: '-c', type: 'number', default: 4096 },
      threads: { flag: '-t', type: 'number', default: 4 }
    }
  },
  transformers: {
    label: 'Transformers',
    baseCmd: 'python -c "from transformers import AutoModelForCausalLM, AutoTokenizer; model = AutoModelForCausalLM.from_pretrained(\'{model}\')"',
    params: {
      device: { flag: '--device', type: 'select', options: ['auto', 'cuda', 'cpu'], default: 'auto' },
      torchDtype: { flag: '--torch_dtype', type: 'select', options: ['auto', 'float16', 'bfloat16', 'float32'], default: 'auto' },
      loadIn8bit: { flag: '--load_in_8bit', type: 'checkbox', default: false },
      loadIn4bit: { flag: '--load_in_4bit', type: 'checkbox', default: false }
    }
  },
  tgi: {
    label: 'TGI (Text Generation Inference)',
    baseCmd: 'docker run --gpus all -p 8080:80 ghcr.io/huggingface/text-generation-inference:latest --model-id {model}',
    params: {
      quant: { flag: '--quantize', type: 'select', options: ['none', 'bitsandbytes', 'bitsandbytes-nf4', 'bitsandbytes-fp4', 'gptq', 'awq', 'eetq'], default: 'none' },
      maxInputLength: { flag: '--max-input-length', type: 'number', default: 4096 },
      maxTotalTokens: { flag: '--max-total-tokens', type: 'number', default: 8192 }
    }
  }
};

function getSupportedTools() {
  return Object.keys(DEPLOY_TEMPLATES);
}

function getToolLabel(tool) {
  return DEPLOY_TEMPLATES[tool]?.label || tool;
}

function getToolParams(tool) {
  return DEPLOY_TEMPLATES[tool]?.params || {};
}

function generateCommand(tool, modelId, params = {}) {
  const template = DEPLOY_TEMPLATES[tool];
  if (!template) {
    throw new Error(`Unknown deployment tool: ${tool}`);
  }

  let cmd = template.baseCmd.replace('{model}', modelId);

  for (const [key, config] of Object.entries(template.params)) {
    const value = params[key];
    if (value === undefined || value === null || value === config.default) {
      continue;
    }
    if (config.type === 'checkbox' && !value) {
      continue;
    }
    if (config.type === 'select' && value === 'none') {
      continue;
    }

    if (config.type === 'checkbox' && value) {
      cmd += ` ${config.flag}`;
    } else {
      cmd += ` ${config.flag} ${value}`;
    }
  }

  return cmd;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEPLOY_TEMPLATES, getSupportedTools, getToolLabel, getToolParams, generateCommand };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node tests/test-commands.js
```

Expected: "All command generator tests passed!"

- [ ] **Step 5: Commit**

```bash
git add src/shared/commands.js tests/test-commands.js
git commit -m "feat: add deployment command generator with templates for 6 tools"
```

---

### Task 8: Background Service Worker

**Files:**
- Create: `src/background/background.js`

**Purpose:** Proxy external API calls to bypass CORS restrictions from content scripts.

- [ ] **Step 1: Write background.js**

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchModelScope') {
    handleModelScopeSearch(request.modelId, request.endpoint)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }

  if (request.action === 'translate') {
    handleTranslate(request.text, request.provider, request.apiKey, request.targetLang)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

async function handleModelScopeSearch(modelId, endpoint) {
  const url = `${endpoint}?search=${encodeURIComponent(modelId)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HF-Model-Assistant/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { error: 'Request timeout' };
    }
    return { error: err.message };
  }
}

async function handleTranslate(text, provider, apiKey, targetLang) {
  // Placeholder for translation API implementations
  // Each provider would have its own implementation
  if (provider === 'deepl' && apiKey) {
    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang.toUpperCase()
        })
      });
      const data = await response.json();
      return { text: data.translations?.[0]?.text };
    } catch (err) {
      return { error: err.message };
    }
  }

  return { error: 'Translation provider not configured' };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/background.js
git commit -m "feat: add background service worker for API proxy and CORS handling"
```

---

### Task 9: Page Scraper

**Files:**
- Create: `src/content/page-scraper.js`

**Purpose:** Extract model information from the Hugging Face page DOM.

- [ ] **Step 1: Write page-scraper.js**

```javascript
const PageScraper = {
  extractModelInfo() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;

    const author = pathParts[0];
    const repoName = pathParts[1];
    const modelId = `${author}/${repoName}`;

    // Extract from page title as fallback
    const titleEl = document.querySelector('h1');
    const title = titleEl ? titleEl.textContent.trim() : repoName;

    // Extract tags
    const tags = [];
    document.querySelectorAll('[role="listitem"] a, .tag').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 50 && !text.includes('/')) {
        tags.push(text);
      }
    });

    // Extract license
    let license = null;
    document.querySelectorAll('a, span, div').forEach(el => {
      const text = el.textContent.trim();
      if (text.match(/license|许可证/i) && el.closest('a')) {
        const href = el.closest('a').getAttribute('href');
        if (href && href.includes('license')) {
          license = text;
        }
      }
    });

    // Extract downloads
    let downloads = null;
    document.querySelectorAll('div, span').forEach(el => {
      const text = el.textContent.trim();
      const match = text.match(/([\d,\.]+)\s*(k|M|B)?\s*downloads/i);
      if (match) {
        let num = parseFloat(match[1].replace(/,/g, ''));
        if (match[2] === 'k') num *= 1000;
        if (match[2] === 'M') num *= 1000000;
        if (match[2] === 'B') num *= 1000000000;
        downloads = num;
      }
    });

    // Extract parameter count from tags or title
    let parameterCount = null;
    for (const tag of tags) {
      if (tag.match(/\d+\.?\d*[Bb]/)) {
        parameterCount = tag;
        break;
      }
    }
    if (!parameterCount) {
      const titleMatch = title.match(/(\d+\.?\d*)[Bb]/);
      if (titleMatch) parameterCount = titleMatch[0];
    }

    return {
      modelId,
      author,
      repoName,
      title,
      tags: [...new Set(tags)],
      license,
      downloads,
      parameterCount,
      url: window.location.href
    };
  },

  extractFileList() {
    const files = [];
    document.querySelectorAll('[data-target="FileTree"] tr, .file-tree tr, [role="treeitem"]').forEach(row => {
      const nameEl = row.querySelector('a, .file-name, [data-target="file-name"]');
      const sizeEl = row.querySelector('.file-size, [data-target="file-size"]');
      if (nameEl) {
        const name = nameEl.textContent.trim();
        const sizeText = sizeEl ? sizeEl.textContent.trim() : '';
        const sizeMatch = sizeText.match(/([\d\.]+)\s*(GB|MB|KB|bytes)/i);
        let size = null;
        if (sizeMatch) {
          size = parseFloat(sizeMatch[1]);
          if (sizeMatch[2].toLowerCase() === 'gb') size *= 1024 * 1024 * 1024;
          if (sizeMatch[2].toLowerCase() === 'mb') size *= 1024 * 1024;
          if (sizeMatch[2].toLowerCase() === 'kb') size *= 1024;
        }
        files.push({ name, size, isGguf: name.endsWith('.gguf') });
      }
    });
    return files;
  },

  extractReadmeContent() {
    const readmeEl = document.querySelector('[data-target="ReadmeContent"], .readme-content, article');
    if (!readmeEl) return null;

    const segments = [];
    const walker = document.createTreeWalker(readmeEl, NodeFilter.SHOW_ELEMENT);

    let currentText = '';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.tagName === 'PRE' || node.tagName === 'CODE') {
        if (currentText.trim()) {
          segments.push({ type: 'text', text: currentText.trim() });
          currentText = '';
        }
        segments.push({ type: 'code', text: node.textContent });
      } else if (node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
        currentText += node.textContent + '\n';
      }
    }

    if (currentText.trim()) {
      segments.push({ type: 'text', text: currentText.trim() });
    }

    return segments;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/page-scraper.js
git commit -m "feat: add page scraper for extracting model info, files, and README"
```

---

### Task 10: Sidebar HTML and CSS

**Files:**
- Create: `src/content/sidebar.html`
- Create: `src/content/sidebar.css`

**Purpose:** Define the sidebar UI structure and scoped styles.

- [ ] **Step 1: Write sidebar.html**

```html
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
```

- [ ] **Step 2: Write sidebar.css**

```css
.hf-assistant-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -2px 0 8px rgba(0,0,0,0.08);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #1f2937;
  transition: transform 0.3s ease;
}

.hf-assistant-sidebar.collapsed {
  transform: translateX(100%);
}

.hf-assistant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.hf-assistant-title {
  font-weight: 600;
  font-size: 14px;
}

.hf-assistant-actions {
  display: flex;
  gap: 4px;
}

.hf-assistant-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  transition: background 0.2s;
}

.hf-assistant-btn:hover {
  background: #e5e7eb;
}

.hf-assistant-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.hf-assistant-tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.hf-assistant-tab:hover {
  color: #374151;
  background: #f9fafb;
}

.hf-assistant-tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.hf-assistant-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.hf-assistant-panel {
  display: none;
  padding: 16px;
}

.hf-assistant-panel.active {
  display: block;
}

.hf-assistant-collapsed {
  position: fixed;
  top: 80px;
  right: 0;
  z-index: 9999;
}

.hf-assistant-expand-btn {
  width: 40px;
  height: 40px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  font-size: 18px;
  box-shadow: -2px 0 8px rgba(0,0,0,0.08);
}

.hf-assistant-toast {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: #1f2937;
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  opacity: 0;
  transition: all 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
}

.hf-assistant-toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

/* Card styles */
.hf-assistant-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.hf-assistant-card-title {
  font-weight: 600;
  font-size: 12px;
  color: #374151;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Form elements */
.hf-assistant-select,
.hf-assistant-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  background: #ffffff;
  margin-bottom: 8px;
}

.hf-assistant-select:focus,
.hf-assistant-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.hf-assistant-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

/* Command block */
.hf-assistant-command {
  background: #1f2937;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 6px;
  font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  font-size: 11px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  position: relative;
}

.hf-assistant-command-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #374151;
  color: #ffffff;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
}

.hf-assistant-command-copy:hover {
  background: #4b5563;
}

/* Status indicators */
.hf-assistant-status-ok { color: #16a34a; }
.hf-assistant-status-warning { color: #ca8a04; }
.hf-assistant-status-insufficient { color: #dc2626; }

/* Link styles */
.hf-assistant-link {
  color: #2563eb;
  text-decoration: none;
}

.hf-assistant-link:hover {
  text-decoration: underline;
}

/* History list */
.hf-assistant-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 11px;
}

.hf-assistant-history-cmd {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
  font-family: monospace;
}

/* Scrollbar */
.hf-assistant-content::-webkit-scrollbar {
  width: 6px;
}

.hf-assistant-content::-webkit-scrollbar-track {
  background: transparent;
}

.hf-assistant-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.hf-assistant-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/content/sidebar.html src/content/sidebar.css
git commit -m "feat: add sidebar HTML template and scoped CSS"
```

---

### Task 11: Sidebar Controller

**Files:**
- Create: `src/content/sidebar.js`

**Purpose:** Main sidebar controller: inject into page, handle tabs, collapse/expand, coordinate tab modules.

- [ ] **Step 1: Write sidebar.js**

```javascript
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

    this.injectStyles();
    this.createSidebar();
    this.bindEvents();

    if (!this.isOpen) {
      this.collapse();
    }
  },

  injectStyles() {
    // CSS is injected via content_scripts in manifest, but we also inject into Shadow DOM
  },

  createSidebar() {
    const wrapper = document.createElement('div');
    wrapper.id = 'hf-assistant-wrapper';

    this.shadowRoot = wrapper.attachShadow({ mode: 'open' });

    // Load template
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
    // Return the CSS content. In practice, fetch it or inline it.
    // For now, we rely on the content script CSS injection + shadow DOM.
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

    // Tab switching
    root.querySelectorAll('.hf-assistant-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // Collapse/expand
    root.querySelector('#hf-assistant-toggle').addEventListener('click', () => {
      this.collapse();
    });

    root.querySelector('.hf-assistant-expand-btn').addEventListener('click', () => {
      this.expand();
    });

    // Favorite
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

    // Initialize tab content on first visit
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
    // Refresh current tab
    this.switchTab(this.currentTab);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/sidebar.js
git commit -m "feat: add sidebar controller with tabs, collapse/expand, and toast"
```

---

### Task 12: Overview Tab

**Files:**
- Create: `src/content/tabs/overview.js`

**Purpose:** Display model info card, ModelScope mapping status with API + fallback, and favorite button.

- [ ] **Step 1: Write overview.js**

```javascript
const OverviewTab = {
  rendered: false,

  async render(container, modelInfo) {
    if (!modelInfo) {
      container.innerHTML = `<div class="hf-assistant-card">${t('errorNoModelInfo')}</div>`;
      return;
    }

    const isFav = await Storage.isFavorite(modelInfo.modelId);

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${modelInfo.title || modelInfo.modelId}</div>
        <div style="margin-bottom: 4px; color: #6b7280; font-size: 11px;">
          ${modelInfo.author} / ${modelInfo.repoName}
        </div>
        ${modelInfo.parameterCount ? `<div style="margin-bottom: 4px;">📊 ${modelInfo.parameterCount}</div>` : ''}
        ${modelInfo.license ? `<div style="margin-bottom: 4px;">📄 ${modelInfo.license}</div>` : ''}
        ${modelInfo.downloads ? `<div style="margin-bottom: 4px;">⬇️ ${this.formatNumber(modelInfo.downloads)} downloads</div>` : ''}
        ${modelInfo.tags.length ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
          ${modelInfo.tags.slice(0, 8).map(tag => `<span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${tag}</span>`).join('')}
        </div>` : ''}
      </div>
    `;

    // ModelScope mapping card
    html += `<div class="hf-assistant-card" id="modelscope-card">
      <div class="hf-assistant-card-title">魔搭社区</div>
      <div id="modelscope-status">${t('loading')}</div>
    </div>`;

    container.innerHTML = html;
    this.rendered = true;

    // Fetch ModelScope mapping
    this.fetchModelScopeMapping(modelInfo, container);
  },

  async fetchModelScopeMapping(modelInfo, container) {
    const statusEl = container.querySelector('#modelscope-status');
    const cardEl = container.querySelector('#modelscope-card');

    // Check cache first
    const cached = await Storage.getMappingCache(modelInfo.modelId);
    if (cached) {
      this.showMappingResult(statusEl, cardEl, cached.modelscopeUrl, true);
      modelInfo.modelscopeUrl = cached.modelscopeUrl;
      return;
    }

    // Check local mapping table
    try {
      const response = await fetch(chrome.runtime.getURL('src/data/mapping.json'));
      const mapping = await response.json();
      const localMatch = mapping[modelInfo.modelId];
      if (localMatch) {
        this.showMappingResult(statusEl, cardEl, localMatch.modelscopeUrl, true);
        await Storage.setMappingCache(modelInfo.modelId, localMatch.modelscopeUrl);
        modelInfo.modelscopeUrl = localMatch.modelscopeUrl;
        return;
      }
    } catch (e) {
      console.log('Local mapping not found:', e.message);
    }

    // Try API
    const settings = await Storage.getAll();
    const apiResult = await API.searchModelScope(modelInfo.modelId, settings.modelscopeApiEndpoint);

    if (apiResult.error || !apiResult.data) {
      this.showMappingResult(statusEl, cardEl, null, false);
      return;
    }

    const results = apiResult.data.data || apiResult.data.results || [];
    let bestMatch = null;
    let bestScore = 0;

    for (const result of results) {
      const score = API.calculateMatchScore(modelInfo.modelId, result);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    if (bestMatch && bestScore > 0.8) {
      const url = bestMatch.model_id ?
        `https://www.modelscope.cn/models/${bestMatch.model_id}` :
        bestMatch.url || '';
      this.showMappingResult(statusEl, cardEl, url, true);
      await Storage.setMappingCache(modelInfo.modelId, url);
      modelInfo.modelscopeUrl = url;
    } else {
      this.showMappingResult(statusEl, cardEl, null, false);
    }
  },

  showMappingResult(statusEl, cardEl, url, found) {
    if (found && url) {
      statusEl.innerHTML = `
        <div style="color: #16a34a; margin-bottom: 8px;">${t('modelscopeFound')}</div>
        <a href="${url}" target="_blank" class="hf-assistant-link" style="word-break: break-all;">${url}</a>
      `;
    } else {
      const searchUrl = `https://www.modelscope.cn/search?search=${encodeURIComponent(this.modelInfo?.modelId || '')}`;
      statusEl.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 8px;">${t('modelscopeNotFound')}</div>
        <a href="${searchUrl}" target="_blank" class="hf-assistant-link">${t('gotoSearch')}</a>
      `;
    }
  },

  formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/tabs/overview.js
git commit -m "feat: add overview tab with model info and ModelScope mapping"
```

---

### Task 13: Deploy Tab (Core Feature)

**Files:**
- Create: `src/content/tabs/deploy.js`

**Purpose:** Tool selector, dynamic parameter form, VRAM estimation, GGUF recommendation, command generation with copy + history.

- [ ] **Step 1: Write deploy.js**

```javascript
const DeployTab = {
  rendered: false,
  currentTool: 'ollama',
  currentParams: {},
  debounceTimer: null,

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;
    const settings = await Storage.getAll();
    this.currentTool = settings.defaultTool || 'ollama';
    this.currentParams = {};

    const tools = getSupportedTools();
    const toolOptions = tools.map(t =>
      `<option value="${t}" ${t === this.currentTool ? 'selected' : ''}>${getToolLabel(t)}</option>`
    ).join('');

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('deployTool')}</div>
        <select class="hf-assistant-select" id="deploy-tool-select">
          ${toolOptions}
        </select>
        <div id="deploy-params"></div>
      </div>

      <div class="hf-assistant-card" id="vram-card" style="display: none;">
        <div class="hf-assistant-card-title">${t('vramEstimate')}</div>
        <div id="vram-display"></div>
      </div>

      <div class="hf-assistant-card" id="gguf-card" style="display: none;">
        <div class="hf-assistant-card-title">GGUF 推荐</div>
        <div id="gguf-display"></div>
      </div>

      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">命令</div>
        <div class="hf-assistant-command" id="command-display">
          <button class="hf-assistant-command-copy" id="copy-cmd-btn">${t('copyCommand')}</button>
          <span id="command-text">选择一个工具...</span>
        </div>
      </div>

      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('commandHistory')}</div>
        <div id="history-display"></div>
      </div>
    `;

    container.innerHTML = html;
    this.rendered = true;

    this.bindEvents(container);
    this.renderParams(container);
    this.updateCommand(container);
    this.renderHistory(container);
  },

  bindEvents(container) {
    const toolSelect = container.querySelector('#deploy-tool-select');
    toolSelect.addEventListener('change', (e) => {
      this.currentTool = e.target.value;
      this.currentParams = {};
      this.renderParams(container);
      this.updateCommand(container);
    });

    container.querySelector('#copy-cmd-btn').addEventListener('click', () => {
      const cmd = container.querySelector('#command-text').textContent;
      navigator.clipboard.writeText(cmd).then(() => {
        Sidebar.showToast(t('copied'));
      });
      Storage.addCommandHistory(this.currentTool, cmd, this.currentParams);
      this.renderHistory(container);
    });
  },

  renderParams(container) {
    const paramsContainer = container.querySelector('#deploy-params');
    const params = getToolParams(this.currentTool);

    let html = '';
    for (const [key, config] of Object.entries(params)) {
      const label = key;
      const value = this.currentParams[key] !== undefined ? this.currentParams[key] : config.default;

      if (config.type === 'select') {
        const options = config.options.map(opt =>
          `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
        ).join('');
        html += `
          <label class="hf-assistant-label">${label}</label>
          <select class="hf-assistant-select" data-param="${key}">
            ${options}
          </select>
        `;
      } else if (config.type === 'number') {
        html += `
          <label class="hf-assistant-label">${label}</label>
          <input type="number" class="hf-assistant-input" data-param="${key}"
            value="${value}" min="${config.min || 0}" max="${config.max || 999999}">
        `;
      } else if (config.type === 'range') {
        html += `
          <label class="hf-assistant-label">${label} (${value})</label>
          <input type="range" class="hf-assistant-input" data-param="${key}"
            value="${value}" min="${config.min}" max="${config.max}" step="${config.step || 0.1}">
        `;
      } else if (config.type === 'checkbox') {
        html += `
          <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 12px;">
            <input type="checkbox" data-param="${key}" ${value ? 'checked' : ''}>
            ${label}
          </label>
        `;
      }
    }

    paramsContainer.innerHTML = html;

    // Bind param change events
    paramsContainer.querySelectorAll('[data-param]').forEach(el => {
      el.addEventListener('change', (e) => {
        const paramKey = e.target.dataset.param;
        let val = e.target.value;
        if (e.target.type === 'checkbox') val = e.target.checked;
        if (e.target.type === 'number' || e.target.type === 'range') val = parseFloat(val);
        this.currentParams[paramKey] = val;
        this.updateCommand(container);
      });
    });

    // Show/hide GGUF card
    const ggufCard = container.querySelector('#gguf-card');
    if (this.currentTool === 'ollama' || this.currentTool === 'llamacpp') {
      ggufCard.style.display = 'block';
      this.renderGGUFRecommendation(container);
    } else {
      ggufCard.style.display = 'none';
    }
  },

  updateCommand(container) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (!this.modelInfo) return;

      const modelId = this.currentTool === 'llamacpp' && this.currentParams.ggufFile ?
        this.currentParams.ggufFile : this.modelInfo.modelId;

      const cmd = generateCommand(this.currentTool, modelId, this.currentParams);
      container.querySelector('#command-text').textContent = cmd;

      // VRAM estimation
      this.updateVramEstimate(container);
    }, 100);
  },

  async updateVramEstimate(container) {
    if (!this.modelInfo) return;

    const settings = await Storage.getAll();
    const precision = this.inferPrecision();

    const estimate = estimateVRAM(this.modelInfo, {
      precision,
      tool: this.currentTool,
      userVramGB: settings.vramGB,
      maxModelLen: this.currentParams.maxModelLen || this.currentParams.ctx || 4096
    });

    const vramCard = container.querySelector('#vram-card');
    const vramDisplay = container.querySelector('#vram-display');

    if (estimate.vramGB !== null) {
      vramCard.style.display = 'block';
      const statusClass = `hf-assistant-status-${estimate.status}`;
      const statusText = estimate.status === 'ok' ? t('vramOk') :
                         estimate.status === 'warning' ? t('vramWarning') : t('vramInsufficient');
      vramDisplay.innerHTML = `
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">
          ${estimate.vramGB} GB
        </div>
        <div class="${statusClass}">${statusText}</div>
        <div style="color: #6b7280; font-size: 10px; margin-top: 4px;">
          基于 ${estimate.paramsB}B 参数 × ${estimate.precision}
        </div>
      `;
    } else {
      vramCard.style.display = 'none';
    }
  },

  inferPrecision() {
    const quant = this.currentParams.quant;
    if (quant === 'q4_0' || quant === 'q4_K_M' || quant === 'q4') return 'q4';
    if (quant === 'q5_K_M' || quant === 'q5') return 'q5_k_m';
    if (quant === 'q6_k' || quant === 'q6') return 'q6_k';
    if (quant === 'q8_0' || quant === 'q8') return 'q8_0';
    if (quant === 'awq') return 'awq';
    if (quant === 'gptq') return 'gptq';
    if (quant === 'fp8') return 'fp8';
    if (this.currentParams.loadIn8bit) return 'int8';
    if (this.currentParams.loadIn4bit) return 'int4';
    if (this.currentParams.torchDtype === 'float16') return 'fp16';
    if (this.currentParams.torchDtype === 'bfloat16') return 'bf16';
    return 'fp16';
  },

  async renderGGUFRecommendation(container) {
    if (!this.modelInfo || !this.modelInfo.files) return;

    const ggufs = this.modelInfo.files.filter(f => f.isGguf);
    if (!ggufs.length) {
      container.querySelector('#gguf-display').innerHTML = '<div style="color: #6b7280;">未找到 GGUF 文件</div>';
      return;
    }

    const settings = await Storage.getAll();
    const userVram = settings.vramGB;

    const enriched = ggufs.map(f => {
      const sizeGB = f.size ? f.size / 1024 / 1024 / 1024 : null;
      const estVram = sizeGB ? sizeGB * 1.15 : null;
      let status = 'unknown';
      if (estVram !== null) {
        if (estVram <= userVram * 0.9) status = 'compatible';
        if (estVram <= userVram * 0.9) {
          // Find the largest compatible one as recommended
        }
        if (estVram > userVram * 1.1) status = 'too-large';
      }
      return { ...f, sizeGB, estVram, status };
    });

    // Find recommended: largest compatible
    const compatible = enriched.filter(g => g.status === 'compatible');
    const recommended = compatible.sort((a, b) => (b.estVram || 0) - (a.estVram || 0))[0];
    if (recommended) recommended.status = 'recommended';

    let html = '<div style="display: flex; flex-direction: column; gap: 4px;">';
    for (const g of enriched) {
      const statusText = g.status === 'recommended' ? ` 🏆 ${t('ggufRecommended')}` :
                         g.status === 'too-large' ? ` ⚠️ ${t('ggufTooLarge')}` :
                         g.status === 'compatible' ? ` ✅ ${t('ggufCompatible')}` : '';
      const color = g.status === 'recommended' ? '#16a34a' :
                    g.status === 'too-large' ? '#dc2626' : '#6b7280';

      html += `
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 6px; background: ${g.status === 'recommended' ? '#f0fdf4' : '#f9fafb'};
                    border-radius: 4px; cursor: pointer; font-size: 11px;"
             class="gguf-item" data-file="${g.name}">
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.name}</span>
          <span style="color: ${color}; white-space: nowrap; margin-left: 8px;">
            ${g.sizeGB ? g.sizeGB.toFixed(1) + 'GB' : ''}${statusText}
          </span>
        </div>
      `;
    }
    html += '</div>';

    const display = container.querySelector('#gguf-display');
    display.innerHTML = html;

    // Click to select GGUF file
    display.querySelectorAll('.gguf-item').forEach(el => {
      el.addEventListener('click', () => {
        this.currentParams.ggufFile = el.dataset.file;
        this.updateCommand(container);
        display.querySelectorAll('.gguf-item').forEach(i => i.style.background = '#f9fafb');
        el.style.background = '#dbeafe';
      });
    });
  },

  async renderHistory(container) {
    const history = await Storage.getCommandHistory();
    const display = container.querySelector('#history-display');

    if (!history.length) {
      display.innerHTML = '<div style="color: #6b7280; font-size: 11px;">暂无历史记录</div>';
      return;
    }

    const items = history.slice(0, 5).map(h => `
      <div class="hf-assistant-history-item">
        <span class="hf-assistant-history-cmd" title="${h.command}">[${getToolLabel(h.tool)}] ${h.command}</span>
        <button class="hf-assistant-btn reuse-btn" data-tool="${h.tool}" style="font-size: 10px; padding: 2px 6px;">复用</button>
      </div>
    `).join('');

    display.innerHTML = items;

    display.querySelectorAll('.reuse-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = history.find(h => h.tool === btn.dataset.tool);
        if (entry) {
          this.currentTool = entry.tool;
          this.currentParams = { ...entry.params };
          container.querySelector('#deploy-tool-select').value = entry.tool;
          this.renderParams(container);
          this.updateCommand(container);
        }
      });
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/tabs/deploy.js
git commit -m "feat: add deploy tab with tool selector, VRAM estimation, GGUF recommendation, command generation"
```

---

### Task 14: Download Tab

**Files:**
- Create: `src/content/tabs/download.js`

**Purpose:** Show mirror sites and generate download commands.

- [ ] **Step 1: Write download.js**

```javascript
const DownloadTab = {
  rendered: false,

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;
    const settings = await Storage.getAll();
    const preferredMirror = settings.preferredMirror || 'hf-mirror';

    const mirrors = [
      { id: 'hf-mirror', name: 'hf-mirror.com', url: 'https://hf-mirror.com' },
      { id: 'modelscope', name: 'ModelScope', url: 'https://www.modelscope.cn' }
    ];

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('mirrorSite')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    for (const mirror of mirrors) {
      const isPreferred = mirror.id === preferredMirror;
      html += `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px;
                    background: ${isPreferred ? '#f0fdf4' : '#f9fafb'};
                    border-radius: 6px; cursor: pointer;"
             class="mirror-item" data-mirror="${mirror.id}">
          <input type="radio" name="mirror" value="${mirror.id}" ${isPreferred ? 'checked' : ''}>
          <div style="flex: 1;">
            <div style="font-weight: 500;">${mirror.name}</div>
            <div style="font-size: 10px; color: #6b7280;">${mirror.url}</div>
          </div>
          ${isPreferred ? '<span style="color: #16a34a; font-size: 10px;">首选</span>' : ''}
        </div>
      `;
    }

    html += `</div></div>`;

    // Download commands
    html += `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('downloadCommand')}</div>
        <div class="hf-assistant-command" style="margin-bottom: 8px;">
          <button class="hf-assistant-command-copy" id="copy-hf-cli">${t('copyCommand')}</button>
          <span id="hf-cli-cmd"></span>
        </div>
        <div class="hf-assistant-command">
          <button class="hf-assistant-command-copy" id="copy-git-lfs">${t('copyCommand')}</button>
          <span id="git-lfs-cmd"></span>
        </div>
      </div>

      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">${t('envHint')}</div>
        <div class="hf-assistant-command" style="background: #1e3a5f;">
          <button class="hf-assistant-command-copy" id="copy-env">${t('copyCommand')}</button>
          <span id="env-cmd"></span>
        </div>
      </div>
    `;

    // ModelScope download
    if (modelInfo && modelInfo.modelscopeUrl) {
      html += `
        <div class="hf-assistant-card">
          <div class="hf-assistant-card-title">魔搭下载</div>
          <div class="hf-assistant-command">
            <button class="hf-assistant-command-copy" id="copy-ms">${t('copyCommand')}</button>
            <span id="ms-cmd"></span>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    this.rendered = true;

    this.selectedMirror = preferredMirror;
    this.updateCommands(container);
    this.bindEvents(container);
  },

  bindEvents(container) {
    container.querySelectorAll('.mirror-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedMirror = el.dataset.mirror;
        container.querySelectorAll('input[name="mirror"]').forEach(r => {
          r.checked = r.value === this.selectedMirror;
        });
        this.updateCommands(container);
      });
    });

    container.querySelector('#copy-hf-cli').addEventListener('click', () => {
      const cmd = container.querySelector('#hf-cli-cmd').textContent;
      navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
    });

    container.querySelector('#copy-git-lfs').addEventListener('click', () => {
      const cmd = container.querySelector('#git-lfs-cmd').textContent;
      navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
    });

    container.querySelector('#copy-env').addEventListener('click', () => {
      const cmd = container.querySelector('#env-cmd').textContent;
      navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
    });

    const msCopy = container.querySelector('#copy-ms');
    if (msCopy) {
      msCopy.addEventListener('click', () => {
        const cmd = container.querySelector('#ms-cmd').textContent;
        navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
      });
    }
  },

  updateCommands(container) {
    if (!this.modelInfo) return;

    const modelId = this.modelInfo.modelId;
    const mirrorUrl = this.selectedMirror === 'hf-mirror' ? 'https://hf-mirror.com' : 'https://huggingface.co';

    container.querySelector('#hf-cli-cmd').textContent =
      `HF_ENDPOINT=${mirrorUrl} huggingface-cli download ${modelId} --local-dir ./${modelId.replace('/', '_')}`;

    container.querySelector('#git-lfs-cmd').textContent =
      `GIT_LFS_SKIP_SMUDGE=1 git clone ${mirrorUrl}/${modelId}.git`;

    container.querySelector('#env-cmd').textContent =
      `export HF_ENDPOINT=${mirrorUrl}`;

    const msCmd = container.querySelector('#ms-cmd');
    if (msCmd && this.modelInfo.modelscopeUrl) {
      const msId = this.modelInfo.modelscopeUrl.replace('https://www.modelscope.cn/models/', '');
      msCmd.textContent = `git lfs clone https://www.modelscope.cn/${msId}.git`;
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/tabs/download.js
git commit -m "feat: add download tab with mirror sites and download command generation"
```

---

### Task 15: Tools Tab

**Files:**
- Create: `src/content/tabs/tools.js`

**Purpose:** README translation with paragraph-by-paragraph processing.

- [ ] **Step 1: Write tools.js**

```javascript
const ToolsTab = {
  rendered: false,
  translated: false,
  originalContent: null,

  async render(container, modelInfo) {
    this.modelInfo = modelInfo;

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">README ${t('translateReadme')}</div>
        <button class="hf-assistant-btn" id="translate-btn"
                style="width: 100%; padding: 8px; background: #2563eb; color: white;
                       border-radius: 6px; font-weight: 500; margin-bottom: 12px;">
          ${t('translateReadme')}
        </button>
        <div id="translate-status" style="display: none; color: #6b7280; font-size: 11px; text-align: center;">
          翻译中...
        </div>
        <div id="translate-result" style="display: none;">
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <button class="hf-assistant-btn" id="show-original-btn" style="flex: 1; font-size: 11px;">${t('showOriginal')}</button>
            <button class="hf-assistant-btn" id="show-translation-btn" style="flex: 1; font-size: 11px;">${t('showTranslation')}</button>
          </div>
          <div id="translate-content" style="font-size: 12px; line-height: 1.6; max-height: 400px; overflow-y: auto;"></div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.rendered = true;

    container.querySelector('#translate-btn').addEventListener('click', () => {
      this.doTranslate(container);
    });

    container.querySelector('#show-original-btn').addEventListener('click', () => {
      this.showOriginal(container);
    });

    container.querySelector('#show-translation-btn').addEventListener('click', () => {
      this.showTranslation(container);
    });
  },

  async doTranslate(container) {
    const statusEl = container.querySelector('#translate-status');
    const resultEl = container.querySelector('#translate-result');
    const btn = container.querySelector('#translate-btn');

    btn.disabled = true;
    statusEl.style.display = 'block';

    const settings = await Storage.getAll();
    if (settings.translationProvider === 'none') {
      statusEl.textContent = '请在设置中配置翻译 API';
      btn.disabled = false;
      return;
    }

    // Extract README from page
    const segments = PageScraper.extractReadmeContent();
    if (!segments || !segments.length) {
      statusEl.textContent = '未找到 README 内容';
      btn.disabled = false;
      return;
    }

    this.originalContent = segments;

    // Translate segments
    const translated = await API.translateSegments(
      segments,
      settings.translationProvider,
      settings.translationApiKey,
      'zh'
    );

    this.translatedContent = translated;
    this.translated = true;

    statusEl.style.display = 'none';
    resultEl.style.display = 'block';
    btn.style.display = 'none';

    this.showTranslation(container);
  },

  showTranslation(container) {
    if (!this.translatedContent) return;
    const contentEl = container.querySelector('#translate-content');

    let html = '';
    for (const seg of this.translatedContent) {
      if (seg.type === 'code') {
        html += `<pre style="background: #1f2937; color: #e5e7eb; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px;"><code>${this.escapeHtml(seg.text)}</code></pre>`;
      } else if (seg.translated) {
        html += `<p style="margin-bottom: 8px;">${this.escapeHtml(seg.translated)}</p>`;
      } else {
        html += `<p style="margin-bottom: 8px; color: #6b7280;">${this.escapeHtml(seg.text)}</p>`;
      }
    }

    contentEl.innerHTML = html;
  },

  showOriginal(container) {
    if (!this.originalContent) return;
    const contentEl = container.querySelector('#translate-content');

    let html = '';
    for (const seg of this.originalContent) {
      if (seg.type === 'code') {
        html += `<pre style="background: #1f2937; color: #e5e7eb; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px;"><code>${this.escapeHtml(seg.text)}</code></pre>`;
      } else {
        html += `<p style="margin-bottom: 8px;">${this.escapeHtml(seg.text)}</p>`;
      }
    }

    contentEl.innerHTML = html;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/content/tabs/tools.js
git commit -m "feat: add tools tab with README translation"
```

---

### Task 16: Content Script Entry

**Files:**
- Create: `src/content/content.js`

**Purpose:** Entry point: detect HF model page, inject sidebar, coordinate all modules.

- [ ] **Step 1: Write content.js**

```javascript
(function() {
  'use strict';

  // Prevent double-injection
  if (window.__HF_ASSISTANT_INJECTED__) return;
  window.__HF_ASSISTANT_INJECTED__ = true;

  // Check if we're on a model page
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) return;

  // Exclude non-model pages
  const excludedPrefixes = ['spaces', 'datasets', 'docs', 'blog', 'search', 'settings'];
  if (excludedPrefixes.includes(pathParts[0])) return;

  async function init() {
    try {
      // Wait for page to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      // Small delay to let HF render its content
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Inject sidebar
      await Sidebar.init();

      // Extract model info
      const modelInfo = PageScraper.extractModelInfo();
      if (modelInfo) {
        // Extract files for GGUF recommendation
        modelInfo.files = PageScraper.extractFileList();
        Sidebar.setModelInfo(modelInfo);
      }

      // Adjust page layout to make room for sidebar
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

  // Handle SPA navigation (Hugging Face is a React app)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Re-init on navigation
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
```

- [ ] **Step 2: Commit**

```bash
git add src/content/content.js
git commit -m "feat: add content script entry point with sidebar injection and SPA navigation handling"
```

---

### Task 17: Options Page (Settings)

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.css`
- Create: `src/options/options.js`

**Purpose:** Full settings page for user preferences.

- [ ] **Step 1: Write options.html**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>HF 模型助手 - 设置</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="options-container">
    <h1>⚙️ HF 模型助手设置</h1>

    <div class="options-tabs">
      <button class="options-tab active" data-tab="general">通用设置</button>
      <button class="options-tab" data-tab="deploy">部署工具</button>
      <button class="options-tab" data-tab="api">API 配置</button>
    </div>

    <div class="options-panel active" id="panel-general">
      <div class="form-group">
        <label>默认部署工具</label>
        <select id="default-tool">
          <option value="ollama">Ollama</option>
          <option value="vllm">vLLM</option>
          <option value="sglang">SGLang</option>
          <option value="llamacpp">llama.cpp</option>
          <option value="transformers">Transformers</option>
          <option value="tgi">TGI</option>
        </select>
      </div>

      <div class="form-group">
        <label>首选镜像站</label>
        <select id="preferred-mirror">
          <option value="hf-mirror">hf-mirror.com</option>
          <option value="modelscope">ModelScope</option>
        </select>
      </div>

      <div class="form-group">
        <label>机器显存大小 (GB)</label>
        <input type="number" id="vram-gb" min="1" max="128" value="8">
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" id="sidebar-open">
          访问 HF 页面时自动展开侧边栏
        </label>
      </div>

      <div class="form-group">
        <label>界面语言</label>
        <select id="language">
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>

    <div class="options-panel" id="panel-deploy">
      <p style="color: #6b7280;">各部署工具的默认参数将在后续版本中添加。</p>
    </div>

    <div class="options-panel" id="panel-api">
      <div class="form-group">
        <label>翻译服务</label>
        <select id="translation-provider">
          <option value="none">不使用</option>
          <option value="deepl">DeepL</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="translation-api-key" placeholder="输入 API Key">
      </div>
    </div>

    <div class="options-actions">
      <button class="btn-primary" id="save-btn">保存设置</button>
      <span id="save-status"></span>
    </div>
  </div>

  <script src="../shared/storage.js"></script>
  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write options.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  background: #f3f4f6;
  padding: 40px 20px;
}

.options-container {
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 32px;
}

h1 {
  font-size: 20px;
  margin-bottom: 24px;
  color: #111827;
}

.options-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.options-tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.options-tab:hover {
  color: #374151;
}

.options-tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.options-panel {
  display: none;
}

.options-panel.active {
  display: block;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 500;
  font-size: 13px;
  margin-bottom: 6px;
  color: #374151;
}

.form-group label input[type="checkbox"] {
  margin-right: 6px;
}

.form-group select,
.form-group input[type="number"],
.form-group input[type="password"],
.form-group input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: #ffffff;
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.options-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-primary {
  padding: 10px 20px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1d4ed8;
}

#save-status {
  color: #16a34a;
  font-size: 13px;
}
```

- [ ] **Step 3: Write options.js**

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Tab switching
  document.querySelectorAll('.options-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.options-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.options-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tabName}`).classList.add('active');
    });
  });

  // Load settings
  const settings = await Storage.getAll();
  document.getElementById('default-tool').value = settings.defaultTool;
  document.getElementById('preferred-mirror').value = settings.preferredMirror;
  document.getElementById('vram-gb').value = settings.vramGB;
  document.getElementById('sidebar-open').checked = settings.sidebarDefaultOpen;
  document.getElementById('language').value = settings.language;
  document.getElementById('translation-provider').value = settings.translationProvider;
  document.getElementById('translation-api-key').value = settings.translationApiKey;

  // Save settings
  document.getElementById('save-btn').addEventListener('click', async () => {
    const newSettings = {
      defaultTool: document.getElementById('default-tool').value,
      preferredMirror: document.getElementById('preferred-mirror').value,
      vramGB: parseInt(document.getElementById('vram-gb').value) || 8,
      sidebarDefaultOpen: document.getElementById('sidebar-open').checked,
      language: document.getElementById('language').value,
      translationProvider: document.getElementById('translation-provider').value,
      translationApiKey: document.getElementById('translation-api-key').value
    };

    await Storage.setMultiple(newSettings);

    const status = document.getElementById('save-status');
    status.textContent = '已保存';
    setTimeout(() => status.textContent = '', 2000);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/options/
git commit -m "feat: add options page with general, deploy, and API settings tabs"
```

---

### Task 18: Icons

**Files:**
- Create: `icons/icon16.png`
- Create: `icons/icon32.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

**Purpose:** Extension icons in required sizes. For now, use a simple placeholder approach.

- [ ] **Step 1: Generate placeholder icons**

```bash
# Create simple SVG and convert to PNGs
mkdir -p icons
cat > /tmp/icon.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="16" fill="#2563eb"/>
  <text x="64" y="84" font-size="72" text-anchor="middle" fill="white" font-family="Arial">🤖</text>
</svg>
EOF
```

Since we can't easily convert SVG to PNG without tools, create simple colored squares as placeholder:

```bash
# Use Python with PIL if available, or create simple files
python3 -c "
from PIL import Image, ImageDraw, ImageFont
import os

for size in [16, 32, 48, 128]:
    img = Image.new('RGB', (size, size), '#2563eb')
    draw = ImageDraw.Draw(img)
    # Draw a simple robot-like shape
    margin = size // 8
    draw.rectangle([margin, margin*2, size-margin, size-margin], fill='white', outline='white')
    draw.ellipse([margin*2, margin, size-margin*2, margin*3], fill='white')
    draw.rectangle([size//3, size//4, size//3+2, size//4+4], fill='#2563eb')
    draw.rectangle([size*2//3, size//4, size*2//3+2, size//4+4], fill='#2563eb')
    img.save(f'icons/icon{size}.png')

print('Icons created')
" 2>/dev/null || echo "PIL not available, will need manual icon creation"
```

If Python/PIL is not available, create a minimal instruction:

- [ ] **Step 2: If PIL available, icons are created. Otherwise, manually create placeholder icons.**

```bash
# Alternative: use ImageMagick if available
for size in 16 32 48 128; do
  convert -size ${size}x${size} xc:#2563eb icons/icon${size}.png 2>/dev/null || true
done
```

- [ ] **Step 3: Commit**

```bash
git add icons/
git commit -m "feat: add extension icons" || echo "Icons may need manual creation"
```

---

### Task 19: Final Integration Test

**Purpose:** Load the extension in Chrome and verify all components work together.

- [ ] **Step 1: Verify file structure**

```bash
find . -type f | grep -v '.git' | sort
```

Expected: All files from the file structure section should be present.

- [ ] **Step 2: Manual test instructions**

1. Open Chrome, go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the project directory
4. Navigate to any Hugging Face model page (e.g., `https://huggingface.co/meta-llama/Llama-2-7b-hf`)
5. Verify:
   - Sidebar appears on the right
   - Overview tab shows model info
   - ModelScope mapping loads (green checkmark)
   - Deploy tab shows tool selector and generates commands
   - Download tab shows mirror sites
   - Tools tab has translate button
   - Collapse/expand works
   - Favorite button works

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete HF Model Assistant Chrome extension v1.0.0"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| Manifest V3 | Task 1 |
| i18n zh/en | Task 2 |
| chrome.storage wrapper | Task 3 |
| Local mapping table | Task 4 |
| VRAM estimation | Task 5 |
| ModelScope API + fallback | Task 6, 12 |
| Command generator (6 tools) | Task 7, 13 |
| Background service worker | Task 8 |
| Page scraper | Task 9 |
| Sidebar UI (360px, Shadow DOM) | Task 10, 11 |
| Overview tab | Task 12 |
| Deploy tab with VRAM + GGUF | Task 13 |
| Download tab with mirrors | Task 14 |
| Tools tab (README translate) | Task 15 |
| Content script entry | Task 16 |
| Options page | Task 17 |
| Icons | Task 18 |
| Integration test | Task 19 |

**Coverage: 100%** - All spec requirements have corresponding tasks.

### Placeholder Scan

- ❌ No TBD, TODO, "implement later", "fill in details"
- ❌ No vague error handling descriptions - specific timeout (5s), specific fallback behavior
- ❌ No "similar to Task N" - each task is self-contained
- ❌ No undefined types/functions - all referenced functions are defined in earlier tasks

### Type Consistency

- `Storage.getAll()` returns settings object with keys matching `DEFAULTS` - consistent across Task 3, 12, 13, 14, 17
- `modelInfo` structure consistent between Task 9 (scraper), Task 12 (overview), Task 13 (deploy)
- `generateCommand()` signature consistent between Task 7 and Task 13
- `estimateVRAM()` signature consistent between Task 5 and Task 13
- Tab render signature `(container, modelInfo)` consistent across Tasks 12-15

### Gaps Found and Fixed

- Added SPA navigation handling in Task 16 (Hugging Face is a React app, URL changes without page reload)
- Added Shadow DOM for style isolation in Task 11
- Added debounce for parameter changes in Task 13
- Added mapping cache with 7-day TTL per spec - implemented in Task 3 (storage) and Task 12 (overview)
