const assert = require('assert');
const { estimateVRAM, parseParameterCount, normalizeModelConfig } = require('../src/shared/vram-estimator.js');

assert.strictEqual(parseParameterCount('7B'), 7e9);
assert.strictEqual(parseParameterCount('13B'), 13e9);
assert.strictEqual(parseParameterCount('70b'), 70e9);
assert.strictEqual(parseParameterCount('1.5B'), 1.5e9);
assert.strictEqual(parseParameterCount('unknown'), null);

const result1 = estimateVRAM({ parameterCount: '7B' }, { precision: 'fp16' });
assert(result1.vramGB > 14 && result1.vramGB < 18, `7B FP16 should be ~16.8GB, got ${result1.vramGB}`);
assert.strictEqual(result1.status, 'ok');

const result2 = estimateVRAM({ parameterCount: '7B' }, { precision: 'int4' });
assert(result2.vramGB > 3 && result2.vramGB < 6, `7B INT4 should be ~4.2GB, got ${result2.vramGB}`);

const result3 = estimateVRAM({ parameterCount: '70B' }, { precision: 'fp16', userVramGB: 160 });
assert.strictEqual(result3.status, 'warning');

const result4 = estimateVRAM({ parameterCount: '70B' }, { precision: 'fp16', userVramGB: 16 });
assert.strictEqual(result4.status, 'insufficient');

const result5 = estimateVRAM({ modelId: 'meta-llama/Llama-2-7b-hf' }, {});
assert(result5.vramGB > 14, 'Should infer 7B from model name');

const normalized = normalizeModelConfig({
  text_config: {
    num_hidden_layers: 64,
    hidden_size: 5120,
    num_attention_heads: 40,
    num_key_value_heads: 8
  }
});
assert.strictEqual(normalized.num_hidden_layers, 64);
assert.strictEqual(normalized.hidden_size, 5120);
assert.strictEqual(normalized.num_key_value_heads, 8);

const result6 = estimateVRAM({
  parameterCount: '32B',
  config: {
    text_config: {
      num_hidden_layers: 64,
      hidden_size: 5120,
      num_attention_heads: 40,
      num_key_value_heads: 8
    }
  }
}, { tool: 'vllm', precision: 'fp16' });
assert.strictEqual(result6.configLoaded, true);
assert.strictEqual(result6.numLayers, 64);
assert.strictEqual(result6.hiddenSize, 5120);
assert.strictEqual(result6.numKVHeads, 8);

console.log('All VRAM estimator tests passed!');
