const PRECISION_BYTES = {
  fp32: 4.0,
  fp16: 2.0,
  bf16: 2.0,
  int8: 1.0,
  int4: 0.5,
  q4: 0.5,
  q4_k_m: 0.58,
  q5_k_m: 0.67,
  q6_k: 0.78,
  q8_0: 1.0,
  awq: 0.5,
  gptq: 0.5,
  fp8: 1.0
};

function parseParameterCount(input) {
  if (!input) return null;
  const match = String(input).match(/(\d+\.?\d*)\s*[Bb]/);
  if (match) {
    return parseFloat(match[1]) * 1e9;
  }
  return null;
}

function inferParameterCount(modelInfo) {
  if (modelInfo.parameterCount) {
    const parsed = parseParameterCount(modelInfo.parameterCount);
    if (parsed) return parsed;
  }
  if (modelInfo.modelId) {
    const patterns = [
      /(\d+\.?\d*)[Bb]/,
      /-(\d+)[bB]/,
    ];
    for (const pattern of patterns) {
      const match = modelInfo.modelId.match(pattern);
      if (match) return parseFloat(match[1]) * 1e9;
    }
  }
  if (modelInfo.tags) {
    for (const tag of modelInfo.tags) {
      const parsed = parseParameterCount(tag);
      if (parsed) return parsed;
    }
  }
  return null;
}

function normalizeModelConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') return {};

  const queue = [rawConfig];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    const hasLayers = Number.isFinite(current.num_hidden_layers);
    const hasHidden = Number.isFinite(current.hidden_size);
    const hasHeads = Number.isFinite(current.num_attention_heads);
    const hasKvHeads = Number.isFinite(current.num_key_value_heads);

    if (hasLayers || hasHidden || hasHeads || hasKvHeads) {
      return {
        num_hidden_layers: hasLayers ? current.num_hidden_layers : null,
        hidden_size: hasHidden ? current.hidden_size : null,
        num_attention_heads: hasHeads ? current.num_attention_heads : null,
        num_key_value_heads: hasKvHeads ? current.num_key_value_heads : null
      };
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return {};
}

function estimateVRAM(modelInfo, options = {}) {
  const params = inferParameterCount(modelInfo);
  if (!params) {
    return { vramGB: null, status: 'unknown', message: '无法推断模型参数量' };
  }

  const precision = options.precision || 'fp16';
  const bytesPerParam = PRECISION_BYTES[precision] || PRECISION_BYTES.fp16;
  const userVramGB = options.userVramGB || 24;

  // 模型权重显存（含框架 overhead 20%）
  let vramGB = (params * bytesPerParam / 1e9) * 1.2;

  // KV Cache（仅 server 框架需要）
  const cfg = normalizeModelConfig(modelInfo && modelInfo.config);
  const paramsB = params / 1e9;
  const numLayers = cfg.num_hidden_layers || _estimateLayers(paramsB);
  const hiddenSize = cfg.hidden_size || _estimateHiddenSize(paramsB);
  const numAttnHeads = cfg.num_attention_heads || _estimateAttentionHeads(hiddenSize);
  // GQA 模型 KV head 数量更少（如 Qwen3-32B 是 8）
  const numKVHeads = cfg.num_key_value_heads || numAttnHeads;

  if (options.tool === 'vllm' || options.tool === 'sglang' || options.tool === 'tgi') {
    const seqLen = options.maxModelLen || 4096;
    const headDim = Math.round(hiddenSize / numAttnHeads);

    // KV Cache = 2(K+V) × 层数 × KV头数 × 头维度 × seqLen × 字节数
    const kvBytesPerToken = 2 * numLayers * numKVHeads * headDim * bytesPerParam;
    const kvCacheGB = (kvBytesPerToken * seqLen) / 1e9;
    vramGB += kvCacheGB;
  }

  let status;
  if (vramGB <= userVramGB * 0.9) status = 'ok';
  else if (vramGB <= userVramGB * 1.1) status = 'warning';
  else status = 'insufficient';

  return {
    vramGB: Math.round(vramGB * 10) / 10,
    status,
    paramsB: Math.round(params / 1e9 * 10) / 10,
    precision,
    userVramGB,
    configLoaded: !!(cfg.num_hidden_layers || cfg.hidden_size || cfg.num_key_value_heads),
    numLayers,
    hiddenSize,
    numKVHeads
  };
}

function _estimateLayers(paramsB) {
  if (paramsB <= 3)  return 28;
  if (paramsB <= 8)  return 32;
  if (paramsB <= 14) return 40;
  if (paramsB <= 32) return 64;
  if (paramsB <= 72) return 80;
  return 96;
}

function _estimateHiddenSize(paramsB) {
  if (paramsB <= 3)  return 3072;
  if (paramsB <= 8)  return 4096;
  if (paramsB <= 14) return 5120;
  if (paramsB <= 32) return 5120;
  if (paramsB <= 72) return 8192;
  return 8192;
}

function _estimateAttentionHeads(hiddenSize) {
  if (!hiddenSize) return 32;
  return Math.max(8, Math.round(hiddenSize / 128));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estimateVRAM,
    parseParameterCount,
    inferParameterCount,
    normalizeModelConfig,
    PRECISION_BYTES
  };
}
