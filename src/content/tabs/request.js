const RequestTab = {
  rendered: false,
  params: {},

  defaults() {
    return {
      baseUrl: 'http://localhost:8000/v1',
      apiKey: 'sk-xxx',
      model: this.modelId || '',
      systemPrompt: '',
      userMessage: '你好',
      temperature: 1,
      maxTokens: 4096,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      seed: '',
      stopSequence: '',
      stream: 'false',
    };
  },

  async render(container, modelInfo) {
    this.modelId = modelInfo ? modelInfo.modelId : '';
    this.params = { ...this.defaults() };
    if (this.modelId) this.params.model = this.modelId;

    container.innerHTML = this.buildHTML();
    this.rendered = true;
    this.bindEvents(container);
    this.updateCurl(container);
  },

  buildHTML() {
    const p = this.params;
    const esc = s => String(s ?? '').replace(/"/g, '&quot;');

    const numField = (label, key, opts = {}) => `
      <div class="hf-param-row">
        <label class="hf-assistant-label">${label}</label>
        <input type="number" class="hf-assistant-input req-param" data-key="${key}"
          value="${esc(p[key])}" min="${opts.min ?? ''}" max="${opts.max ?? ''}" step="${opts.step ?? 'any'}"
          style="width:90px;flex:none;">
      </div>`;

    const selectField = (label, key, options) => {
      const opts = options.map(o =>
        `<option value="${o}" ${String(p[key]) === String(o) ? 'selected' : ''}>${o}</option>`
      ).join('');
      return `
      <div class="hf-param-row">
        <label class="hf-assistant-label">${label}</label>
        <select class="hf-assistant-select req-param" data-key="${key}" style="width:90px;flex:none;">${opts}</select>
      </div>`;
    };

    const textField = (label, key, placeholder = '') => `
      <div style="margin-bottom:6px;">
        <label class="hf-assistant-label" style="margin-bottom:4px;">${label}</label>
        <input type="text" class="hf-assistant-input req-param" data-key="${key}"
          value="${esc(p[key])}" placeholder="${esc(placeholder)}" style="margin-bottom:0;">
      </div>`;

    const textarea = (label, key, placeholder = '', rows = 2) => `
      <div style="margin-bottom:6px;">
        <label class="hf-assistant-label" style="margin-bottom:4px;">${label}</label>
        <textarea class="hf-assistant-input req-param" data-key="${key}" rows="${rows}"
          placeholder="${esc(placeholder)}"
          style="margin-bottom:0;resize:vertical;font-family:inherit;">${esc(p[key])}</textarea>
      </div>`;

    return `
      <div class="hf-assistant-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <div class="hf-assistant-card-title" style="margin:0;">curl 命令</div>
          <button type="button" class="hf-assistant-inline-action" id="req-copy-btn">复制</button>
        </div>
        <div class="hf-assistant-command" id="req-command-display"><span id="req-command-text" style="white-space:pre;font-size:10px;line-height:1.6;display:block;"></span></div>
      </div>

      <div class="hf-assistant-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">参数配置</div>
          <button type="button" class="hf-assistant-inline-action" id="req-reset-btn">重置</button>
        </div>

        ${textField('Base URL', 'baseUrl', 'http://localhost:8000/v1')}
        ${textField('API Key', 'apiKey', 'sk-xxx')}
        ${textField('模型', 'model', '模型 ID')}
        ${textarea('System Prompt（可选）', 'systemPrompt', '留空则不发送 system 消息')}
        ${textarea('User Message', 'userMessage', '你好')}

        <details id="req-advanced" style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:#6b7280;user-select:none;padding:4px 0;list-style:none;display:flex;align-items:center;gap:4px;">
            <span id="req-adv-arrow" style="display:inline-block;transition:transform 0.15s;">▶</span> 高级参数
          </summary>
          <div style="padding-top:8px;">
            ${numField('temperature', 'temperature', { min: 0, max: 2, step: 0.01 })}
            ${numField('max_tokens', 'maxTokens', { min: 1 })}
            ${numField('top_p', 'topP', { min: 0, max: 1, step: 0.01 })}
            ${numField('frequency_penalty', 'frequencyPenalty', { min: -2, max: 2, step: 0.01 })}
            ${numField('presence_penalty', 'presencePenalty', { min: -2, max: 2, step: 0.01 })}
            ${textField('seed（可选）', 'seed', '整数，留空则随机')}
            ${textField('stop（可选）', 'stopSequence', '停止词，多个用英文逗号分隔')}
            ${selectField('stream', 'stream', ['false', 'true'])}
          </div>
        </details>
      </div>
    `;
  },

  bindEvents(container) {
    container.querySelectorAll('.req-param').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        const key = el.dataset.key;
        if (el.type === 'number') this.params[key] = el.value === '' ? '' : Number(el.value);
        else this.params[key] = el.value;
        this.updateCurl(container);
      });
    });

    container.querySelector('#req-copy-btn').addEventListener('click', () => {
      const cmd = container.querySelector('#req-command-text').textContent;
      navigator.clipboard.writeText(cmd).then(() => Sidebar.showToast(t('copied')));
    });

    container.querySelector('#req-reset-btn').addEventListener('click', () => {
      this.params = { ...this.defaults() };
      if (this.modelId) this.params.model = this.modelId;
      container.innerHTML = this.buildHTML();
      this.bindEvents(container);
      this.updateCurl(container);
    });

    const details = container.querySelector('#req-advanced');
    const arrow = container.querySelector('#req-adv-arrow');
    details.addEventListener('toggle', () => {
      arrow.style.transform = details.open ? 'rotate(90deg)' : '';
    });
  },

  buildBody() {
    const p = this.params;
    const body = { model: p.model || '' };

    const messages = [];
    if (p.systemPrompt && p.systemPrompt.trim()) {
      messages.push({ role: 'system', content: p.systemPrompt.trim() });
    }
    messages.push({ role: 'user', content: p.userMessage || '' });
    body.messages = messages;

    if (p.temperature !== '' && Number(p.temperature) !== 1) body.temperature = Number(p.temperature);
    if (p.maxTokens !== '' && Number(p.maxTokens) !== 4096) body.max_tokens = Number(p.maxTokens);
    if (p.topP !== '' && Number(p.topP) !== 1) body.top_p = Number(p.topP);
    if (p.frequencyPenalty !== '' && Number(p.frequencyPenalty) !== 0) body.frequency_penalty = Number(p.frequencyPenalty);
    if (p.presencePenalty !== '' && Number(p.presencePenalty) !== 0) body.presence_penalty = Number(p.presencePenalty);
    if (p.seed !== '') body.seed = Number(p.seed);
    if (p.stopSequence && p.stopSequence.trim()) {
      const stops = p.stopSequence.split(',').map(s => s.trim()).filter(Boolean);
      if (stops.length) body.stop = stops.length === 1 ? stops[0] : stops;
    }
    if (p.stream === 'true') body.stream = true;

    return body;
  },

  updateCurl(container) {
    const p = this.params;
    const baseUrl = (p.baseUrl || 'http://localhost:8000/v1').replace(/\/$/, '');
    const endpoint = `${baseUrl}/chat/completions`;
    const body = this.buildBody();
    const bodyJson = JSON.stringify(body, null, 2);
    const apiKey = p.apiKey || 'sk-xxx';

    const cmd = [
      `curl ${endpoint} \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "Authorization: Bearer ${apiKey}" \\`,
      `  -d '${bodyJson}'`,
    ].join('\n');

    const el = container.querySelector('#req-command-text');
    if (el) el.textContent = cmd;
  },
};
