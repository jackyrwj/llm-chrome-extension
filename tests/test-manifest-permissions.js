const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const privacyPolicy = fs.readFileSync(path.join(root, 'privacy-policy.html'), 'utf8');

assert.strictEqual(manifest.version, '1.0.2', 'The remediation package must use a new store version');
assert(
  !manifest.permissions.includes('activeTab'),
  'activeTab must not be requested because the extension uses scoped content scripts'
);
assert(manifest.permissions.includes('storage'), 'storage is required for user settings and favorites');
assert(manifest.permissions.includes('clipboardWrite'), 'clipboardWrite is required for copying commands');
assert(
  !privacyPolicy.includes('<strong>activeTab</strong>'),
  'The privacy policy must not disclose a permission the extension no longer requests'
);

console.log('All manifest permission tests passed!');
