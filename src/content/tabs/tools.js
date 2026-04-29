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

    const segments = PageScraper.extractReadmeContent();
    if (!segments || !segments.length) {
      statusEl.textContent = '未找到 README 内容';
      btn.disabled = false;
      return;
    }

    this.originalContent = segments;

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
