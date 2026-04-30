const PageScraper = {
  extractModelInfo() {
    const platform = window.__HF_ASSISTANT_PLATFORM__ || 'hf';
    if (platform === 'modelscope') return this.extractModelInfoFromModelScope();
    return this.extractModelInfoFromHF();
  },

  extractModelInfoFromHF() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;

    const author = pathParts[0];
    const repoName = pathParts[1];
    const modelId = `${author}/${repoName}`;

    // ── Title ───────────────────────────────────────────────
    const titleEl = document.querySelector('h1');
    const rawTitle = titleEl ? titleEl.textContent.trim() : repoName;

    let title = rawTitle;
    let likes = null;
    let followers = null;

    const likeMatch = rawTitle.match(/\b(?:Like|Likes|LIKE)\s+([\d,.]+[KMB]?)\b/i);
    if (likeMatch) {
      likes = likeMatch[1];
      title = title.replace(likeMatch[0], '').trim();
    }
    const followMatch = rawTitle.match(/\b(?:Follow|Following|Followers|FOLLOW|FOLLOWING)\s+(?:\S+\s+)?([\d,.]+[KMB]?)\b/i);
    if (followMatch) {
      followers = followMatch[1];
      title = title.replace(followMatch[0], '').trim();
    }
    title = title.replace(/\s+/g, ' ').trim();

    // ── Tags – only keep meaningful categories ───────────────
    // HF tag links have href like /models?pipeline_tag=..., /models?library=..., /models?language=...
    const USEFUL_LIBRARIES = new Set([
      'transformers', 'safetensors', 'pytorch', 'gguf', 'onnx',
      'diffusers', 'peft', 'sentence-transformers', 'llama.cpp',
      'jax', 'keras', 'mlx', 'vllm',
    ]);

    const taskTags = [];
    const libraryTags = [];
    const languageTags = [];

    document.querySelectorAll('a[href*="/models?"]').forEach(el => {
      const href = el.getAttribute('href') || '';
      const text = el.textContent.trim();
      if (!text || text.length > 60) return;

      if (href.includes('pipeline_tag=')) {
        taskTags.push(text);
      } else if (href.includes('library=')) {
        const val = new URLSearchParams(href.split('?')[1]).get('library') || '';
        if (USEFUL_LIBRARIES.has(val.toLowerCase())) libraryTags.push(text);
      } else if (href.includes('language=')) {
        languageTags.push(text);
      }
    });

    const tags = [...new Set([...taskTags, ...libraryTags])];

    // ── Downloads ────────────────────────────────────────────
    let downloads = null;
    document.querySelectorAll('div, span').forEach(el => {
      if (downloads || el.children.length > 2) return;
      const text = el.textContent.trim();
      const m = text.match(/^([\d,\.]+)\s*(k|M|B)?\s*downloads?$/i);
      if (m) {
        let num = parseFloat(m[1].replace(/,/g, ''));
        if (m[2] === 'k' || m[2] === 'K') num *= 1000;
        if (m[2] === 'M') num *= 1e6;
        if (m[2] === 'B') num *= 1e9;
        downloads = num;
      }
    });

    // ── Parameter count ──────────────────────────────────────
    // New HF style: "1.1T params", "70B params"
    let parameterCount = null;
    document.querySelectorAll('div, span, p').forEach(el => {
      if (parameterCount || el.children.length > 0) return;
      const text = el.textContent.trim();
      const m = text.match(/^(\d+\.?\d*\s*[KMBT])\s*params?$/i);
      if (m) parameterCount = m[0];
    });
    // Fallback: tag like "7B", "13B"
    if (!parameterCount) {
      for (const tag of [...taskTags, ...libraryTags]) {
        if (/^\d+\.?\d*[BbMmTtKk]$/.test(tag)) { parameterCount = tag; break; }
      }
    }
    // Fallback: from title
    if (!parameterCount) {
      const m = title.match(/(\d+\.?\d*\s*[BbMmTt])/);
      if (m) parameterCount = m[0];
    }

    // ── Context length ───────────────────────────────────────
    let contextLength = null;
    document.querySelectorAll('div, span, p').forEach(el => {
      if (contextLength || el.children.length > 0) return;
      const text = el.textContent.trim();
      // "128K context", "128,000 tokens", "131072 context window"
      const m = text.match(/(\d[\d,]*\.?\d*\s*[Kk]?)\s*(context(?:\s*window)?|tokens?|ctx)/i);
      if (m) {
        let raw = m[1].replace(/,/g, '').trim();
        const num = parseFloat(raw);
        if (num >= 1024) { // only keep if meaningful (≥1K)
          contextLength = num >= 1000
            ? `${Math.round(num / 1000)}K`
            : raw;
        }
      }
    });
    // Also check title (e.g., "Qwen2.5-72B-128K")
    if (!contextLength) {
      const m = title.match(/(\d+)[Kk](?=[-\s]|$)/);
      if (m && parseInt(m[1]) >= 4) contextLength = m[1] + 'K';
    }

    // ── Tensor / precision types ─────────────────────────────
    let tensorTypes = null;
    const TENSOR_RE = /\b(F32|F16|BF16|FP16|FP32|INT4|INT8|Q4|Q8|NF4|GPTQ|AWQ|I32)\b/g;
    document.querySelectorAll('div, span').forEach(el => {
      if (tensorTypes || el.children.length > 3) return;
      const text = el.textContent.trim();
      if (text.toLowerCase().includes('tensor') || text.toLowerCase().includes('type')) {
        const matches = [...text.matchAll(TENSOR_RE)].map(m => m[1]);
        if (matches.length >= 1) tensorTypes = [...new Set(matches)].join(' / ');
      }
    });

    // ── License ──────────────────────────────────────────────
    let license = null;
    document.querySelectorAll('a[href*="license"]').forEach(el => {
      if (license) return;
      const text = el.textContent.trim();
      if (text && text.length < 60) license = text;
    });

    // ── Dates ─────────────────────────────────────────────────
    let updatedAt = null;
    document.querySelectorAll('div, span, time').forEach(el => {
      if (updatedAt || el.children.length > 1) return;
      const text = el.textContent.trim();
      const m = text.match(/^Updated\s+(.+)/i);
      if (m) updatedAt = m[1].trim();
    });

    // ── Gated model ──────────────────────────────────────────
    const isGated = !!(document.querySelector('[data-target="AccessRepoModal"]') ||
      document.body.textContent.includes('Access repository'));

    return {
      modelId, author, repoName, title,
      likes, followers, downloads,
      tags,
      taskType: taskTags[0] || null,
      languages: languageTags.slice(0, 3),
      license,
      parameterCount,
      contextLength,
      tensorTypes,
      updatedAt,
      isGated,
      url: window.location.href,
      platform: 'hf',
    };
  },

  extractModelInfoFromModelScope() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const nsIndex = pathParts.indexOf('models');
    if (nsIndex === -1 || nsIndex + 2 > pathParts.length) return null;

    const author = pathParts[nsIndex + 1];
    const repoName = pathParts[nsIndex + 2];
    const modelId = `${author}/${repoName}`;

    const titleEl = document.querySelector('h1');
    const title = titleEl ? titleEl.textContent.trim() : repoName;

    const tags = [];
    document.querySelectorAll('.tag, [class*="tag"], [class*="label"]').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 50 && !text.includes('/') && !text.includes('模型')) {
        tags.push(text);
      }
    });

    let parameterCount = null;
    for (const tag of tags) {
      if (/\d+\.?\d*[Bb]/.test(tag)) { parameterCount = tag; break; }
    }
    if (!parameterCount) {
      const m = title.match(/(\d+\.?\d*)[Bb]/);
      if (m) parameterCount = m[0];
    }

    let downloads = null;
    document.querySelectorAll('div, span').forEach(el => {
      const text = el.textContent.trim();
      const m = text.match(/下载量[：:]?\s*([\d,\.]+)\s*(万|千|亿)?/);
      if (m) {
        let num = parseFloat(m[1].replace(/,/g, ''));
        if (m[2] === '万') num *= 10000;
        if (m[2] === '千') num *= 1000;
        if (m[2] === '亿') num *= 1e8;
        downloads = num;
      }
    });

    return {
      modelId, author, repoName, title,
      likes: null, followers: null, downloads,
      tags: [...new Set(tags)],
      taskType: null, languages: [], license: null,
      parameterCount, contextLength: null, tensorTypes: null,
      updatedAt: null, isGated: false,
      url: window.location.href,
      platform: 'modelscope',
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
          if (sizeMatch[2].toLowerCase() === 'gb') size *= 1024 ** 3;
          if (sizeMatch[2].toLowerCase() === 'mb') size *= 1024 ** 2;
          if (sizeMatch[2].toLowerCase() === 'kb') size *= 1024;
        }
        files.push({ name, size, isGguf: name.endsWith('.gguf') });
      }
    });
    return files;
  },
};
