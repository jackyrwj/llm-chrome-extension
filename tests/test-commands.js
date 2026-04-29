const assert = require('assert');
const { generateCommand, getSupportedTools } = require('../src/shared/commands.js');

const tools = getSupportedTools();
assert(tools.includes('ollama'));
assert(tools.includes('vllm'));
assert(tools.includes('llamacpp'));

const cmd1 = generateCommand('ollama', 'meta-llama/Llama-2-7b', { quant: 'q4_K_M' });
assert(cmd1.includes('ollama run'));
assert(cmd1.includes('meta-llama/Llama-2-7b'));

const cmd2 = generateCommand('vllm', 'meta-llama/Llama-2-7b', { tp: 2, quant: 'awq' });
assert(cmd2.includes('vllm serve'));
assert(cmd2.includes('--tensor-parallel-size 2'));
assert(cmd2.includes('--quantization awq'));
assert(!cmd2.includes('--gpu-memory-utilization'));

const cmd3 = generateCommand('vllm', 'meta-llama/Llama-2-7b', {});
assert(!cmd3.includes('--tensor-parallel-size'));

const cmd4 = generateCommand('llamacpp', './model.gguf', { ngl: 35, ctx: 8192 });
assert(cmd4.includes('./main'));
assert(cmd4.includes('-ngl 35'));
assert(cmd4.includes('--ctx-size 8192'));

console.log('All command generator tests passed!');
