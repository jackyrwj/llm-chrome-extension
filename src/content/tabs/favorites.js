const FavoritesTab = {
  rendered: false,

  async render(container) {
    const allFavorites = await Storage.getFavorites();
    const modelFavorites = allFavorites.filter(f => f.isModelFavorite);
    const commandFavorites = allFavorites.filter(f => f.commands && f.commands.length > 0);
    const commandCount = commandFavorites.reduce((sum, f) => sum + f.commands.length, 0);

    let html = '';

    // Model favorites section
    html += `
      <div class="hf-assistant-card" style="margin-bottom:12px;">
        <div class="hf-assistant-card-title">⭐ 模型收藏 (${modelFavorites.length})</div>
    `;
    if (modelFavorites.length === 0) {
      html += `
        <div style="color:#6b7280;font-size:12px;text-align:center;padding:12px 0;">
          暂无收藏的模型
        </div>
      `;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
      for (const favorite of modelFavorites) {
        html += this.renderModelFavoriteEntry(favorite);
      }
      html += `</div>`;
    }
    html += `</div>`;

    // Command favorites section
    html += `
      <div class="hf-assistant-card">
        <div class="hf-assistant-card-title">⭐ 命令收藏 (${commandCount})</div>
    `;
    if (commandFavorites.length === 0) {
      html += `
        <div style="color:#6b7280;font-size:12px;text-align:center;padding:12px 0;">
          ${t('noFavoriteCommands')}
        </div>
      `;
    } else {
      for (const favorite of commandFavorites) {
        html += this.renderFavoriteEntry(favorite);
      }
    }
    html += `</div>`;

    container.innerHTML = html;
    this.rendered = true;
    this.bindEvents(container);
  },

  renderModelFavoriteEntry(favorite) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;">
        <a href="https://huggingface.co/${favorite.modelId}" target="_blank"
           class="hf-assistant-link"
           style="font-size:12px;font-weight:500;word-break:break-all;flex:1;">
          ${this.escapeHtml(favorite.modelId)}
        </a>
        <button type="button" class="hf-assistant-inline-action unfav-model-btn"
                data-model="${this.escapeAttr(favorite.modelId)}"
                style="flex-shrink:0;margin-left:8px;"
                >取消收藏</button>
      </div>
    `;
  },

  renderFavoriteEntry(favorite) {
    return `
      <div style="padding:10px;background:#ffffff;border-radius:6px;margin-bottom:8px;border:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
          <div style="flex:1;min-width:0;">
            <a href="https://huggingface.co/${favorite.modelId}" target="_blank"
               class="hf-assistant-link"
               style="font-size:12px;font-weight:500;word-break:break-all;">
              ${this.escapeHtml(favorite.modelId)}
            </a>
          </div>
          <div style="font-size:10px;color:#9ca3af;white-space:nowrap;">
            ${favorite.commands.length} 条命令
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${favorite.commands.map((command, index) => this.renderCommandItem(favorite.modelId, command, index)).join('')}
        </div>
      </div>
    `;
  },

  renderCommandItem(modelId, command, index) {
    const trimmedCmd = (command.command || '').trim();
    return `
      <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:11px;font-weight:500;color:#374151;">${this.escapeHtml(getToolLabel(command.tool))}</span>
          <div style="display:flex;gap:10px;align-items:center;">
            <button type="button" class="hf-assistant-inline-action reuse-cmd-btn"
                    data-model="${this.escapeAttr(modelId)}"
                    data-command-index="${index}"
                    >修改配置</button>
            <button type="button" class="hf-assistant-inline-action copy-cmd-btn"
                    data-model="${this.escapeAttr(modelId)}"
                    data-command-index="${index}"
                    >${t('copyCommand')}</button>
            <button type="button" class="hf-assistant-inline-action remove-cmd-btn"
                    data-model="${this.escapeAttr(modelId)}"
                    data-command-index="${index}"
                    style="color:#dc2626;"
                    >删除</button>
          </div>
        </div>
        <div class="hf-assistant-command" style="border-radius:0;padding:2px 8px;margin:0;border:none;line-height:1.5;">
          <span title="${this.escapeAttr(trimmedCmd)}" style="display:block;white-space:pre-wrap;">${this.escapeHtml(trimmedCmd)}</span>
        </div>
      </div>
    `;
  },

  bindEvents(container) {
    container.querySelectorAll('.unfav-model-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await Storage.removeModelFavorite(btn.dataset.model);
        Sidebar.showToast('已取消收藏');
        this.rendered = false;
        this.render(container);
      });
    });

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
        if (!Sidebar.modelInfo || Sidebar.modelInfo.modelId !== modelId) {
          window.open(`https://huggingface.co/${modelId}`, '_blank');
          return;
        }
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
