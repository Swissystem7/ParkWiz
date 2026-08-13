const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pwa = fs.readFileSync(path.join(root, 'src', 'lib', 'pwa.js'), 'utf8');
const compare = fs.readFileSync(path.join(root, 'pilot-compare.html'), 'utf8');

test('manifest is a Hebrew RTL field install, not a live parking engine', () => {
  assert.equal(manifest.lang, 'he');
  assert.equal(manifest.dir, 'rtl');
  assert.equal(manifest.start_url, './pilot-compare.html');
  assert.match(manifest.description, /בלי מצלמה חיה/);
  assert.match(manifest.description, /ספירת פקח/);
});

test('service worker caches the field shell and not a third-party CDN', () => {
  const assetsBlock = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  assert.match(assetsBlock, /pilot-compare\.html/);
  assert.match(assetsBlock, /pilot-summary\.html/);
  assert.match(assetsBlock, /pilot-log\.html/);
  assert.match(assetsBlock, /pilot-brief\.html/);
  assert.match(assetsBlock, /offer\.html/);
  assert.match(assetsBlock, /src\/lib\/offer\.js/);
  assert.match(assetsBlock, /pilot-calibrate\.html/);
  assert.match(assetsBlock, /pilot-eval\.html/);
  assert.match(assetsBlock, /pilot-method\.html/);
  assert.match(assetsBlock, /sample-pairs\.json/);
  assert.match(assetsBlock, /sample-log\.json/);
  assert.match(assetsBlock, /sample-lot\.svg/);
  assert.match(assetsBlock, /sample-empty-night\.svg/);
  assert.match(assetsBlock, /src\/lib\/compare\.js/);
  assert.match(assetsBlock, /src\/lib\/protocol\.js/);
  assert.match(assetsBlock, /src\/lib\/heuristic\.js/);
  assert.match(assetsBlock, /src\/lib\/dataset\.js/);
  assert.match(assetsBlock, /src\/lib\/calibrate\.js/);
  assert.doesNotMatch(assetsBlock, /unpkg|leaflet|cdnjs/i);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
});

test('PWA helper registers a same-origin worker and labels the offline state', () => {
  assert.match(pwa, /serviceWorker\.register\('\.\/sw\.js'/);
  assert.match(pwa, /אין רשת — עובדים מהמטמון המקומי/);
  assert.match(compare, /src="src\/lib\/pwa\.js"/);
  assert.match(compare, /id="pwInstallBtn"/);
});
