// 只生成有确定来源的基础命令：不做任何参数推荐（见 docs/adr/0001）。
const Commands = {
  DEPLOY_TOOLS: ['vllm', 'sglang'],

  deployCommand(tool, modelId) {
    if (tool === 'vllm') return `vllm serve ${modelId}`;
    if (tool === 'sglang') return `python -m sglang.launch_server --model-path ${modelId}`;
    throw new Error(`Unknown deployment tool: ${tool}`);
  },

  // vLLM 走 ModelScope 下载权重需要这个环境变量
  vllmModelScopeCommand(msModelId) {
    return `VLLM_USE_MODELSCOPE=true vllm serve ${msModelId}`;
  },

  downloadCommand(source, modelId) {
    if (source === 'modelscope') return `modelscope download --model ${modelId}`;
    if (source === 'hf') return `huggingface-cli download ${modelId}`;
    throw new Error(`Unknown download source: ${source}`);
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Commands };
}
