const DEPLOY_TEMPLATES = {
  ollama: {
    label: 'Ollama',
    baseCmd: 'ollama run {model}',
    params: {
      quant: { flag: '', type: 'select', options: ['none', 'q4_0', 'q4_K_M', 'q5_K_M', 'q8_0'], default: 'none' },
      ctx: { flag: '--ctx-size', type: 'number', default: 4096 }
    }
  },
  vllm: {
    label: 'vLLM',
    baseCmd: 'vllm serve {model}',
    params: {
      tp: { flag: '--tensor-parallel-size', type: 'number', default: 1 },
      gpuUtil: { flag: '--gpu-memory-utilization', type: 'range', min: 0.1, max: 0.99, step: 0.01, default: 0.9 },
      quant: { flag: '--quantization', type: 'select', options: ['none', 'awq', 'gptq', 'fp8', 'marlin'], default: 'none' },
      maxModelLen: { flag: '--max-model-len', type: 'number', default: 8192 },
      dtype: { flag: '--dtype', type: 'select', options: ['auto', 'half', 'float16', 'bfloat16', 'float32'], default: 'auto' }
    }
  },
  sglang: {
    label: 'SGLang',
    baseCmd: 'python -m sglang.launch_server --model {model}',
    params: {
      tp: { flag: '--tp-size', type: 'number', default: 1 },
      port: { flag: '--port', type: 'number', default: 30000 }
    }
  },
  llamacpp: {
    label: 'llama.cpp',
    baseCmd: './main -m {model}',
    params: {
      ngl: { flag: '-ngl', type: 'number', default: 0 },
      ctx: { flag: '--ctx-size', type: 'number', default: 4096 },
      threads: { flag: '-t', type: 'number', default: 4 }
    }
  },
  transformers: {
    label: 'Transformers',
    baseCmd: "python -c \"from transformers import AutoModelForCausalLM, AutoTokenizer; model = AutoModelForCausalLM.from_pretrained('{model}')\"",
    params: {
      device: { flag: '--device', type: 'select', options: ['auto', 'cuda', 'cpu'], default: 'auto' },
      torchDtype: { flag: '--torch_dtype', type: 'select', options: ['auto', 'float16', 'bfloat16', 'float32'], default: 'auto' },
      loadIn8bit: { flag: '--load_in_8bit', type: 'checkbox', default: false },
      loadIn4bit: { flag: '--load_in_4bit', type: 'checkbox', default: false }
    }
  },
  tgi: {
    label: 'TGI (Text Generation Inference)',
    baseCmd: 'docker run --gpus all -p 8080:80 ghcr.io/huggingface/text-generation-inference:latest --model-id {model}',
    params: {
      quant: { flag: '--quantize', type: 'select', options: ['none', 'bitsandbytes', 'bitsandbytes-nf4', 'bitsandbytes-fp4', 'gptq', 'awq', 'eetq'], default: 'none' },
      maxInputLength: { flag: '--max-input-length', type: 'number', default: 4096 },
      maxTotalTokens: { flag: '--max-total-tokens', type: 'number', default: 8192 }
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

    if (config.type === 'checkbox' && value) {
      cmd += ` ${config.flag}`;
    } else {
      cmd += ` ${config.flag} ${value}`;
    }
  }

  return cmd;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEPLOY_TEMPLATES, getSupportedTools, getToolLabel, getToolParams, generateCommand };
}
