// The Park Atidim operator page is shown live in a CityZone meeting, so its
// claims are asserted here: Hebrew RTL, a "not a live camera" banner, no CDN,
// no plate/video promise, and counts read from the lot model in the repo
// rather than a second copy of the curve inlined in the page.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');

const html = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'demo', 'atidim-data.json'), 'utf8'));
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('operator page is Hebrew RTL with a skip link and a demo banner', () => {
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /class="banner"/);
  assert.match(html, /דמו, לא מצלמה חיה/);
  assert.doesNotMatch(html, /unpkg|cdnjs|googleapis/i);
});

test('operator page states the privacy limits the pitch promises', () => {
  assert.match(html, /אין זיהוי לוחיות רישוי/);
  assert.match(html, /No LPR/);
  assert.match(html, /לא נשמר וידאו/);
  assert.match(html, /עיבוד בקצה המצלמה/);
  // No fine/revenue promise here; the "not enforcement" disclaimer stays allowed.
  assert.doesNotMatch(html, /קנס|הכנסות|גביית|דוחות חניה/);
});

test('counts and curve come from src/lib/atidim-lot.js, not inlined numbers', () => {
  assert.match(html, /src="\.\.\/src\/lib\/atidim-lot\.js"/);
  assert.match(html, /src="\.\.\/src\/lib\/occupancy\.js"/);
  assert.match(html, /LOT\.createDefaultCameraSpots\(\)/);
  assert.match(html, /LOT\.calculateOccupancy\(spots, CAP\)/);
  assert.match(html, /LOT\.getHourlyCurve\(CAP\)/);
  assert.match(html, /LOT\.transitionSpot\(spots, "arrive"\)/);
  assert.match(html, /LOT\.validatePrivacyCompliance\(/);
  assert.match(html, /OCC\.chartSvg\(/);
  // The 220-capacity constant must not be hardcoded next to the model.
  assert.doesNotMatch(html, /totalCapacity\s*[:=]\s*\d/);
});

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

test('the KPI ids the page script writes to all exist in the markup', () => {
  for (const id of ['kFree', 'kOcc', 'kPct', 'kStatus', 'siteTitle', 'siteSub',
    'spotCanvas', 'hourlyChart', 'zoneRows', 'privacyCheck', 'viewNote', 'banner']) {
    assert.match(html, new RegExp('id="' + id + '"'), id + ' is written but not declared');
  }
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
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 10, 'new shell assets need a cache bump');
});

test('operator-editable labels are a fallback, not the source of the counts', () => {
  assert.match(html, /fetch\("\.\/atidim-data\.json"\)/);
  assert.equal(data.source, 'synthetic');
  assert.match(data.meetingNote, /לא מצלמה חיה/);
  assert.equal(data.operator, lot.ATIDIM_LOT.operator);
  assert.equal(data.site, lot.ATIDIM_LOT.name);
  // A missing file must leave the model's own metadata on screen.
  assert.match(html, /r\.ok \? r\.json\(\) : null/);
});
