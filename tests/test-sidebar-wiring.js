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

// The request tab script must load before sidebar.js so that the global
// `RequestTab` referenced by sidebar.js is defined by the time it runs.
const requestScriptIndex = contentScripts.indexOf('src/content/tabs/request.js');
const sidebarScriptIndex = contentScripts.indexOf('src/content/sidebar.js');
assert(requestScriptIndex !== -1 && sidebarScriptIndex !== -1, 'Both request.js and sidebar.js must be registered content scripts');
assert(
  requestScriptIndex < sidebarScriptIndex,
  'request.js must be loaded before sidebar.js so RequestTab is defined when sidebar.js runs'
);

// The routing guard should defend against RequestTab being unavailable
// (e.g. load-order regressions) instead of throwing.
assert(
  sidebar.includes("tabName === 'request' && typeof RequestTab !== 'undefined'"),
  'Request tab routing must guard against RequestTab being undefined'
);

// The request tab button carries the same data-i18n hook other tabs use so
// its label is translated instead of hard-coded.
assert(
  /data-tab="request"[^>]*data-i18n="tabRequest"/.test(sidebar),
  'Request tab button must be wired to the tabRequest i18n key'
);

// The request tab has its own Chinese default label consistent with the
// other newly localized tabs.
assert(
  /data-tab="request" data-i18n="tabRequest">请求</.test(sidebar),
  'Request tab default (Chinese) label must be "请求"'
);

// New tab/panel pairs must stay in sync: every data-tab has a matching panel id.
const tabNames = [...sidebar.matchAll(/data-tab="([a-z]+)"/g)].map(m => m[1]);
assert(tabNames.includes('request'), 'Tab list must include the request tab');
tabNames.forEach(name => {
  assert(
    sidebar.includes(`id="panel-${name}"`),
    `Tab "${name}" must have a matching panel element`
  );
});

// Unlike overview/deploy/download, the request tab does not require an
// active model to render (it is a generic API playground), so it must not
// be listed among the model-only tabs that show the "no model" placeholder.
const modelOnlyTabsMatch = sidebar.match(/const modelOnlyTabs = (\[[^\]]*\]);/);
assert(modelOnlyTabsMatch, 'sidebar.js must define a modelOnlyTabs list');
const modelOnlyTabs = JSON.parse(modelOnlyTabsMatch[1].replace(/'/g, '"'));
assert(
  !modelOnlyTabs.includes('request'),
  'Request tab must not be gated behind having model info'
);

// content.js calls these lifecycle/layout helpers when SPA navigation moves
// between model and non-model pages. Keep them defined on Sidebar so those
// navigation paths do not throw at runtime.
assert(
  /updatePageMargin\s*\(/.test(sidebar),
  'Sidebar must expose updatePageMargin() for content.js layout updates'
);
assert(
  /destroy\s*\(/.test(sidebar),
  'Sidebar must expose destroy() for content.js SPA teardown'
);

console.log('All sidebar wiring tests passed!');
