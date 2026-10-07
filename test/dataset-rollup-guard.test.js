// rollup sums only scene reports that carry a real pair of counts.
//
// Before this guard a null entry in the list threw, one report with a missing
// count turned the whole total (and every lighting bucket) into NaN, and
// numeric strings were concatenated, so the "spot comparisons" KPI on
// pilot-eval.html could read "012". evaluate/compareMethods also threw on a
// non-array scene list, and the delta KPI printed "+0.0" when there was
// nothing to compare, because null >= 0 is true in JavaScript.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ds = require('../src/lib/dataset');
const occ = require('../src/lib/occupancy');

const good = { id: 'a', lighting: 'day', n: 12, agree: 10 };
const full = { id: 'b', lighting: 'night', n: 12, agree: 12 };

test('a null or non-object entry is skipped instead of throwing', () => {
  const r = ds.rollup([good, null, undefined, 7, 'scene', [12, 12], full]);
  assert.equal(r.n, 24);
  assert.equal(r.agree, 22);
  assert.equal(r.skipped, 5);
  assert.equal(r.rate, 22 / 24);
});

test('a report with a missing count does not poison the total with NaN', () => {
  const r = ds.rollup([{ lighting: 'day' }, { n: 12 }, { agree: 3 }, full]);
  assert.equal(r.n, 12);
  assert.equal(r.agree, 12);
  assert.equal(r.skipped, 3);
  assert.equal(r.rate, 1);
  assert.deepEqual(r.byLighting, { night: { n: 12, agree: 12, rate: 1 } });
});

test('numeric strings are counted as numbers, not concatenated', () => {
  const r = ds.rollup([{ lighting: 'day', n: '12', agree: '3' }]);
  assert.equal(r.n, 12);
  assert.equal(r.agree, 3);
  assert.equal(r.rate, 0.25);
  assert.equal(r.byLighting.day.n, 12);
});

test('blank strings, booleans, negatives, fractions and agree > n are not counts', () => {
  const bad = [
    { n: '', agree: 0 },
    { n: 12, agree: ' ' },
    { n: true, agree: 1 },
    { n: 12, agree: false },
    { n: -12, agree: 0 },
    { n: 12, agree: 2.5 },
    { n: 12, agree: 13 },
    { n: Infinity, agree: 1 },
    { n: NaN, agree: 1 },
  ];
  const r = ds.rollup(bad);
  assert.equal(r.n, 0);
  assert.equal(r.agree, 0);
  assert.equal(r.skipped, bad.length);
  assert.equal(r.rate, null);
  assert.equal(r.wilson, null);
  assert.deepEqual(r.byLighting, {});
});

test('an explicit zero agreement is still a real count', () => {
  const r = ds.rollup([{ lighting: 'day', n: 12, agree: 0 }]);
  assert.equal(r.n, 12);
  assert.equal(r.agree, 0);
  assert.equal(r.rate, 0);
  assert.equal(r.skipped, 0);
});

test('a non-string lighting falls back to the day bucket', () => {
  const r = ds.rollup([{ n: 12, agree: 6, lighting: 3 }, { n: 12, agree: 6, lighting: '' }]);
  assert.deepEqual(Object.keys(r.byLighting), ['day']);
  assert.equal(r.byLighting.day.n, 24);
});

test('well-formed reports roll up exactly as before, plus skipped = 0', () => {
  const reports = ds.scenes().map((s) => ds.evaluateScene(s, 'v2'));
  const r = ds.rollup(reports);
  const n = reports.reduce((sum, s) => sum + s.n, 0);
  const agree = reports.reduce((sum, s) => sum + s.agree, 0);
  assert.equal(r.n, n);
  assert.equal(r.agree, agree);
  assert.equal(r.skipped, 0);
  assert.equal(r.rate, agree / n);
  assert.ok(r.wilson && r.wilson.n === n);
});

test('a non-array scene list means the full set, it does not throw', () => {
  const all = ds.evaluate('v2');
  assert.equal(ds.evaluate('v2', 'x').n, all.n);
  assert.equal(ds.evaluate('v2', {}).n, all.n);
  assert.equal(ds.evaluate('v2', null).n, all.n);
  assert.equal(ds.compareMethods({}).v2.n, all.n);
  assert.equal(ds.compareMethods('x').legacy.n, ds.evaluate('legacy').n);
});

test('an empty scene list yields zero comparisons and a null delta', () => {
  const cmp = ds.compareMethods([]);
  assert.equal(cmp.v2.n, 0);
  assert.equal(cmp.v2.rate, null);
  assert.equal(cmp.v2.wilson, null);
  assert.equal(cmp.improved, null);
});

// --- pilot-eval.html renders the rollup; drive its script with a fake DOM ---

function fakeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    textContent: '',
    innerHTML: '',
    className: '',
    children: [],
    listeners: {},
    replaceChildren() { el.children = []; },
    appendChild(child) { el.children.push(child); return child; },
    addEventListener(type, fn) { el.listeners[type] = fn; },
  };
  return el;
}

// Inline script blocks, located with indexOf rather than a regexp: CodeQL reads
// any script-tag regexp as an HTML sanitiser and flags it (js/bad-tag-filter).
function scriptBlocks(html) {
  const open = '<script>';
  const close = '</script>';
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = html.indexOf(open, from);
    if (start === -1) break;
    const end = html.indexOf(close, start + open.length);
    if (end === -1) break;
    blocks.push(html.slice(start + open.length, end));
    from = end + close.length;
  }
  return blocks;
}

function runEvalPage(dataset) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-eval.html'), 'utf8');
  const blocks = scriptBlocks(html);
  assert.ok(blocks.length >= 1, 'pilot-eval.html has an inline script');
  const byId = {};
  const document = {
    getElementById(id) {
      if (!byId[id]) byId[id] = fakeElement('div');
      return byId[id];
    },
    createElement(tag) { return fakeElement(tag); },
  };
  const window = { ParkWizDataset: dataset, ParkWizOccupancy: occ, print() {} };
  const ctx = vm.createContext({ window, document, console, JSON, String, Object, Number, Math, Array });
  blocks.forEach((code) => vm.runInContext(code, ctx, { filename: 'pilot-eval.html' }));
  return byId;
}

test('the eval page shows the real comparison count and a signed delta', () => {
  const ids = runEvalPage(ds);
  const cmp = ds.compareMethods();
  assert.equal(ids.kN.textContent, String(cmp.v2.n));
  assert.match(ids.kN.textContent, /^\d+$/, 'spot comparisons is a plain integer, never "012"');
  assert.match(ids.kDelta.textContent, /^[+-]\d+\.\d$/);
  assert.equal(ids.kDelta.textContent, '+' + (cmp.improved * 100).toFixed(1));
  assert.equal(ids.sceneBody.children.length, cmp.v2.scenes.length);
  assert.ok(ids.wilsonNote.textContent.includes('Wilson'));
  assert.equal(typeof ids.btnRun.listeners.click, 'function');
});

test('with nothing to compare the delta KPI is a dash, not +0.0', () => {
  const empty = { compareMethods: () => ds.compareMethods([]) };
  const ids = runEvalPage(empty);
  assert.equal(ids.kDelta.textContent, '—');
  assert.equal(ids.kN.textContent, '0');
  assert.equal(ids.kV2.textContent, '—');
  assert.equal(ids.wilsonNote.textContent, '');
  assert.equal(ids.sceneBody.children.length, 0);
});
