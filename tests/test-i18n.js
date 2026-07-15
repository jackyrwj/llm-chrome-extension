const assert = require('assert');
const { I18N, t } = require('../src/shared/i18n.js');

// New "Request" tab translations added alongside the Request tab feature.
assert.strictEqual(I18N.zh.tabRequest, '请求');
assert.strictEqual(I18N.en.tabRequest, 'Request');

// Both locale dictionaries must define the key (no missing translation).
assert(Object.prototype.hasOwnProperty.call(I18N.zh, 'tabRequest'));
assert(Object.prototype.hasOwnProperty.call(I18N.en, 'tabRequest'));

// t() resolves the new key for each supported language explicitly.
assert.strictEqual(t('tabRequest', 'zh'), '请求');
assert.strictEqual(t('tabRequest', 'en'), 'Request');

// t() falls back to English for the new key when given an unsupported
// language code, exercising the existing fallback logic against new data.
assert.strictEqual(t('tabRequest', 'fr'), 'Request');

// Boundary/negative case: an unknown key with no translation anywhere
// falls back to returning the key itself rather than throwing or
// returning undefined.
assert.strictEqual(t('tabRequestNonExistentKey', 'zh'), 'tabRequestNonExistentKey');
assert.strictEqual(t('tabRequestNonExistentKey', 'en'), 'tabRequestNonExistentKey');

console.log('All i18n tests passed!');