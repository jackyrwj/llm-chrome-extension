const assert = require('assert');
const { I18N, t } = require('../src/shared/i18n.js');

// 中英两个字典必须键位完全一致，不允许缺译
const zhKeys = Object.keys(I18N.zh).sort();
const enKeys = Object.keys(I18N.en).sort();
assert.deepStrictEqual(zhKeys, enKeys, 'zh/en key mismatch');

// 所有值非空
for (const lang of ['zh', 'en']) {
  for (const [key, value] of Object.entries(I18N[lang])) {
    assert(value && typeof value === 'string', `${lang}.${key} is empty`);
  }
}

// t() 回退链：指定语言 → 英文 → key 本身
assert.strictEqual(t('cardTitle', 'zh'), '模型助手');
assert.strictEqual(t('cardTitle', 'en'), 'Model Assistant');
assert.strictEqual(t('cardTitle', 'fr'), 'Model Assistant');
assert.strictEqual(t('nonExistentKey', 'zh'), 'nonExistentKey');

// 镜像验证状态是核心区分（docs/adr/0001），必须有对应文案
assert(I18N.zh.verifiedMirror.includes('已验证'));
assert(I18N.zh.unverifiedMirror.includes('未验证') || I18N.zh.unverifiedMirror.includes('未经'));

console.log('All i18n tests passed!');
