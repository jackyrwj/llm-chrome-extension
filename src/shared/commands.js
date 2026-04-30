const DEPLOY_TEMPLATES = {
  ollama: {
    label: 'Ollama',
    baseCmd: 'ollama run {model}',
    params: {
      quant: { flag: '', type: 'select', options: ['none', 'q4_0', 'q4_K_M', 'q5_K_M', 'q8_0'], default: 'none' },
      ctx: { flag: '--ctx-size', type: 'number', default: 4096, min: 512, max: 131072 },
      temperature: { flag: '--temperature', type: 'range', min: 0, max: 2, step: 0.1, default: 0.8 },
      seed: { flag: '--seed', type: 'number', default: 0, min: 0 },
      numPredict: { flag: '--num-predict', type: 'number', default: 128, min: -2, max: 128000 }
    }
  },
  vllm: {
    label: 'vLLM',
    baseCmd: 'vllm serve {model}',
    params: {
      tp: { flag: '--tensor-parallel-size', type: 'number', default: 1, min: 1 },
      gpuUtil: { flag: '--gpu-memory-utilization', type: 'range', min: 0.1, max: 0.99, step: 0.01, default: 0.9 },
      quant: { flag: '--quantization', type: 'select', options: ['none', 'awq', 'gptq', 'fp8', 'marlin'], default: 'none' },
      maxModelLen: { flag: '--max-model-len', type: 'number', default: 8192, min: 1 },
      dtype: { flag: '--dtype', type: 'select', options: ['auto', 'half', 'float16', 'bfloat16', 'float32'], default: 'auto' },
      port: { flag: '--port', type: 'number', default: 8000, min: 1, max: 65535 },
      apiKey: { flag: '--api-key', type: 'text', default: '' },
      enforceEager: { flag: '--enforce-eager', type: 'checkbox', default: false },
      maxNumSeqs: { flag: '--max-num-seqs', type: 'number', default: 256, min: 1 }
    }
  },
  sglang: {
    label: 'SGLang',
    baseCmd: 'python -m sglang.launch_server --model {model}',
    params: {
      tp: { flag: '--tp-size', type: 'number', default: 1, min: 1 },
      port: { flag: '--port', type: 'number', default: 30000, min: 1, max: 65535 },
      memFraction: { flag: '--mem-fraction-static', type: 'range', min: 0.1, max: 0.99, step: 0.01, default: 0.85 },
      maxRunning: { flag: '--max-running-requests', type: 'number', default: 128, min: 1 },
      chunkPrefill: { flag: '--chunked-prefill-size', type: 'number', default: 8192, min: 0 }
    }
  },
  llamacpp: {
    label: 'llama.cpp',
    baseCmd: './main -m {model}',
    params: {
      ngl: { flag: '-ngl', type: 'number', default: 0, min: 0 },
      ctx: { flag: '--ctx-size', type: 'number', default: 4096, min: 512, max: 131072 },
      threads: { flag: '-t', type: 'number', default: 4, min: 1 },
      temp: { flag: '--temp', type: 'range', min: 0, max: 2, step: 0.1, default: 0.8 },
      topP: { flag: '--top-p', type: 'range', min: 0, max: 1, step: 0.05, default: 0.95 },
      repeatPenalty: { flag: '--repeat-penalty', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1.1 },
      batchSize: { flag: '-b', type: 'number', default: 2048, min: 1 }
    }
  },
  transformers: {
    label: 'Transformers',
    baseCmd: "python -c \"from transformers import AutoModelForCausalLM, AutoTokenizer; model = AutoModelForCausalLM.from_pretrained('{model}')\"",
    params: {
      device: { flag: '--device', type: 'select', options: ['auto', 'cuda', 'cpu'], default: 'auto' },
      torchDtype: { flag: '--torch_dtype', type: 'select', options: ['auto', 'float16', 'bfloat16', 'float32'], default: 'auto' },
      loadIn8bit: { flag: '--load_in_8bit', type: 'checkbox', default: false },
      loadIn4bit: { flag: '--load_in_4bit', type: 'checkbox', default: false },
      trustRemote: { flag: '--trust_remote_code', type: 'checkbox', default: false },
      attnImpl: { flag: '--attn_implementation', type: 'select', options: ['auto', 'eager', 'flash_attention_2', 'sdpa'], default: 'auto' },
      maxMemory: { flag: '--max_memory', type: 'text', default: '' }
    }
  },
  tgi: {
    label: 'TGI (Text Generation Inference)',
    baseCmd: 'docker run --gpus all -p 8080:80 ghcr.io/huggingface/text-generation-inference:latest --model-id {model}',
    params: {
      quant: { flag: '--quantize', type: 'select', options: ['none', 'bitsandbytes', 'bitsandbytes-nf4', 'bitsandbytes-fp4', 'gptq', 'awq', 'eetq'], default: 'none' },
      maxInputLength: { flag: '--max-input-length', type: 'number', default: 4096, min: 1 },
      maxTotalTokens: { flag: '--max-total-tokens', type: 'number', default: 8192, min: 1 },
      port: { flag: '-p', type: 'number', default: 8080, min: 1, max: 65535 },
      sharded: { flag: '--sharded', type: 'select', options: ['none', 'true', 'false'], default: 'none' },
      numShard: { flag: '--num-shard', type: 'number', default: 1, min: 1 }
    }
  }
};

function getSupportedTools() {
  return Object.keys(DEPLOY_TEMPLATES);
}

function getToolLabel(tool) {
  return DEPLOY_TEMPLATES[tool]?.label || tool;
}

function getToolParams(tool) {
  return DEPLOY_TEMPLATES[tool]?.params || {};
}

function generateCommand(tool, modelId, params = {}) {
  const template = DEPLOY_TEMPLATES[tool];
  if (!template) {
    throw new Error(`Unknown deployment tool: ${tool}`);
  }

  // Ollama quant is a model suffix, not a flag
  if (tool === 'ollama' && params.quant && params.quant !== 'none') {
    modelId = `${modelId}:${params.quant}`;
  }

  let cmd = template.baseCmd.replace('{model}', modelId);

  for (const [key, config] of Object.entries(template.params)) {
    const value = params[key];
    if (value === undefined || value === null || value === config.default) {
      continue;
    }
    if (config.type === 'checkbox' && !value) {
      continue;
    }
    if (config.type === 'select' && value === 'none') {
      continue;
    }
    // Skip empty text values
    if (config.type === 'text' && (!value || value === '')) {
      continue;
    }
    // Skip ollama quant since it's handled as model suffix
    if (tool === 'ollama' && key === 'quant') {
      continue;
    }

    if (config.type === 'checkbox' && value) {
      cmd += ` ${config.flag}`;
    } else if (config.flag) {
      cmd += ` ${config.flag} ${value}`;
    } else {
      cmd += ` ${value}`;
    }
  }

  return cmd;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEPLOY_TEMPLATES, getSupportedTools, getToolLabel, getToolParams, generateCommand };
}
