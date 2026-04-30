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
      // 模型与路径
      servedModelName: {
        flag: '--served-model-name', type: 'text', default: '',
        group: '模型与路径', common: true,
        description: '对外暴露的模型名称（API 调用时使用）',
        placeholder: '如 qwen3-35b'
      },
      tokenizer: {
        flag: '--tokenizer', type: 'text', default: '',
        group: '模型与路径',
        description: '分词器路径，通常留空（默认使用模型路径）',
        placeholder: '留空则使用模型路径'
      },
      trustRemoteCode: {
        flag: '--trust-remote-code', type: 'checkbox', default: false,
        group: '模型与路径', common: true,
        description: '允许加载模型自定义代码，Qwen、InternVL 等通常需要'
      },
      // 显存与多卡
      tp: {
        flag: '--tensor-parallel-size', type: 'number', default: 1, min: 1,
        group: '显存与多卡', common: true, alwaysInclude: true,
        description: '模型切到几张 GPU 上运行（张量并行），多卡时设为卡数'
      },
      gpuUtil: {
        flag: '--gpu-memory-utilization', type: 'range', min: 0.1, max: 0.99, step: 0.01, default: 0.9,
        group: '显存与多卡',
        description: '允许使用的显存比例，常见 0.85～0.95，爆显存时调小'
      },
      maxNumSeqs: {
        flag: '--max-num-seqs', type: 'number', default: 16, min: 1,
        group: '显存与多卡',
        description: '同时处理的最大请求数，调大提升并发但增加显存占用'
      },
      maxNumBatchedTokens: {
        flag: '--max-num-batched-tokens', type: 'number', default: 8192, min: 1,
        group: '显存与多卡',
        description: '一次 batch 最多处理的 token 数，调小可减少爆显存风险'
      },
      // 上下文长度
      maxModelLen: {
        flag: '--max-model-len', type: 'number', default: 32768, min: 1,
        group: '上下文长度', common: true, alwaysInclude: true,
        description: 'KV Cache 最大长度，越大显存压力越高。普通业务建议 32768，接入 Agent/RAG 建议 65536'
      },
      // 精度与量化
      dtype: {
        flag: '--dtype', type: 'select', options: ['auto', 'float16', 'bfloat16', 'half', 'float32'], default: 'auto',
        group: '精度与量化', common: true, alwaysInclude: true,
        description: 'A800/4090/RTX PRO 6000 等支持 BF16 的卡优先选 bfloat16，普通卡选 float16'
      },
      quant: {
        flag: '--quantization', type: 'select', options: ['none', 'awq', 'gptq', 'fp8', 'marlin'], default: 'none',
        group: '精度与量化',
        description: '量化模型才需要指定，下载的是量化版（如 AWQ）时对应填写，普通 BF16 模型留 none'
      },
      // 工具调用
      enableAutoToolChoice: {
        flag: '--enable-auto-tool-choice', type: 'checkbox', default: false,
        group: '工具调用 / Function Calling',
        description: '启用自动工具选择，需配合 --tool-call-parser 使用。出现 auto tool choice 报错时勾选'
      },
      toolCallParser: {
        flag: '--tool-call-parser', type: 'select',
        options: ['none', 'qwen', 'qwen25', 'qwen3_coder', 'hermes', 'llama3_json', 'mistral'],
        default: 'none',
        group: '工具调用 / Function Calling',
        description: 'Qwen2.5 系列用 qwen25，Qwen3 系列用 qwen3_coder，其余参考模型文档'
      },
      // Thinking 控制
      chatTemplateKwargs: {
        flag: '--chat-template-kwargs', type: 'text', default: '',
        group: 'Thinking 控制',
        description: 'Qwen3 等模型控制思考模式，不想输出思考过程时填写下方示例',
        placeholder: '\'{"enable_thinking": false}\''
      },
      // 接口服务
      host: {
        flag: '--host', type: 'text', default: '0.0.0.0',
        group: '接口服务',
        description: '监听地址，0.0.0.0 允许局域网访问，127.0.0.1 仅本机访问'
      },
      port: {
        flag: '--port', type: 'number', default: 8000, min: 1, max: 65535,
        group: '接口服务',
        description: '服务端口号，默认 8000'
      },
      apiKey: {
        flag: '--api-key', type: 'text', default: '',
        group: '接口服务',
        description: '兼容 OpenAI API 的鉴权密钥，留空则不启用鉴权',
        placeholder: '留空则不启用鉴权'
      },
      enforceEager: {
        flag: '--enforce-eager', type: 'checkbox', default: false,
        group: '接口服务',
        description: '禁用 CUDA graph（调试用），会明显降低推理性能，生产环境不建议勾选'
      }
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

  if (tool === 'ollama' && params.quant && params.quant !== 'none') {
    modelId = `${modelId}:${params.quant}`;
  }

  const base = template.baseCmd.replace('{model}', modelId);
  const args = [];

  for (const [key, config] of Object.entries(template.params)) {
    const value = params[key] !== undefined ? params[key] : config.default;
    const isDefault = value === config.default;
    if (!config.alwaysInclude && isDefault) continue;
    if (config.type === 'checkbox' && !value) continue;
    if (config.type === 'select' && value === 'none') continue;
    if (config.type === 'text' && (!value || value === '')) continue;
    if (tool === 'ollama' && key === 'quant') continue;

    if (config.type === 'checkbox' && value) {
      args.push(config.flag);
    } else if (config.flag) {
      args.push(`${config.flag} ${value}`);
    } else {
      args.push(String(value));
    }
  }

  if (args.length === 0) return base;

  if (tool === 'vllm') {
    return base + ' \\\n  ' + args.join(' \\\n  ');
  }

  return base + ' ' + args.join(' ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEPLOY_TEMPLATES, getSupportedTools, getToolLabel, getToolParams, generateCommand };
}
