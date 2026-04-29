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

function estimateVRAM(modelInfo, options = {}) {
  const params = inferParameterCount(modelInfo);
  if (!params) {
    return { vramGB: null, status: 'unknown', message: '无法推断模型参数量' };
  }

  const precision = options.precision || 'fp16';
  const bytesPerParam = PRECISION_BYTES[precision] || PRECISION_BYTES.fp16;
  const overhead = options.overhead || 1.2;
  const userVramGB = options.userVramGB || 24;

  let vramGB = (params * bytesPerParam / 1e9) * overhead;

  if (options.tool === 'vllm' || options.tool === 'sglang' || options.tool === 'tgi') {
    const seqLen = options.maxModelLen || 4096;
    const batchSize = options.batchSize || 1;
    const numLayers = options.numLayers || Math.floor(params / 1e9);
    const hiddenSize = options.hiddenSize || 4096;
    const kvCacheGB = (2 * numLayers * hiddenSize * seqLen * batchSize * bytesPerParam) / 1e9;
    vramGB += kvCacheGB;
  }

  let status;
  if (vramGB <= userVramGB * 0.9) {
    status = 'ok';
  } else if (vramGB <= userVramGB * 1.1) {
    status = 'warning';
  } else {
    status = 'insufficient';
  }

  return {
    vramGB: Math.round(vramGB * 10) / 10,
    status,
    paramsB: Math.round(params / 1e9 * 10) / 10,
    precision,
    userVramGB
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { estimateVRAM, parseParameterCount, inferParameterCount, PRECISION_BYTES };
}
