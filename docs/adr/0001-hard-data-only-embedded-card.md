# 0001 硬数据原则：砍推断功能，改嵌入卡片

插件此前有 6 个 Tab（概览/部署/下载/收藏/推荐/API 调试），侧边栏形态。2026-08 重新定位：目标市场定为国内小团队自建推理服务（国外已有 NEBUL-AI 等直接竞品，且镜像映射、翻译对国外用户无价值，无法差异化）。据此确立**硬数据原则**：只展示有确定来源的精确数据（HF API config、文件列表及大小、人工维护的镜像映射表），一切推断性能力（正则猜参数量、VRAM/KV cache/并发估算、硬件参数推荐）全部删除。推荐、收藏、翻译、API 调试 curl 生成器一并删除。UI 从侧边栏改为嵌入模型页右侧栏顶部的中性卡片，因为侧边栏挤占页面宽度且与原站样式割裂。

## Considered Options

- 保留 VRAM 估算并加入 KV cache/并发/多卡建议：拒绝，这些值依赖运行时参数，纯属猜测，违反硬数据原则。
- 只做国外市场：拒绝，VRAM/部署功能在国外已有竞品，插件的差异化（ModelScope 镜像、中文）只对国内用户成立。
- 保留 Tab 栏只重排优先级：拒绝，Tab 栏本身是功能过多的症状，三个核心区块可一页平铺。

## Consequences

- `vram-estimator.js`、`recommend.js`、`favorites.js`、`request.js`、`tools.js`、`sidebar.js` 及翻译链路（background translate、options 翻译设置）全部移除。
- 镜像映射未命中时保留 ModelScope 搜索 API 兜底，但必须标注"未验证"，因为候选与目标模型权重一致性未经人工确认。
- mapping.json 成为核心资产，需持续维护（当前约 143 条，含 lastVerified 字段）。
