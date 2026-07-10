const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const sidebar = fs.readFileSync(path.join(root, 'src/content/sidebar.js'), 'utf8');
const { I18N } = require(path.join(root, 'src/shared/i18n.js'));

const contentScripts = manifest.content_scripts.flatMap(entry => entry.js || []);

assert(
  contentScripts.includes('src/content/tabs/request.js'),
  'Request tab script must be loaded by the extension manifest'
);
assert(
  sidebar.includes('data-tab="request"'),
  'Request tab must have a visible navigation control'
);
assert(
  sidebar.includes('id="panel-request"'),
  'Request tab must have a content panel'
);
assert(
  sidebar.includes("RequestTab.render(this.getPanel('request'), this.modelInfo)"),
  'Request tab must be routed to its renderer'
);
assert.strictEqual(I18N.zh.tabRequest, '请求');
assert.strictEqual(I18N.en.tabRequest, 'Request');

console.log('All sidebar wiring tests passed!');
