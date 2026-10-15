// The field shell is cache-first: cache.addAll(ASSETS) runs at install time
// and rejects the whole install if any single entry 404s. These tests keep the
// precache list honest in both directions — every listed file exists, and every
// same-origin file a page fetches at runtime is listed, so the first offline
// visit does not lose a feature (the Netanya lots layer did exactly that).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function precachedAssets() {
  const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  return [...block.matchAll(/'(\.\/[^']*)'/g)]
    .map((m) => m[1])
    .filter((a) => a !== './');
}

function htmlPages() {
  return fs.readdirSync(root).filter((f) => f.endsWith('.html'));
}

// Literal same-origin fetch targets inside a page's inline scripts.
function runtimeFetches(html) {
  const out = [];
  for (const m of html.matchAll(/fetch\(\s*(["'])([^"']+)\1/g)) {
    const url = m[2];
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) continue;
    out.push(url.replace(/^\.\//, '').split(/[?#]/)[0]);
  }
  return out;
}

test('every precached asset exists on disk', () => {
  const missing = precachedAssets().filter((a) => !fs.existsSync(path.join(root, a)));
  assert.deepEqual(missing, [], 'cache.addAll would reject the install for: ' + missing.join(', '));
});

test('precache list has no duplicates', () => {
  const list = precachedAssets();
  assert.equal(new Set(list).size, list.length);
});

test('every same-origin file a page fetches at runtime is precached', () => {
  const cached = new Set(precachedAssets().map((a) => a.replace(/^\.\//, '')));
  const uncached = [];
  for (const page of htmlPages()) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const target of runtimeFetches(html)) {
      if (!cached.has(target)) uncached.push(page + ' -> ' + target);
    }
  }
  assert.deepEqual(uncached, []);
});

test('the municipal lots layer is part of the offline shell', () => {
  assert.ok(precachedAssets().includes('./netanya-lots.geojson'));
  assert.ok(fs.statSync(path.join(root, 'netanya-lots.geojson')).size > 0);
});

test('cache name is versioned so a changed asset list re-installs', () => {
  assert.match(sw, /const CACHE = 'parkwiz-field-v\d+';/);
  const v = Number(sw.match(/parkwiz-field-v(\d+)/)[1]);
  assert.ok(v >= 8, 'adding netanya-lots.geojson to ASSETS requires a cache bump');
});
