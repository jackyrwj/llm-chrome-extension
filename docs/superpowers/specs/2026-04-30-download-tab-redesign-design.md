# Download Tab Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to implement this plan task-by-task.

**Goal:** Redesign the Download tab to solve real model download problems: command selection confusion, copy button layout bugs, unconditional ModelScope display, and lack of practical download assistance.

**Architecture:** The tab becomes a "smart recommendation + customizable command generator" with a prominent recommended command card at top, tool/mirror selection, collapsible advanced options, and a real-time generated command block.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, existing Storage module.

---

## Background

The current Download tab has these problems:

1. **Copy button overlaps command text** — The button is absolutely positioned inside the code block, covering text on long commands.
2. **ModelScope download always shown** — The "魔搭下载" card appears unconditionally, even when the user hasn't selected ModelScope mirror.
3. **No guidance on tool selection** — Users see multiple commands (huggingface-cli, git-lfs, env var) without knowing which to use or why.
4. **Doesn't address real download pain points** — No file filtering, no platform-aware commands (Windows vs Linux), no prerequisite hints, no token handling for gated models.

## Design

### 1. Overall Layout

The Download tab content flows top to bottom in 7 zones:

```
┌─────────────────────────────────┐
│ ① Model Info Bar                │
│    Qwen/Qwen3.6-27B · ~54GB     │
├─────────────────────────────────┤
│ ② ⭐ Recommended Solution       │
│    [command preview] [copy]     │
├─────────────────────────────────┤
│ ③ Download Tool (segmented)     │
│    [hf-cli] [git-lfs] [Python] [Browser]
├─────────────────────────────────┤
│ ④ Network Settings              │
│    Mirror: [hf-mirror.com ▼]    │
├─────────────────────────────────┤
│ ⑤ ▼ Advanced Options (collapsed)│
├─────────────────────────────────┤
│ ⑥ Generated Command Block       │
│    ┌─────────────────────────┐  │
│    │ $ export HF_ENDPOINT=...│  │
│    │ $ huggingface-cli ...   │  │
│    └─────────────────────────┘  │
│              [📋] [🖥️]          │
├─────────────────────────────────┤
│ ⑦ 💡 Tips (dynamic)             │
│    Required: pip install ...    │
└─────────────────────────────────┘
```

### 2. Model Info Bar

Displays the current model name and estimated total size (if available from modelInfo). Compact, single line, muted color.

### 3. Recommended Solution Card

**Position:** Top of the tab, visually prominent.
**Purpose:** Give users a "just copy this" best-practice command without thinking.
**Independence:** The recommended command does NOT update when the user changes options below. It stays as the computed best default. The lower config area generates a separate "custom command".

**Content structure:**
```
┌──────────────────────────────────┐
│ ⭐ 推荐方案                        │
│ ┌──────────────────────────────┐ │
│ │ $ huggingface-cli download \ │ │
│ │   Qwen/Qwen3.6-27B \         │ │
│ │   --local-dir ./Qwen_3.6-27B │ │
│ └──────────────────────────────┘ │
│ [📋 复制完整命令]                  │
│ ──────────────────────────────── │
│ 💡 适用场景: 快速下载，支持断点续传  │
│ ⚠️ 前置条件: pip install huggingface_hub │
└──────────────────────────────────┘
```

**Styling:** Light blue gradient background (`#eff6ff` → `#dbeafe`), blue border, rounded corners.

**Recommendation logic:**

| Condition | Recommended Tool | Reason |
|---|---|---|
| Default (no special conditions) | `huggingface-cli download` | Fastest, supports resume, file filtering |
| Preferred mirror = ModelScope AND model has modelscopeUrl | `git lfs clone` (ModelScope) | Best domestic speed |
| Model size < 5GB | `huggingface-cli download` | Small models don't need complexity |
| Model is gated / requires token | `huggingface-cli download` + token hint | CLI has best token support |

### 4. Download Tool Selection

**UI:** Segmented control (pill buttons) in a single row:
```
[huggingface-cli] [git-lfs] [Python] [浏览器]
```

**Default:** `huggingface-cli` (matches recommendation in most cases).

**Hover tooltips:** Each option shows a brief description on hover:
- `huggingface-cli`: "推荐。支持断点续传和文件过滤"
- `git-lfs`: "完整克隆，含 git 历史"
- `Python`: "代码集成，使用 snapshot_download"
- `浏览器`: "直接浏览模型文件页面"

### 5. Network Settings

**Mirror select:** Dropdown with 3 options:
- `hf-mirror.com` (default, per user settings)
- `官方 huggingface.co`
- `ModelScope（国内）`

**Behavior:**
- Selecting `hf-mirror.com` sets `HF_ENDPOINT=https://hf-mirror.com` in generated commands.
- Selecting `官方` omits `HF_ENDPOINT` from commands.
- Selecting `ModelScope`:
  - For `huggingface-cli` / `Python` tools: sets `HF_ENDPOINT=https://www.modelscope.cn` (ModelScope provides HF-compatible Hub API). A note indicates this is a compatibility mode.
  - For `git-lfs` tool: uses ModelScope's git URL format (`https://www.modelscope.cn/models/<id>.git`).
  - For `浏览器` tool: opens the ModelScope model page.
  - If the model has no `modelscopeUrl`, shows a warning and falls back to `hf-mirror`.

### 6. Advanced Options (Collapsible)

**Default:** Collapsed. Click "▼ 高级选项" to expand.

**Content when expanded:**

**File Filtering:**
```
文件过滤:
☑ .safetensors  ☑ .bin (pytorch)
☑ config.json    ☑ tokenizer
☑ .gguf          ☐ 其他文件
```
- Grid layout, 2 columns.
- All checked by default.
- When unchecked, huggingface-cli commands get `--include` / `--exclude` params.
- When `git-lfs` is selected, file filters are **disabled** with a note: "git-lfs 不支持文件过滤，将下载全部文件".

**Local Directory:**
```
本地目录: [./Qwen_Qwen3.6-27B]
```
- Default value derived from modelId: `./` + modelId.replace('/', '_').
- User can edit.

**Authentication (for gated models):**
```
认证 (该模型需要 Token):
[输入 Hugging Face Token    ]
[如何使用 Token?]
```
- Only shown if `modelInfo.isGated === true`.
- Token is kept in memory only (not persisted to storage).
- When provided, commands include `--token` param.

### 7. Generated Command Block

**Position:** Below the config areas.
**Purpose:** Real-time preview of the command based on all user selections.
**Independence:** This is separate from the Recommended Solution card above.

**Layout fix for copy button:**
```
┌──────────────────────────────────┐
│ 1  export HF_ENDPOINT=https://hf-│
│ 2  mirror.com                    │
│ 3  huggingface-cli download \    │
│ 4    Qwen/Qwen3.6-27B \          │
│ 5    --local-dir ./Qwen_3.6-27B  │
│                                  │
│                    [📋] [🖥️]      │
└──────────────────────────────────┘
```

**Implementation:**
- Code block has `padding-bottom: 40px` to reserve space for buttons.
- Action buttons are positioned at `bottom: 8px; right: 8px` inside the block, but in the reserved padding area.
- Text uses `white-space: pre-wrap; word-break: break-all;` for proper wrapping.
- Buttons: 📋 Copy, 🖥️ Open in terminal (generates a one-liner version).

### 8. Dynamic Tips

A small text area below the command block that shows context-aware hints:

| Trigger | Tip Message |
|---|---|
| Tool = `huggingface-cli` | "💡 需要: `pip install huggingface_hub`" |
| Tool = `git-lfs` | "💡 需要: `git lfs install`，且会下载完整 git 历史" |
| Tool = `Python` | "💡 需要: `pip install huggingface_hub`" |
| Mirror = `hf-mirror` | "🌐 镜像站由社区维护，如遇问题可切换官方" |
| Mirror = `ModelScope` | "🌐 ModelScope 是国内平台，部分模型名称可能与 HF 不同" |
| Model is gated, no token | "⚠️ 该模型需要 Hugging Face token，请先登录" |
| File filters active | "📁 使用 `--include` 参数，只下载选中的文件类型" |
| Platform = Windows | "🖥️ Windows 用户请在 PowerShell 中运行" |

### 9. Command Templates by Tool

| Tool | Generated Command |
|---|---|
| `huggingface-cli` | `HF_ENDPOINT=<mirror> huggingface-cli download <modelId> --local-dir <dir> [--include <patterns>] [--token <token>]` |
| `git-lfs` | `GIT_LFS_SKIP_SMUDGE=1 git clone <mirror>/<modelId>.git` |
| `Python` | `from huggingface_hub import snapshot_download
snapshot_download(repo_id="<modelId>", local_dir="<dir>")` |
| `Browser` | Opens `<mirror>/<modelId>/tree/main` in new tab |
| `ModelScope` (conditional) | `git lfs clone https://www.modelscope.cn/<msId>.git` |

**Platform awareness:**
- Linux/Mac: `export HF_ENDPOINT=...`
- Windows PowerShell: `$env:HF_ENDPOINT="..."`
- Windows CMD: `set HF_ENDPOINT=...`
- Detection via `navigator.platform`.

## State Management

```javascript
DownloadTab.state = {
  modelInfo: null,
  settings: null,

  // User selections
  selectedTool: 'hf_cli',      // 'hf_cli' | 'git_lfs' | 'python' | 'browser'
  selectedMirror: 'hf-mirror', // 'hf-mirror' | 'official' | 'modelscope'
  advancedOpen: false,
  fileFilters: {
    safetensors: true,
    pytorch: true,
    gguf: true,
    config: true,
    tokenizer: true,
    other: true
  },
  localDir: '',
  hfToken: '',

  // Derived
  recommendedTool: 'hf_cli',
  generatedCommand: '',
  tipMessage: ''
}
```

## Data Flow

```
User changes any option
    ↓
Update state
    ↓
Regenerate custom command
    ↓
Update tips based on new state
    ↓
Re-render command block and tips

Note: Recommended solution card is computed once on render
and does NOT react to option changes.
```

## Files to Modify

- `src/content/tabs/download.js` — Complete rewrite
- `src/content/sidebar.css` — Add new download tab styles, fix command block padding

## Data Dependencies

The Download tab relies on these `modelInfo` fields:

| Field | Source | Fallback if missing |
|---|---|---|
| `modelId` | page-scraper | Required, tab shows placeholder if null |
| `size` (total) | Computed from `extractFileList()` | "大小未知" |
| `isGated` | page-scraper (needs addition) | Assume false, hide token input |
| `modelscopeUrl` | page-scraper (needs addition) | Hide ModelScope option |

**Note:** `isGated` and `modelscopeUrl` may need to be added to `page-scraper.js`. If not available, the UI degrades gracefully.

## Error Handling

| Scenario | Handling |
|---|---|
| Model has no `modelscopeUrl` but ModelScope mirror selected | Show warning: "该模型在 ModelScope 暂无镜像", fallback command to hf-mirror |
| `git-lfs` selected + file filters checked | Disable file filter UI, show note: "git-lfs 不支持文件过滤" |
| Gated model + no token entered | Command still generates, but tip shows ⚠️ warning |
| Windows platform detected | Environment variables use PowerShell syntax in generated commands |

## Testing Checklist

- [ ] Copy button does not overlap command text
- [ ] ModelScope section only appears when ModelScope mirror is selected
- [ ] Recommended solution card shows on tab open
- [ ] Recommended card does NOT update when changing options below
- [ ] Custom command updates in real-time when any option changes
- [ ] File filters add `--include`/`--exclude` to huggingface-cli commands
- [ ] File filters are disabled when git-lfs is selected
- [ ] Gated model shows token input field
- [ ] Platform detection works (Windows shows `$env:` syntax)
- [ ] All 4 tools generate correct commands
- [ ] Tips update dynamically based on selections
- [ ] Settings persist (mirror preference syncs with global settings)
