const PageScraper = {
  extractModelInfo() {
    const platform = window.__HF_ASSISTANT_PLATFORM__ || 'hf';
    if (platform === 'modelscope') {
      return this.extractModelInfoFromModelScope();
    }
    return this.extractModelInfoFromHF();
  },

  extractModelInfoFromHF() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;

    const author = pathParts[0];
    const repoName = pathParts[1];
    const modelId = `${author}/${repoName}`;

    const titleEl = document.querySelector('h1');
    const rawTitle = titleEl ? titleEl.textContent.trim() : repoName;

    // Extract likes/followers from title (HF embeds them in h1)
    let title = rawTitle;
    let likes = null;
    let followers = null;

    const likeMatch = rawTitle.match(/LIKE\s+([\d,.]+[KMB]?)/i);
    if (likeMatch) {
      likes = likeMatch[1];
      title = title.replace(likeMatch[0], '').trim();
    }

    const followMatch = rawTitle.match(/FOLLOW\s+(\S+)\s+([\d,.]+[KMB]?)/i);
    if (followMatch) {
      followers = followMatch[2];
      title = title.replace(followMatch[0], '').trim();
    }

    title = title.replace(/\s+/g, ' ').trim();

    const tags = [];
    document.querySelectorAll('[role="listitem"] a, .tag').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 50 && !text.includes('/')) {
        tags.push(text);
      }
    });

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

    let description = null;
    const descMeta = document.querySelector('meta[property="og:description"]');
    if (descMeta) {
      description = descMeta.getAttribute('content');
    }

    let createdAt = null;
    let updatedAt = null;
    document.querySelectorAll('div, span, time').forEach(el => {
      const text = el.textContent.trim();
      if (!createdAt && text.match(/^Created\s+/i)) {
        const m = text.match(/Created\s+(.+)/i);
        if (m) createdAt = m[1].trim();
      }
      if (!updatedAt && text.match(/^Updated\s+/i)) {
        const m = text.match(/Updated\s+(.+)/i);
        if (m) updatedAt = m[1].trim();
      }
    });

    return {
      modelId,
      author,
      repoName,
      title,
      likes,
      followers,
      tags: [...new Set(tags)],
      license,
      downloads,
      parameterCount,
      description,
      createdAt,
      updatedAt,
      url: window.location.href
    };
  },

  extractModelInfoFromModelScope() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;

    // ModelScope URL: /models/{namespace}/{model_name}
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
      if (tag.match(/\d+\.?\d*[Bb]/)) {
        parameterCount = tag;
        break;
      }
    }
    if (!parameterCount) {
      const titleMatch = title.match(/(\d+\.?\d*)[Bb]/);
      if (titleMatch) parameterCount = titleMatch[0];
    }

    let description = null;
    const descMeta = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (descMeta) {
      description = descMeta.getAttribute('content');
    }

    let downloads = null;
    document.querySelectorAll('div, span').forEach(el => {
      const text = el.textContent.trim();
      const match = text.match(/下载量[：:]?\s*([\d,\.]+)\s*(万|千|亿)?/);
      if (match) {
        let num = parseFloat(match[1].replace(/,/g, ''));
        if (match[2] === '万') num *= 10000;
        if (match[2] === '千') num *= 1000;
        if (match[2] === '亿') num *= 100000000;
        downloads = num;
      }
    });

    return {
      modelId,
      author,
      repoName,
      title,
      likes: null,
      followers: null,
      tags: [...new Set(tags)],
      license: null,
      downloads,
      parameterCount,
      description,
      createdAt: null,
      updatedAt: null,
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
