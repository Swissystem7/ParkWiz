// The Park Atidim operator demo is shown live in a CityZone meeting. The page
// markup itself is asserted by test/atidim-demo-page.test.js (the page on
// master, #154/#155); this file covers the pieces #137 added around it: the
// lot model rendering through the shared chart, the offline shell entries and
// the operator-editable labels file.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');

const data = JSON.parse(fs.readFileSync(path.join(root, 'demo', 'atidim-data.json'), 'utf8'));
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the lot model renders through the shared occupancy chart', () => {
  const records = lot.getHourlyCurve(lot.ATIDIM_LOT.totalCapacity).map((p) => ({
    ts: '2026-10-18T' + String(p.hour).padStart(2, '0') + ':00:00',
    total: lot.ATIDIM_LOT.totalCapacity,
    occupied: p.occupied,
  }));
  assert.equal(records.length, 24);
  const svg = occ.chartSvg(records, { width: 760, height: 220 });
  assert.match(svg, /class="chart"/);
  const buckets = occ.byHour(records);
  assert.equal(buckets.filter((b) => b.count === 1).length, 24);
  // Mid-morning must read busier than the small hours, or the screen lies.
  assert.ok(buckets[10].avg > buckets[3].avg);
});

// test/sw-precache.test.js only walks the repo root, so a page under demo/ is
// invisible to it. Until that walk covers subdirectories, this page asserts its
// own shell entries — src/lib/atidim-lot.js had no entry at all before now.
test('the operator shell is precached so the first offline visit works', () => {
  const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  const assets = [...block.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
  for (const rel of ['./demo/atidim.html', './demo/atidim-data.json', './src/lib/atidim-lot.js',
    './src/lib/occupancy.js', './pilot/shell.css', './pilot/print.css']) {
    assert.ok(assets.includes(rel), rel + ' is loaded by the page but not precached');
    assert.ok(fs.existsSync(path.join(root, rel.replace(/^\.\//, ''))), rel);
  }
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 11, 'new shell assets need a cache bump');
});

test('operator-editable labels describe the same lot as the model', () => {
  assert.equal(data.source, 'synthetic');
  assert.match(data.meetingNote, /לא מצלמה חיה/);
  assert.equal(data.operator, lot.ATIDIM_LOT.operator);
  assert.equal(data.site, lot.ATIDIM_LOT.name);
});
