const PageScraper = {
  collectLeafTexts(selector) {
    return Array.from(document.querySelectorAll(selector))
      .filter(el => el.children.length === 0)
      .map(el => el.textContent.trim())
      .filter(Boolean);
  },

  // Collect both direct text nodes and full textContent of every element.
  // Full textContent catches patterns split across nested elements like
  // "<span><span>参数</span><span>861.61B</span></span>" -> "参数861.61B".
  collectDirectTexts() {
    const texts = new Set();
    document.body.querySelectorAll('*').forEach(el => {
      // 1) direct text nodes (catches labels with icons: <span><i></i> label</span>)
      const direct = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .filter(Boolean)
        .join(' ');
      if (direct && direct.length > 0 && direct.length < 120) {
        texts.add(direct);
      }
      // 2) full textContent (catches info split across child elements)
      const full = el.textContent.trim();
      if (full && full.length > 0 && full.length < 120 && full !== direct) {
        texts.add(full);
      }
    });
    return Array.from(texts);
  },

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

    const leafTexts = this.collectLeafTexts('div, span, p, time');

    // ── Downloads / params / context / tensor / date ────────
    let downloads = null;
    let parameterCount = null;
    let contextLength = null;
    let tensorTypes = null;
    let updatedAt = null;
    const TENSOR_RE = /\b(F32|F16|BF16|FP16|FP32|INT4|INT8|Q4|Q8|NF4|GPTQ|AWQ|I32)\b/g;

    for (const text of leafTexts) {
      if (!downloads) {
        const m = text.match(/^([\d,\.]+)\s*(k|M|B)?\s*downloads?$/i);
        if (m) {
          let num = parseFloat(m[1].replace(/,/g, ''));
          if (m[2] === 'k' || m[2] === 'K') num *= 1000;
          if (m[2] === 'M') num *= 1e6;
          if (m[2] === 'B') num *= 1e9;
          downloads = num;
        }
      }

      if (!parameterCount) {
        const m = text.match(/^(\d+\.?\d*\s*[KMBT])\s*params?$/i);
        if (m) parameterCount = m[0];
      }

      if (!contextLength) {
        const m = text.match(/(\d[\d,]*\.?\d*\s*[Kk]?)\s*(context(?:\s*window)?|tokens?|ctx)/i);
        if (m) {
          const raw = m[1].replace(/,/g, '').trim();
          const num = parseFloat(raw);
          if (num >= 1024) {
            contextLength = num >= 1000 ? `${Math.round(num / 1000)}K` : raw;
          }
        }
      }

      if (!tensorTypes) {
        const lower = text.toLowerCase();
        if (lower.includes('tensor') || lower.includes('type')) {
          const matches = [...text.matchAll(TENSOR_RE)].map(match => match[1]);
          if (matches.length >= 1) tensorTypes = [...new Set(matches)].join(' / ');
        }
      }

      if (!updatedAt) {
        const m = text.match(/^Updated\s+(.+)/i);
        if (m) updatedAt = m[1].trim();
      }

      if (downloads && parameterCount && contextLength && tensorTypes && updatedAt) break;
    }

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
    // Also check title (e.g., "Qwen2.5-72B-128K")
    if (!contextLength) {
      const m = title.match(/(\d+)[Kk](?=[-\s]|$)/);
      if (m && parseInt(m[1], 10) >= 4) contextLength = m[1] + 'K';
    }

    // ── License ──────────────────────────────────────────────
    let license = null;
    document.querySelectorAll('a[href*="license"]').forEach(el => {
      if (license) return;
      const text = el.textContent.trim();
      if (text && text.length < 60) license = text;
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

    // Collect every element's direct text (ignores child-element text).
    // This catches labels like "<span><i></i> 文本生成</span>".
    const texts = this.collectDirectTexts();

    // SPA guard: if key model metadata isn't present yet, signal retry.
    const hasModelMeta = texts.some(t => /\d+[\d,.]*\s*[BbMmTtKk]/.test(t)) ||
                         texts.some(t => /下载/.test(t)) ||
                         texts.some(t => /开源协议/.test(t)) ||
                         texts.some(t => /参数量?/.test(t));
    if (!hasModelMeta) return null;

    let downloads = null;
    let likes = null;
    let license = null;
    let updatedAt = null;
    let parameterCount = null;
    let contextLength = null;
    let tensorTypes = null;

    for (const text of texts) {
      // Downloads: e.g. "151,159下载", "28,983下载"
      if (downloads === null) {
        const m = text.match(/([\d,\.]+)\s*(万|千|亿)?\s*下载/);
        if (m) {
          let num = parseFloat(m[1].replace(/,/g, ''));
          if (m[2] === '万') num *= 10000;
          if (m[2] === '千') num *= 1000;
          if (m[2] === '亿') num *= 1e8;
          downloads = num;
        }
      }
      // Likes / followers
      if (likes === null) {
        const m = text.match(/(?:收藏|点赞|喜欢|Followers?)[：:]?\s*([\d,\.]+)\s*(万|千|亿)?/i);
        if (m) {
          let num = parseFloat(m[1].replace(/,/g, ''));
          if (m[2] === '万') num *= 10000;
          if (m[2] === '千') num *= 1000;
          if (m[2] === '亿') num *= 1e8;
          likes = num;
        }
      }
      // License
      if (license === null) {
        const m = text.match(/开源协议[：:]?\s*(.+)/);
        if (m && m[1].trim().length < 40) license = m[1].trim();
      }
      // Updated at
      if (updatedAt === null) {
        const m = text.match(/(?:更新[于时]|更新时间)[：:]?\s*(\d{4}[-/]\d{2}[-/]\d{2})/);
        if (m) updatedAt = m[1];
      }
      // Parameter count: "参数 861.61B", "参数量：7B", "170.74B"
      if (parameterCount === null) {
        const m = text.match(/参数量?[：:]?\s*(\d+\.?\d*\s*[BbMmTtKk])/);
        if (m) { parameterCount = m[1].replace(/\s+/g, ''); }
      }
      if (parameterCount === null) {
        const m = text.match(/^(\d+\.?\d*[Bb])(?![A-Za-z])/);
        if (m) parameterCount = m[1];
      }
      // Context length
      if (contextLength === null) {
        const m = text.match(/上下文[长度]?[：:]?\s*(\d+)\s*(K|M|k)?/i);
        if (m) contextLength = m[1] + (m[2] ? m[2].toUpperCase() : '');
      }
      // Tensor types
      if (tensorTypes === null) {
        const m = text.match(/(?:张量类型|精度|数据类型|dtype)[：:]?\s*(.+)/i);
        if (m && m[1].trim().length < 30) tensorTypes = m[1].trim();
      }
    }

    // Tags: pick short, meaningful texts that look like labels (exclude numbers, dates, URLs)
    const tags = [];
    const seen = new Set();
    for (const text of texts) {
      if (!text || text.length < 2 || text.length > 40) continue;
      if (/^\d+$/.test(text)) continue;
      if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(text)) continue;
      if (text.includes('http')) continue;
      if (text.includes('下载')) continue;
      if (text.includes('更新')) continue;
      if (text.includes('参数')) continue;
      if (seen.has(text)) continue;
      // Heuristic: looks like a framework / format / task label
      if (/^(文本生成|图像生成|语音识别|语音合成|代码生成|分类|检测|分割|翻译|问答|摘要|对话|Embedding|OCR|Safetensors|PyTorch|TensorFlow|ONNX|JAX|GGUF|LLaMA|diffusers|compressed-tensors|deepseek|qwen|kimi|llama|gpt|mit|apache|gpl|bsd|other)$/i.test(text)) {
        seen.add(text);
        tags.push(text);
        continue;
      }
      // Keep short labels that contain letters or Chinese chars
      if (/[一-龥a-zA-Z]/.test(text) && !/^[\d\s.,]+$/.test(text)) {
        seen.add(text);
        tags.push(text);
      }
    }

    // Task type from tags
    const knownTasks = ['视觉多模态理解', '文本生成', '图像生成', '语音识别', '语音合成', '代码生成', 'Embedding', '分类', '检测', '分割', 'OCR', '翻译', '问答', '摘要', '对话'];
    let taskType = null;
    for (const tag of tags) {
      for (const task of knownTasks) {
        if (tag.includes(task)) { taskType = tag; break; }
      }
      if (taskType) break;
    }

    return {
      modelId, author, repoName, title,
      likes, followers: null, downloads,
      tags,
      taskType, languages: [], license,
      parameterCount, contextLength, tensorTypes,
      updatedAt, isGated: false,
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
