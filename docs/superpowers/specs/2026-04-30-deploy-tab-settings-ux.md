# Deploy Tab Settings UX Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to implement this plan task-by-task.

**Goal:** Replace the broken/redundant "⚙️配置" buttons in the Deploy tab with inline expandable config panels, each scoped to its card. Remove deploy-related settings from the global settings panel.

**Architecture:** Two cards in the Deploy tab (VRAM estimate, Command) each get an expandable inline config form. The top settings gear is retained but only for truly global preferences. The existing standalone "参数配置" section is removed and its content merged into the Command card's inline config.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, existing Storage module.

---

## Background

Currently the Deploy tab has two "⚙️配置" buttons (one in the VRAM card, one in the Command card) that both attempt to open `chrome.runtime.openOptionsPage()`. This is broken and redundant — the sidebar header already has a settings gear that opens an inline settings panel.

The user wants each card's config to only manage settings relevant to that card, with no global deploy settings.

## Design

### 1. VRAM Card Inline Config

**Trigger:** Clicking "⚙️配置" in the VRAM card title bar toggles an inline form.

**Fields:**
- 显存 (GB) — number input, min 1, max 9999
- GPU 数量 — number input, min 1, max 16

**Behavior:**
- Changes are saved to `chrome.storage.sync` via `Storage.setMultiple()`
- The VRAM estimate display below updates immediately on change
- The precision used for the estimate is determined by the Command card's current tool configuration (e.g., the `quant` param for Ollama/llama.cpp, or `torchDtype` for Transformers)
- The form is hidden by default, expanded on first click

**Visual:**
```
┌─ 预计显存                ⚙️配置 ─┐
│  显存: [  64] GB               │  ← expanded
│  GPU:  [   1] 张               │
├────────────────────────────────┤
│  14.2 GB                       │
│  ✅ 可运行                     │
└────────────────────────────────┘
```

### 2. Command Card Inline Config

**Trigger:** Clicking "⚙️配置" in the Command card title bar toggles an inline form.

**Fields:**
- 部署工具 — select: Ollama / vLLM / SGLang / llama.cpp / Transformers / TGI
- Tool-specific parameters (dynamically shown based on selected tool):
  - Ollama: quant (select)
  - vLLM: tp (number), quant (select), dtype (select), max_model_len (number)
  - llama.cpp: ngl (number), ctx (number)
  - SGLang: tp (number)
  - Transformers: torch_dtype (select), load_in_8bit (checkbox), load_in_4bit (checkbox)
  - TGI: quant (select), sharded (checkbox), num_shard (number)

**Behavior:**
- Changing the deployment tool regenerates the command with the new tool's default params
- Changing any parameter regenerates the command
- Params are saved to `chrome.storage.sync` via `Storage.setMultiple()`
- The existing standalone "参数配置" section below the command card is removed entirely
- The GGUF card (if applicable) remains below the Command card

**Visual:**
```
┌─ 命令 · Ollama          ⚙️配置 ─┐
│  工具: [Ollama ▼]              │  ← expanded
│  量化: [q4_K_M ▼]              │
├────────────────────────────────┤
│  ollama run meta-llama/...     │
│              [复制] [收藏]     │
└────────────────────────────────┘
```

### 3. Global Settings Panel (Header Gear)

The settings panel opened by the header ⚙️ gear is stripped of all deploy-related settings.

**Remaining fields:**
- 界面语言 — select: 中文 / English
- 自动展开侧边栏 — checkbox
- 翻译服务 — select: none / Google（免费）/ DeepL / OpenAI
- API Key — password input (shown only when DeepL/OpenAI selected)
- 首选镜像站 — select: hf-mirror.com / ModelScope

**Removed fields:**
- 默认部署工具 (moved to Command card)
- 我的显存 (moved to VRAM card)
- GPU 数量 (moved to VRAM card)

### 4. Card Config State Persistence

Each card remembers whether its config form was expanded or collapsed:
- `vramConfigExpanded` — boolean, stored in `chrome.storage.local` (not synced, per-device preference)
- `commandConfigExpanded` — boolean, stored in `chrome.storage.local`

This is a nice-to-have; if complex to implement, default to collapsed on every tab switch.

### 5. Data Flow

```
User clicks ⚙️配置 in VRAM card
    ↓
Inline form toggles visibility
    ↓
User changes 显存 / GPU / 精度
    ↓
Storage.setMultiple({ vramGB, gpuCount, recommendPrecision })
    ↓
DeployTab.updateVramEstimate() called
    ↓
VRAM display updates with new estimate

User clicks ⚙️配置 in Command card
    ↓
Inline form toggles visibility
    ↓
User changes tool / params
    ↓
Storage.setMultiple({ defaultTool, ...params })
    ↓
DeployTab.updateCommand() called
    ↓
Command text updates; GGUF card may show/hide
```

## Files to Modify

- `src/content/tabs/deploy.js` — Major rewrite of render(), add inline config forms, remove standalone params section
- `src/content/sidebar.js` — Strip deploy settings from `renderSettings()`
- `src/shared/storage.js` — Possibly add defaults for new local keys (vramConfigExpanded, commandConfigExpanded)

## Error Handling

- If `chrome.storage.sync` is unavailable (e.g., user not signed into Chrome), fall back to `chrome.storage.local`
- Number inputs should clamp to min/max bounds on change
- Tool switch should preserve compatible params where possible (e.g., quant value if valid for new tool)

## Testing Checklist

- [ ] VRAM card config expands/collapses on ⚙️配置 click
- [ ] Changing VRAM/GPU/精度 updates the estimate immediately
- [ ] Command card config expands/collapses on ⚙️配置 click
- [ ] Changing tool updates the command and shows correct params
- [ ] Changing params updates the command
- [ ] Global settings panel no longer shows deploy-related fields
- [ ] Settings persist across page reloads
- [ ] Navigation between tabs preserves config expansion state (if implemented)
