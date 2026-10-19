// demo/camera.html is the one ParkWiz surface that claims to do real work on
// real pixels, so these tests guard the claims it makes in a meeting room: that
// every occupancy decision comes from src/lib/vision-occupancy.js (and still
// exists there), that frames never leave the browser, and that the page is
// usable — Hebrew RTL, skip link, live regions — before the model has loaded.
// Detection itself needs WebGL and a camera; the engine is covered by
// test/vision-occupancy.test.js, so what is checkable in node is checked here.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const VO = require('../src/lib/vision-occupancy');
const OCC = require('../src/lib/occupancy');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'camera.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const js = scripts.join('\n');

test('the page is wired to libraries and markup that actually exist', () => {
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(js));
  for (const [ns, api] of [['VO', VO], ['OCC', OCC]]) {
    const names = new Set([...js.matchAll(new RegExp('\\b' + ns + '\\.(\\w+)', 'g'))].map((m) => m[1]));
    assert.ok(names.size > 0, ns + ' is loaded but never used');
    for (const n of names) assert.equal(typeof api[n], 'function', ns + '.' + n + ' does not exist');
  }
  assert.match(html, /src="\.\.\/src\/lib\/vision-occupancy\.js"/);
  assert.match(html, /src="\.\.\/src\/lib\/occupancy\.js"/);
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const wanted = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
  assert.ok(wanted.length >= 8);
  assert.deepEqual(wanted.filter((id) => !ids.has(id)), []);
  // Every occupancy decision goes through the engine. A threshold, debounce or
  // class list re-declared here would drift from it, untested.
  for (const call of ['VO.createTracker(', 'VO.normalizeDetections(', 'VO.spotFromDrag(', 'tracker.update(boxes, ts)']) {
    assert.ok(js.includes(call), call + ' is gone from the page');
  }
  assert.doesNotMatch(js, /\bIoU\b|intersectionOver|overlapScore|classes:/i);
  assert.deepEqual([...VO.VEHICLE_CLASSES].sort(), ['bus', 'car', 'motorcycle', 'truck']);
});

test('the page is Hebrew RTL and usable before the model loads', () => {
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /class="skip-link" href="#main"/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/pilot\/shell\.css">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="status"/);
  // Loading 6MB at page load would leave an offline laptop with nothing at all,
  // so the detector is injected on first use and its failure is said in Hebrew.
  assert.doesNotMatch(html, /<script[^>]*src="https:\/\/cdn\.jsdelivr/);
  assert.match(js, /function ensureModel\(\)/);
  assert.match(js, /loadScript\(TFJS\)/);
  assert.match(js, /טעינת המודל נכשלה/);
  // Every promise the page starts is handled: an unhandled rejection in front
  // of an operator is the console error this demo cannot afford.
  for (const call of ['model.detect(work)', 'navigator.mediaDevices.getUserMedia', 'ensureModel()']) {
    const at = js.indexOf(call);
    assert.ok(at > 0, call + ' is gone');
    assert.match(js.slice(at, at + 480), /\.catch\(|function \(\) \{ \/\* the Hebrew/);
  }
});

test('frames never leave the browser, and the page says so', () => {
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|FormData|sendBeacon|WebSocket|toDataURL|toBlob/);
  assert.match(html, /הפריימים לא יוצאים מהמכשיר/);
  assert.match(html, /אין זיהוי לוחיות רישוי/);
  // Only the model is off-origin, and only from the pinned CDN build.
  const urls = [...html.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => m[0]);
  assert.deepEqual(urls.filter((u) => !/^https:\/\/cdn\.jsdelivr\.net\/npm\/@tensorflow/.test(u)), []);
  assert.match(html, /tfjs@4\.22\.0/);
  assert.match(html, /coco-ssd@2\.2\.3/);
});

test('the page and the lib it needs are in the offline shell', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./demo/camera.html'"));
  assert.ok(sw.includes("'./src/lib/vision-occupancy.js'"));
  // Every in-page link must resolve, or the demo dead-ends mid-meeting.
  for (const m of html.matchAll(/href="(\.\.?\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, 'demo', m[1])), m[1] + ' is a dead link');
  }
});
