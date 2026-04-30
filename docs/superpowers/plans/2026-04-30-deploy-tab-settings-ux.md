# Deploy Tab Settings UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken card-level "⚙️配置" buttons with working inline expandable config panels scoped to each card, and strip deploy-related settings from the global settings panel.

**Architecture:** VRAM card gets a collapsible GPU-settings form. Command card gets a collapsible tool+params form that replaces the standalone "参数配置" section. Global settings panel keeps only non-deploy preferences.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, existing Storage module.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/content/sidebar.js` | Global settings panel (`renderSettings`) — strip deploy fields |
| `src/content/tabs/deploy.js` | Deploy tab rendering, inline configs, command generation, VRAM estimation |

---

### Task 1: Strip deploy settings from global settings panel

**Files:**
- Modify: `src/content/sidebar.js`

**Context:** `renderSettings()` currently renders 7 rows under "通用" plus translation settings. We remove the 3 deploy-related rows from "通用" and keep the rest.

- [ ] **Step 1: Remove deploy rows from `renderSettings()`**

In `src/content/sidebar.js`, find the first `hf-settings-section` in `renderSettings()` and remove these 3 `${row(...)}` lines:

```javascript
${row('默认部署工具', sel('s-default-tool', [
  ['ollama','Ollama'],['vllm','vLLM'],['sglang','SGLang'],
  ['llamacpp','llama.cpp'],['transformers','Transformers'],['tgi','TGI']
], settings.defaultTool))}
${row('我的显存', `<div style="display:flex;align-items:center;gap:4px;">
  <input type="number" id="s-vram-gb" class="hf-settings-ctrl hf-assistant-input"
    style="width:72px;margin:0;text-align:right;" value="${settings.vramGB}" min="1" max="9999">
  <span style="font-size:12px;color:#6b7280;">GB</span>
</div>`)}
${row('GPU 数量', `<div style="display:flex;align-items:center;gap:4px;">
  <input type="number" id="s-gpu-count" class="hf-settings-ctrl hf-assistant-input"
    style="width:72px;margin:0;text-align:right;" value="${settings.gpuCount}" min="1" max="16">
  <span style="font-size:12px;color:#6b7280;">张</span>
</div>`)}
```

The remaining rows in the first section should be:
- 推荐精度
- 首选镜像站
- 界面语言
- 自动展开侧边栏

- [ ] **Step 2: Remove orphaned event listeners in `renderSettings()`**

Delete these 3 listener lines from the bottom of `renderSettings()`:

```javascript
panel.querySelector('#s-default-tool').addEventListener('change', e => save('defaultTool', e.target.value));
panel.querySelector('#s-vram-gb').addEventListener('change', e => save('vramGB', Math.max(1, parseInt(e.target.value) || 64)));
panel.querySelector('#s-gpu-count').addEventListener('change', e => save('gpuCount', Math.max(1, parseInt(e.target.value) || 1)));
```

- [ ] **Step 3: Verify the settings panel renders without deploy rows**

Load the extension, open the sidebar on any HF/ModelScope page, click the header ⚙️, and confirm the settings panel shows only:
- 推荐精度
- 首选镜像站
- 界面语言
- 自动展开侧边栏
- 翻译服务 + API Key

No "默认部署工具", "我的显存", or "GPU 数量" should appear.

- [ ] **Step 4: Commit**

```bash
git add src/content/sidebar.js
git commit -m "refactor: remove deploy settings from global settings panel"
```

---

### Task 2: Add VRAM card inline config

**Files:**
- Modify: `src/content/tabs/deploy.js`

**Context:** The VRAM card currently shows a title + "⚙️配置" button + VRAM estimate display. The button does nothing useful. We make it toggle an inline form with GPU settings.

- [ ] **Step 1: Replace VRAM card HTML in `render()`**

In `src/content/tabs/deploy.js`, in the `render()` method, replace the `vram-card` div. Find this block:

```html
      <div class="hf-assistant-card" id="vram-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">${t('vramEstimate')}</div>
          <button type="button" class="hf-assistant-inline-action open-options-btn">⚙️配置</button>
        </div>
        <div id="vram-display"><div style="color:#9ca3af;font-size:11px;">加载模型信息中…</div></div>
      </div>
```

Replace with:

```html
      <div class="hf-assistant-card" id="vram-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">${t('vramEstimate')}</div>
          <button type="button" class="hf-assistant-inline-action" id="vram-config-toggle">⚙️配置</button>
        </div>
        <div id="vram-config-form" style="display:none;margin-bottom:10px;">
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <div style="flex:1;">
              <label class="hf-assistant-label" style="margin-bottom:2px;font-size:11px;">显存 (GB)</label>
              <input type="number" id="vram-config-gb" class="hf-assistant-input" style="margin-bottom:0;" min="1" max="9999">
            </div>
            <div style="flex:1;">
              <label class="hf-assistant-label" style="margin-bottom:2px;font-size:11px;">GPU 数量</label>
              <input type="number" id="vram-config-gpu" class="hf-assistant-input" style="margin-bottom:0;" min="1" max="16">
            </div>
          </div>
        </div>
        <div id="vram-display"><div style="color:#9ca3af;font-size:11px;">加载模型信息中…</div></div>
      </div>
```

- [ ] **Step 2: Bind VRAM config toggle and input events in `render()`**

In `render()`, after `this.bindEvents(container);`, add this block:

```javascript
    const vramToggle = container.querySelector('#vram-config-toggle');
    const vramForm = container.querySelector('#vram-config-form');
    vramToggle.addEventListener('click', () => {
      const expanded = vramForm.style.display === 'none';
      vramForm.style.display = expanded ? 'block' : 'none';
      vramToggle.textContent = expanded ? '✕' : '⚙️配置';
    });

    container.querySelector('#vram-config-gb').value = settings.vramGB;
    container.querySelector('#vram-config-gb').addEventListener('change', e => {
      const val = Math.max(1, parseInt(e.target.value) || 64);
      Storage.set('vramGB', val).then(() => this.updateVramEstimate(container));
    });

    container.querySelector('#vram-config-gpu').value = settings.gpuCount;
    container.querySelector('#vram-config-gpu').addEventListener('change', e => {
      const val = Math.max(1, parseInt(e.target.value) || 1);
      Storage.set('gpuCount', val).then(() => this.updateVramEstimate(container));
    });
```

- [ ] **Step 3: Remove old `open-options-btn` handler from `bindEvents()`**

In `bindEvents()`, remove the entire `container.querySelectorAll('.open-options-btn')` block. The remaining handlers should be `#copy-cmd-btn` and `#favorite-cmd-btn`.

- [ ] **Step 4: Test VRAM card config**

1. Open a model detail page (e.g. `huggingface.co/meta-llama/Llama-2-7b-hf`)
2. Switch to Deploy tab
3. Click "⚙️配置" in the VRAM card — form should expand showing current vramGB/gpuCount values
4. Change 显存 to a new value (e.g. 32) and blur the input
5. VRAM estimate should update immediately
6. Click "✕" — form should collapse
7. Reload the page, verify the new values persisted

- [ ] **Step 5: Commit**

```bash
git add src/content/tabs/deploy.js
git commit -m "feat: add inline GPU config to VRAM card"
```

---

### Task 3: Restructure Command card with inline tool+params config

**Files:**
- Modify: `src/content/tabs/deploy.js`

**Context:** The Command card currently has a config button, command display, and a separate "参数配置" section below. We move the tool selector and all params into a collapsible inline form inside the Command card, and remove the standalone "参数配置" title/section.

- [ ] **Step 1: Replace Command card HTML in `render()`**

In `render()`, find the Command card div (the one with `id="command-display"`). Replace it and everything up to (but not including) the `#gguf-card`. The current structure is:

```html
      <div class="hf-assistant-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">命令 · ${getToolLabel(this.currentTool)}</div>
          <button type="button" class="hf-assistant-inline-action open-options-btn">⚙️配置</button>
        </div>
        <div class="hf-assistant-command" id="command-display">
          ...
        </div>
        <div style="margin-top:8px;color:#6b7280;font-size:11px;line-height:1.5;">
          收藏后会出现在"收藏"Tab 对应模型下面，可继续复用。
        </div>
        <div class="hf-assistant-card-title" style="margin-bottom:10px;">参数配置</div>
        <div id="deploy-params"></div>
      </div>
```

Replace with:

```html
      <div class="hf-assistant-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div class="hf-assistant-card-title" style="margin:0;">命令 · ${getToolLabel(this.currentTool)}</div>
          <button type="button" class="hf-assistant-inline-action" id="cmd-config-toggle">⚙️配置</button>
        </div>
        <div id="cmd-config-form" style="display:none;margin-bottom:10px;">
          <div style="margin-bottom:10px;">
            <label class="hf-assistant-label" style="margin-bottom:2px;font-size:11px;">部署工具</label>
            <select class="hf-assistant-select" id="cmd-config-tool" style="margin-bottom:0;">
              ${getSupportedTools().map(t => `<option value="${t}" ${t === this.currentTool ? 'selected' : ''}>${getToolLabel(t)}</option>`).join('')}
            </select>
          </div>
          <div id="cmd-config-params"></div>
        </div>
        <div class="hf-assistant-command" id="command-display">
          <button class="hf-assistant-command-copy" id="copy-cmd-btn">${t('copyCommand')}</button>
          <button class="hf-assistant-command-copy" id="favorite-cmd-btn" style="right:84px;">${t('favoriteCommand')}</button>
          <span id="command-text">加载中…</span>
        </div>
        <div style="margin-top:8px;color:#6b7280;font-size:11px;line-height:1.5;">
          收藏后会出现在"收藏"Tab 对应模型下面，可继续复用。
        </div>
      </div>
```

- [ ] **Step 2: Change `renderParams()` to target `#cmd-config-params`**

In `renderParams()`, change this line:

```javascript
const paramsContainer = container.querySelector('#deploy-params');
```

To:

```javascript
const paramsContainer = container.querySelector('#cmd-config-params');
```

- [ ] **Step 3: Add Command card config toggle and tool switcher in `render()`**

In `render()`, after the VRAM config binding block added in Task 2, add:

```javascript
    const cmdToggle = container.querySelector('#cmd-config-toggle');
    const cmdForm = container.querySelector('#cmd-config-form');
    cmdToggle.addEventListener('click', () => {
      const expanded = cmdForm.style.display === 'none';
      cmdForm.style.display = expanded ? 'block' : 'none';
      cmdToggle.textContent = expanded ? '✕' : '⚙️配置';
    });

    container.querySelector('#cmd-config-tool').addEventListener('change', e => {
      this.currentTool = e.target.value;
      this.currentParams = {};
      Storage.set('defaultTool', this.currentTool);
      container.querySelector('.hf-assistant-card-title').textContent = `命令 · ${getToolLabel(this.currentTool)}`;
      this.renderParams(container);
      this.updateCommand(container);
      const ggufCard = container.querySelector('#gguf-card');
      if (ggufCard) {
        if (this.currentTool === 'ollama' || this.currentTool === 'llamacpp') {
          ggufCard.style.display = 'block';
          this.renderGGUFRecommendation(container);
        } else {
          ggufCard.style.display = 'none';
        }
      }
    });
```

- [ ] **Step 4: Remove the old `renderParams()` call from `render()`**

In `render()`, the line `this.renderParams(container);` should already exist. Keep it — it now renders into the collapsible form. But remove `this.updateCommand(container);` if it was after `renderParams()` and before the new bindings, because `updateCommand()` is called inside the tool change handler, and the initial render already sets command text in `render()`. Actually, looking at the current code:

```javascript
    this.bindEvents(container);
    this.renderParams(container);
    this.updateCommand(container);
```

Keep these 3 lines exactly as they are. The `renderParams()` call renders params into the hidden form. The `updateCommand()` call generates the initial command text. The tool change handler calls both again when switching tools.

- [ ] **Step 5: Verify the Deploy tab layout**

1. Open a model detail page, switch to Deploy tab
2. Confirm the tab now shows:
   - VRAM card (with ⚙️配置)
   - Command card (with ⚙️配置, command display, no standalone "参数配置" section)
   - GGUF card (if tool is Ollama or llama.cpp)
3. Click "⚙️配置" in Command card — form expands showing tool selector + params
4. Change tool from dropdown — card title updates, params refresh, command updates, GGUF card shows/hides
5. Click "✕" — form collapses
6. Reload page — tool selection persisted

- [ ] **Step 6: Commit**

```bash
git add src/content/tabs/deploy.js
git commit -m "feat: move tool and params config into Command card inline panel"
```

---

## Self-Review

**1. Spec coverage:**
- VRAM card inline config with GPU settings → Task 2
- Command card inline config with tool+params → Task 3
- Global settings stripped of deploy fields → Task 1
- Standalone "参数配置" section removed → Task 3 (HTML restructuring)
- All spec requirements have a corresponding task.

**2. Placeholder scan:**
- No TBD, TODO, or vague steps. Every step contains exact code or exact verification steps.

**3. Type consistency:**
- `Storage.set()` and `Storage.setMultiple()` are used consistently with the existing Storage API.
- DOM IDs (`vram-config-toggle`, `cmd-config-toggle`, `cmd-config-tool`, `cmd-config-params`) are unique and consistent.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-deploy-tab-settings-ux.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
