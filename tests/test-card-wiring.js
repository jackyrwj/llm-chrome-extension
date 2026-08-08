const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

// manifest 引用的每个 content script 都必须真实存在，且不再引用已删除的模块
const scripts = manifest.content_scripts.flatMap(cs => cs.js);
assert(scripts.length > 0, 'content scripts must not be empty');
for (const rel of scripts) {
  assert(fs.existsSync(path.join(root, rel)), `missing content script: ${rel}`);
}
const banned = ['sidebar', 'tabs/', 'vram-estimator', 'page-scraper'];
for (const rel of scripts) {
  for (const b of banned) {
    assert(!rel.includes(b), `deleted module still referenced: ${rel}`);
  }
}

// 卡片必须包含三个固定区块（信息 → 下载 → 部署），顺序即共识
const cardSrc = fs.readFileSync(path.join(root, 'src/content/card.js'), 'utf8');
const sections = ['info', 'download', 'deploy'];
const positions = sections.map(s => cardSrc.indexOf(`data-section="${s}"`));
assert(positions.every(p => p >= 0), 'card must define all three sections');
assert(
  positions[0] < positions[1] && positions[1] < positions[2],
  'sections must appear in order: info, download, deploy'
);

// 已验证/未验证镜像必须区分展示（docs/adr/0001）
assert(cardSrc.includes('verifiedMirror'), 'card must label verified mirrors');
assert(cardSrc.includes('unverifiedMirror'), 'card must label unverified mirrors');

// content.js 必须处理 SPA 重渲染抹掉卡片的情况
const contentSrc = fs.readFileSync(path.join(root, 'src/content/content.js'), 'utf8');
assert(contentSrc.includes('MutationObserver'), 'content.js must re-inject on DOM mutation');

// background 必须校验消息来源，防止页面伪造消息
const bgSrc = fs.readFileSync(path.join(root, 'src/background/background.js'), 'utf8');
assert(bgSrc.includes('sender.id'), 'background must verify sender');

console.log('All card wiring tests passed!');
