const assert = require('assert');
const { Commands } = require('../src/shared/commands.js');

// 硬数据原则：只生成基础命令，不带任何推荐参数
assert.deepStrictEqual(Commands.DEPLOY_TOOLS, ['vllm', 'sglang']);

assert.strictEqual(
  Commands.deployCommand('vllm', 'Qwen/Qwen3-32B'),
  'vllm serve Qwen/Qwen3-32B'
);
assert.strictEqual(
  Commands.deployCommand('sglang', 'Qwen/Qwen3-32B'),
  'python -m sglang.launch_server --model-path Qwen/Qwen3-32B'
);
assert.strictEqual(
  Commands.vllmModelScopeCommand('qwen/Qwen3-32B'),
  'VLLM_USE_MODELSCOPE=true vllm serve qwen/Qwen3-32B'
);

assert.strictEqual(
  Commands.downloadCommand('modelscope', 'qwen/Qwen3-32B'),
  'modelscope download --model qwen/Qwen3-32B'
);
assert.strictEqual(
  Commands.downloadCommand('hf', 'Qwen/Qwen3-32B'),
  'huggingface-cli download Qwen/Qwen3-32B'
);

// 未知工具/来源必须抛错，而不是静默生成错误命令
assert.throws(() => Commands.deployCommand('ollama', 'm'), /Unknown deployment tool/);
assert.throws(() => Commands.downloadCommand('hf-mirror', 'm'), /Unknown download source/);

console.log('All command tests passed!');
