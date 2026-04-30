const FavoritesTab = {
  rendered: false,

  async render(container) {
    const favorites = (await Storage.getFavorites()).filter(f => f.commands && f.commands.length > 0);
    const commandCount = favorites.reduce((sum, f) => sum + f.commands.length, 0);

    let html = `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">⭐ ${t('commandFavorites')} (${commandCount})</div>
    `;

    if (favorites.length === 0) {
      html += `
        <div style="color: #6b7280; font-size: 12px; text-align: center; padding: 16px 0;">
          ${t('noFavoriteCommands')}
        </div>
      `;
    } else {
      for (const favorite of favorites) {
        html += this.renderFavoriteEntry(favorite);
      }
    }

    html += '</div>';

    container.innerHTML = html;
    this.rendered = true;
    this.bindEvents(container);
  },

  renderFavoriteEntry(favorite) {
    const modelscopeLink = favorite.modelscopeUrl
      ? `<a href="${favorite.modelscopeUrl}" target="_blank" class="hf-assistant-link" style="font-size: 11px;">魔搭</a>`
      : '';
    const currentModelId = Sidebar.modelInfo && Sidebar.modelInfo.modelId;
    const canReuse = currentModelId === favorite.modelId;

    return `
      <div style="padding: 10px; background: #ffffff; border-radius: 6px;
                  margin-bottom: 8px; border: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
          <div style="flex: 1; min-width: 0;">
            <a href="https://huggingface.co/${favorite.modelId}" target="_blank"
               class="hf-assistant-link"
               style="font-size: 12px; font-weight: 500; word-break: break-all;">
              ${this.escapeHtml(favorite.modelId)}
            </a>
            <div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
              ${modelscopeLink}
            </div>
          </div>
          <div style="font-size: 10px; color: #9ca3af; white-space: nowrap;">
            ${favorite.commands.length} 条命令
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${favorite.commands.map((command, index) => this.renderCommandItem(favorite.modelId, command, index, canReuse)).join('')}
        </div>
      </div>
    `;
  },

  renderCommandItem(modelId, command, index, canReuse) {
    return `
      <div class="hf-assistant-command" style="padding-top: 32px;">
        <button class="hf-assistant-command-copy copy-cmd-btn"
                data-model="${this.escapeAttr(modelId)}"
                data-command-index="${index}">
          ${t('copyCommand')}
        </button>
        <button class="hf-assistant-command-copy reuse-cmd-btn"
                data-model="${this.escapeAttr(modelId)}"
                data-command-index="${index}"
                ${canReuse ? '' : 'disabled'}
                title="${canReuse ? '' : '请先打开对应模型页'}"
                style="right: 84px; background: ${canReuse ? '#374151' : '#6b7280'}; ${canReuse ? '' : 'cursor:not-allowed;'}">
          ${t('reuse')}
        </button>
        <button class="hf-assistant-command-copy remove-cmd-btn"
                data-model="${this.escapeAttr(modelId)}"
                data-command-index="${index}"
                style="right: 152px; background: #7f1d1d;">
          删除
        </button>
        <div style="font-size: 10px; color: #9ca3af; margin-bottom: 6px;">${this.escapeHtml(getToolLabel(command.tool))}</div>
        <span title="${this.escapeAttr(command.command)}" style="display: block; white-space: pre-wrap;">${this.escapeHtml(command.command)}</span>
      </div>
    `;
  },

  bindEvents(container) {
    container.querySelectorAll('.copy-cmd-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const favorite = await this.getFavoriteByModel(btn.dataset.model);
        const command = favorite && favorite.commands[parseInt(btn.dataset.commandIndex, 10)];
        if (!command) return;
        await navigator.clipboard.writeText(command.command);
        Sidebar.showToast(t('copied'));
      });
    });

    container.querySelectorAll('.reuse-cmd-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const modelId = btn.dataset.model;
        if (!Sidebar.modelInfo || Sidebar.modelInfo.modelId !== modelId) return;
        const favorite = await this.getFavoriteByModel(modelId);
        const command = favorite && favorite.commands[parseInt(btn.dataset.commandIndex, 10)];
        if (!command || typeof DeployTab === 'undefined') return;
        DeployTab.queueFavoriteCommand(modelId, command);
        Sidebar.switchTab('deploy');
      });
    });

    container.querySelectorAll('.remove-cmd-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const favorite = await this.getFavoriteByModel(btn.dataset.model);
        const command = favorite && favorite.commands[parseInt(btn.dataset.commandIndex, 10)];
        if (!command) return;
        await Storage.removeCommandFavorite(btn.dataset.model, command.tool, command.command);
        Sidebar.showToast(t('commandRemovedFromFavorites'));
        this.rendered = false;
        this.render(container);
      });
    });
  },

  async getFavoriteByModel(modelId) {
    const favorites = await Storage.getFavorites();
    return favorites.find(f => f.modelId === modelId) || null;
  },

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  escapeAttr(value) {
    return this.escapeHtml(value);
  }
};
