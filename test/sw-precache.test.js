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

// Pages under demo/ reach their libs with ../src/lib/x.js; the precache list is
// written from the repo root, so resolve the relative src against the page.
function scriptSrcs(html, page) {
  const dir = path.posix.dirname(page);
  const out = [];
  for (const m of html.matchAll(/<script[^>]*\ssrc=(["'])([^"']+)\1/g)) {
    const src = m[2];
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    out.push(path.posix.normalize(path.posix.join(dir, src)));
  }
  return out;
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

// runtimeFetches only sees fetch() calls, so a page that pulls in a new library
// with <script src> could ship a feature that is blank offline — which is what
// demo/atidim-board.html did to src/lib/margin.js when the margin panel landed.
test('every library a precached page <script src>s is precached too', () => {
  const cached = new Set(precachedAssets().map((a) => a.replace(/^\.\//, '')));
  const pages = [...htmlPages(), ...fs.readdirSync(path.join(root, 'demo'))
    .filter((f) => f.endsWith('.html')).map((f) => 'demo/' + f)];
  const uncached = [];
  for (const page of pages) {
    if (!cached.has(page) && page.includes('/')) continue; // not in the shell at all
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const src of scriptSrcs(html, page)) {
      if (!cached.has(src)) uncached.push(page + ' -> ' + src);
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
  // Cache-first: without a bump, a laptop that already opened the demo keeps
  // serving the stale page on the morning of the meeting.
  assert.ok(v >= 12, 'changing the Atidim demo shell requires a cache bump');
});
