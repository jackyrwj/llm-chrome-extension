# Hugging Face 模型助手 - Chrome 插件设计文档

## 1. 项目概述

一个 Chrome 浏览器插件，帮助国内开发者更便捷地使用 Hugging Face 和本地大模型部署工具。当用户访问 Hugging Face 模型页面时，在页面右侧注入一个侧边栏，提供模型映射、部署命令生成、镜像站信息等功能。

### 目标用户
- 国内开发者，访问 Hugging Face 存在网络问题
- 使用本地大模型部署工具（Ollama、vLLM、llama.cpp 等）的开发者
- 需要快速获取模型中文信息和部署指导的用户

## 2. 功能清单

| # | 功能 | 描述 |
|---|------|------|
| 1 | 魔搭社区映射 | HF 模型页面自动查找对应的 ModelScope 链接 |
| 2 | 部署命令生成器 | 支持 Ollama、vLLM、SGLang、llama.cpp、transformers、TGI 等工具 |
| 3 | 显存/硬件需求估算 | 根据模型参数和量化精度计算所需 VRAM |
| 4 | GGUF 量化版本推荐 | 扫描页面 GGUF 文件，根据用户配置推荐最佳版本 |
| 5 | 镜像站信息 | 展示 HF 国内镜像站（hf-mirror.com 等）及魔搭下载链接 |
| 6 | 下载命令生成 | 根据选择镜像站生成 huggingface-cli / git lfs 命令 |
| 7 | 一键复制命令 | 生成的命令支持一键复制到剪贴板 |
| 8 | 命令历史记录 | 保存最近 5 条生成的命令，支持快速复用 |
| 9 | README 一键翻译 | 将模型 README 翻译成中文 |
| 10 | 模型收藏 | 收藏常用模型，在侧边栏快速访问 |
| 11 | 用户偏好设置 | 默认部署工具、首选镜像站、机器显存配置等 |

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension (Manifest V3)            │
├─────────────────┬─────────────────────┬─────────────────────┤
│  content.js     │  options.html       │  background.js      │
│  (Content Script)│  (设置页)            │  (Service Worker)   │
│                 │                     │                     │
│ • 右侧侧边栏注入 │ • 默认部署工具       │ • API 请求代理      │
│ • 页面信息提取  │ • 镜像站偏好        │ • CORS 转发         │
│ • 魔搭映射查询  │ • 机器显存配置      │ • 响应缓存          │
│ • 命令生成展示  │ • 命令模板管理      │                     │
│ • 镜像站展示   │                     │                     │
│ • README 翻译  │                     │                     │
└─────────────────┴─────────────────────┴─────────────────────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
        ModelScope API      本地映射表 (JSON)
        (实时查询)            (fallback)
```

### 3.2 权限声明

```json
{
  "permissions": ["activeTab", "storage", "clipboardWrite"],
  "host_permissions": ["https://huggingface.co/*"],
  "optional_permissions": ["tabs"]
}
```

### 3.3 技术栈

- 纯原生 JavaScript + HTML + CSS（不引入前端框架，保持轻量）
- Chrome Extension Manifest V3
- `chrome.storage.sync` 存储用户偏好和收藏（跨设备同步）
- `chrome.storage.local` 存储命令历史记录（仅本地）
- `fetch` API 调用魔搭搜索（通过 background service worker 代理以规避 CORS）

## 4. 侧边栏 UI 设计

### 4.1 布局规格

- **宽度**：360px（展开状态）/ 40px（折叠为窄条）
- **位置**：页面右侧固定，z-index 高于页面内容但低于浏览器原生 UI
- **动画**：展开/折叠带动画过渡

### 4.2 顶部栏

```
[🤖 模型助手]              [⭐ 收藏] [✕ 折叠]
```

### 4.3 Tab 导航

四个标签页：

```
[概览] [部署] [下载] [工具]
```

### 4.4 Tab: 概览

- **模型信息卡片**
  - 模型全称（从页面解析）
  - 作者 / 组织
  - 标签列表（transformers、pytorch 等）
  - 下载量、点赞数
  - 许可证信息

- **魔搭映射卡片**
  - 状态指示：加载中 / ✅ 找到对应 / ❌ 未找到
  - 找到时：显示 ModelScope 模型名称 + 直达链接
  - 未找到时：显示"未在魔搭找到对应模型" + "前往搜索"按钮

- **收藏按钮**
  - ⭐ 空心：未收藏
  - ⭐ 实心：已收藏，点击可取消

### 4.5 Tab: 部署（核心）

- **部署工具选择器**
  - 下拉菜单：Ollama、vLLM、SGLang、llama.cpp、Transformers、Text Generation Inference

- **动态参数配置**
  - 根据选择的工具显示对应的参数选项
  - Ollama：量化级别、上下文长度
  - vLLM：tensor-parallel-size、gpu-memory-utilization、量化方式
  - llama.cpp：n-gpu-layers、上下文长度、量化类型
  - transformers：device、torch-dtype、load-in-8bit 等

- **显存估算面板**
  - 实时计算并显示："预计需要 XX GB VRAM"
  - 与用户设置的机器显存对比，显示状态：✅ 可运行 / ⚠️ 可能不足 / ❌ 显存不足

- **GGUF 推荐**（仅在 Ollama / llama.cpp 时显示）
  - 扫描页面上的 `.gguf` 文件列表
  - 根据用户显存配置，标记推荐项（如"Q4_K_M - 推荐"）
  - 说明推荐理由："此版本在您的 8GB 显存上可流畅运行"

- **命令生成区**
  - 大型代码框展示完整命令
  - 右上角：[📋 一键复制] 按钮
  - 复制成功后显示 Toast："已复制到剪贴板"

- **历史记录**
  - 列表展示最近 5 条命令
  - 每条显示：工具名称 + 命令前 30 字 + [复用] 按钮
  - 点击复用：自动填充对应参数

### 4.6 Tab: 下载

- **镜像站列表**
  | 站点 | 地址 | 状态 |
  |------|------|------|
  | hf-mirror | hf-mirror.com | ✅ 可用 |
  | ModelScope | modelscope.cn | ✅ 可用 |

- **下载命令生成**
  - 根据选择的镜像站自动生成：
    - `huggingface-cli download {modelId} --local-dir ./models`
    - `git lfs clone https://hf-mirror.com/{modelId}`
  - 附带环境变量提示：`export HF_ENDPOINT=https://hf-mirror.com`

- **魔搭下载命令**
  - `git lfs clone https://www.modelscope.cn/{modelId}.git`
  - 或 ModelScope SDK 命令

### 4.7 Tab: 工具

- **README 翻译**
  - [翻译为中文] 按钮
  - 提取页面 README markdown 内容
  - 调用翻译 API 进行分段翻译
  - 翻译结果在侧边栏内以折叠面板展示（保留原文切换）

## 5. 数据流设计

### 5.1 模型信息提取

Content Script 在页面加载完成后执行：

```javascript
function extractModelInfo() {
  return {
    modelId: document.querySelector('h1')?.textContent?.trim() || 
             window.location.pathname.slice(1),
    author: window.location.pathname.split('/')[1],
    repoName: window.location.pathname.split('/')[2],
    tags: Array.from(document.querySelectorAll('[data-target="Tag"]')).map(t => t.textContent),
    license: document.querySelector('[data-target="License"]')?.textContent,
    downloads: parseDownloads(document.querySelector('[data-target="Downloads"]')?.textContent),
    files: extractFileList(), // 从 Files 标签页解析
  };
}
```

### 5.2 魔搭映射查询流程

```
页面加载完成
    │
    ▼
提取 modelId (如 "meta-llama/Llama-2-7b-hf")
    │
    ▼
并行执行：
    ├──► 调用 ModelScope 搜索 API（通过 background.js 代理）
    │         │
    │         ▼
    │    返回搜索结果列表
    │         │
    │         ▼
    │    计算匹配度（字符串相似度 + 作者匹配）
    │         │
    │    ┌────┴────┐
    │    ▼         ▼
    │  匹配度>0.8  匹配度<=0.8
    │    │         │
    │    ▼         ▼
    │  使用结果   进入 fallback
    │
    └──► 查询本地映射表 data/mapping.json
              │
              ▼
         有精确匹配?
              │
         ┌────┴────┐
         ▼         ▼
        是        否
         │         │
         ▼         ▼
       使用      进入 fallback

fallback: 显示"未找到" + 提供 ModelScope 搜索链接
```

**ModelScope 搜索 API**（通过 background.js 代理）：
```
GET https://www.modelscope.cn/api/v1/dolphin/models?search={modelId}
```

**本地映射表结构** (`src/data/mapping.json`)：
```json
{
  "meta-llama/Llama-2-7b-hf": {
    "modelscope": "LLM-Research/Llama-2-7b-hf",
    "modelscopeUrl": "https://www.modelscope.cn/models/LLM-Research/Llama-2-7b-hf",
    "lastVerified": "2026-04-01",
    "notes": "官方镜像"
  }
}
```

### 5.3 显存估算算法

```
显存(GB) = 参数量(B) × 每参数字节数 × 开销系数(1.2)

精度 → 字节数映射：
  FP32:  4.0 bytes
  FP16:  2.0 bytes
  BF16:  2.0 bytes
  INT8:  1.0 byte
  INT4/Q4: 0.5 bytes
  Q4_K_M: ~0.58 bytes（GGUF 特定，需按实际文件大小修正）

参数量推断：
  - 从模型标签解析（如 "7B"、"13B"）
  - 从模型名称正则匹配（如 "Llama-2-7b" → 7B）
  - 从配置文件读取（config.json 中的 hidden_size × num_layers 等）

KV Cache 估算（对 vLLM / transformers）：
  kv_cache = 2 × num_layers × hidden_size × seq_length × batch_size × precision_bytes

显存状态判断：
  - 绿色 ✅: 估算显存 <= 用户显存 × 0.9
  - 黄色 ⚠️: 估算显存 <= 用户显存 × 1.1
  - 红色 ❌: 估算显存 > 用户显存 × 1.1
```

### 5.4 GGUF 推荐逻辑

```javascript
function recommendGGUF(files, userVramGB) {
  const ggufs = files
    .filter(f => f.name.endsWith('.gguf'))
    .map(f => ({
      name: f.name,
      quant: extractQuantLevel(f.name), // Q4_K_M, Q5_K_M, etc.
      size: f.size, // bytes
      estVram: f.size / 1024 / 1024 / 1024 * 1.15 // GB with overhead
    }));

  // 排序：找 largest quant that fits in userVram
  const recommended = ggufs
    .filter(g => g.estVram <= userVramGB * 0.9)
    .sort((a, b) => b.estVram - a.estVram)[0];

  return {
    recommended,
    all: ggufs.map(g => ({
      ...g,
      status: g === recommended ? 'recommended' :
              g.estVram <= userVramGB ? 'compatible' : 'too-large'
    }))
  };
}
```

### 5.5 命令生成模板

每个部署工具对应一个模板配置：

```javascript
const deployTemplates = {
  ollama: {
    baseCmd: 'ollama run {model}',
    params: {
      quant: { flag: '', type: 'select', options: ['none', 'q4_0', 'q4_K_M', 'q5_K_M', 'q8_0'] },
      ctx: { flag: '--ctx-size', type: 'number', default: 4096 }
    },
    vramEstimate: (params, modelInfo) => { /* ... */ }
  },
  vllm: {
    baseCmd: 'vllm serve {model}',
    params: {
      tp: { flag: '--tensor-parallel-size', type: 'number', default: 1 },
      gpuUtil: { flag: '--gpu-memory-utilization', type: 'range', min: 0.1, max: 0.99, default: 0.9 },
      quant: { flag: '--quantization', type: 'select', options: ['none', 'awq', 'gptq', 'fp8'] },
      maxModelLen: { flag: '--max-model-len', type: 'number', default: 8192 }
    },
    vramEstimate: (params, modelInfo) => { /* ... */ }
  },
  // llama.cpp, transformers, sglang, tgi ...
};
```

命令生成函数：
```javascript
function generateCommand(tool, modelId, params) {
  const template = deployTemplates[tool];
  let cmd = template.baseCmd.replace('{model}', modelId);

  for (const [key, config] of Object.entries(template.params)) {
    const value = params[key];
    if (value && value !== 'none' && value !== config.default) {
      cmd += ` ${config.flag} ${value}`;
    }
  }

  return cmd;
}
```

### 5.6 README 翻译流程

```
用户点击 [翻译为中文]
    │
    ▼
提取页面 README 区域的 markdown HTML
    │
    ▼
分段处理（按段落/代码块分割）
    │
    ▼
调用翻译 API（通过 background.js 代理）
    │
    ▼
逐段翻译，保留代码块不翻译
    │
    ▼
在侧边栏内展示翻译结果
    │
    ▼
提供 [显示原文] / [显示翻译] 切换
```

**翻译 API 选项**（优先级）：
1. 用户自备 API Key（在设置中配置，如 DeepL、OpenAI）
2. 浏览器内置翻译 API（如果可用）
3. 公共翻译 API（如 Google Translate 免费端点，不稳定，作为 fallback）

### 5.7 存储方案

| 数据类型 | 存储方式 | 结构 |
|----------|----------|------|
| 用户偏好 | `chrome.storage.sync` | `{ defaultTool, preferredMirror, vramGB, apiKeys }` |
| 收藏模型 | `chrome.storage.sync` | `[{ modelId, modelscopeUrl, addedAt }]` |
| 命令历史 | `chrome.storage.local` | `[{ tool, command, params, timestamp }]`（最多 20 条） |
| 映射缓存 | `chrome.storage.local` | `{ [modelId]: { modelscopeUrl, cachedAt } }`（TTL 7 天） |

## 6. 设置面板设计 (options.html)

### 6.1 页面结构

```
┌─────────────────────────────────────┐
│  ⚙️ 模型助手设置                      │
├─────────────────────────────────────┤
│  [通用设置] [部署工具] [API 配置]      │
├─────────────────────────────────────┤
│                                     │
│  通用设置 Tab:                       │
│    • 默认部署工具: [下拉选择]          │
│    • 首选镜像站: [下拉选择]            │
│    • 机器显存大小: [___] GB           │
│    • 侧边栏默认状态: [展开/折叠]       │
│                                     │
│  部署工具 Tab:                       │
│    • 各工具的默认参数配置              │
│                                     │
│  API 配置 Tab:                       │
│    • 翻译 API: [DeepL/Google/自定义]   │
│    • API Key: [________]             │
│    • 魔搭 API 配置（高级）             │
│                                     │
└─────────────────────────────────────┘
```

### 6.2 设置项详情

**通用设置：**
- `defaultTool`: 默认选中的部署工具（默认 Ollama）
- `preferredMirror`: 首选镜像站（hf-mirror / modelscope）
- `vramGB`: 用户机器的显存大小（默认 8，范围 1-128）
- `sidebarDefaultOpen`: 访问 HF 页面时侧边栏是否自动展开（默认 true）
- `language`: 界面语言（zh / en，默认 zh）

**部署工具默认参数：**
为每个工具提供可配置的默认参数值，例如：
- Ollama 默认上下文长度：4096
- vLLM 默认 gpu-memory-utilization：0.9

**API 配置：**
- `translationProvider`: 翻译服务提供商（none / deepl / openai / google）
- `translationApiKey`: 对应 API Key（加密存储，使用 `chrome.storage` 的敏感数据处理）
- `modelscopeApiEndpoint`: 魔搭 API 端点（高级用户可自定义）

## 7. 文件结构

```
hf-model-assistant/
├── manifest.json                 # Chrome 扩展清单
├── src/
│   ├── content/
│   │   ├── content.js            # 内容脚本入口
│   │   ├── sidebar.js            # 侧边栏逻辑
│   │   ├── sidebar.html          # 侧边栏模板
│   │   ├── sidebar.css           # 侧边栏样式
│   │   ├── tabs/
│   │   │   ├── overview.js       # 概览 Tab 逻辑
│   │   │   ├── deploy.js         # 部署 Tab 逻辑
│   │   │   ├── download.js       # 下载 Tab 逻辑
│   │   │   └── tools.js          # 工具 Tab 逻辑
│   │   └── page-scraper.js       # 页面信息提取
│   ├── background/
│   │   └── background.js         # Service Worker
│   ├── options/
│   │   ├── options.html          # 设置页面
│   │   ├── options.js            # 设置逻辑
│   │   └── options.css           # 设置样式
│   ├── shared/
│   │   ├── storage.js            # 存储封装
│   │   ├── api.js                # API 调用封装
│   │   ├── commands.js           # 命令生成器
│   │   ├── vram-estimator.js     # 显存估算
│   │   └── i18n.js               # 国际化
│   └── data/
│       └── mapping.json          # HF → ModelScope 本地映射表
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-29-hf-model-assistant-design.md  # 本文档
```

## 8. 错误处理

### 8.1 魔搭 API 失败
- API 超时（5 秒）：显示加载超时提示，自动 fallback 到本地映射表
- API 返回错误：记录错误日志，显示"服务暂时不可用，使用本地数据"
- 网络完全断开：静默使用本地映射表，不打扰用户

### 8.2 页面信息提取失败
- 如果无法提取 modelId，侧边栏显示提示："未检测到模型信息，请确保您在模型详情页"
- 文件列表提取失败时，GGUF 推荐功能隐藏

### 8.3 命令生成异常
- 参数验证失败：在参数输入框旁显示红色提示
- 显存估算数据不足：显示"无法估算，请检查模型参数信息"

### 8.4 翻译失败
- API 失败：显示"翻译服务暂时不可用，请检查 API 配置"
- 内容过长：分段翻译，显示进度

## 9. 性能考虑

- **懒加载**：侧边栏初始只加载概览 Tab 内容，其他 Tab 首次切换时才初始化
- **缓存**：魔搭映射结果缓存 7 天，避免重复请求
- **节流**：参数调整时的显存估算使用 300ms debounce
- **最小化 DOM 操作**：使用 DocumentFragment 批量更新
- **Shadow DOM**：侧边栏使用 Shadow DOM 注入，避免样式污染和冲突

## 10. 国际化

初始支持中文和英文。界面文本使用 `i18n.js` 管理：

```javascript
const i18n = {
  zh: {
    sidebarTitle: '模型助手',
    tabOverview: '概览',
    tabDeploy: '部署',
    // ...
  },
  en: {
    sidebarTitle: 'Model Assistant',
    tabOverview: 'Overview',
    // ...
  }
};
```

默认语言根据浏览器语言自动检测，用户可在设置中覆盖。

## 11. 安全考虑

- API Key 存储使用 `chrome.storage.sync`，Chrome 会自动加密同步数据
- 不在代码中硬编码任何 API Key
- Content Script 使用 Shadow DOM 隔离，避免与宿主页面 JavaScript 交互
- 所有外部 API 请求通过 background service worker 代理，Content Script 不直接发起跨域请求
- 用户输入的参数在生成命令前进行基本的 XSS 过滤（转义特殊字符）

## 12. 后续扩展（未来版本）

以下功能不在第一版实现，但架构上预留扩展空间：

- **模型对比**：同时对比多个模型的参数和性能
- **社区评分聚合**：显示模型在不同平台（HF、魔搭、Reddit）的评分
- **自动更新映射表**：插件自动从远程仓库拉取最新映射表
- **快捷命令面板**：浏览器图标 Popup 提供快速访问收藏模型
- **数据集支持**：扩展到 Hugging Face 数据集页面的映射
