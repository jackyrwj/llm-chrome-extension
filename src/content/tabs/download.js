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
