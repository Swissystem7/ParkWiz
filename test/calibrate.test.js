const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cal = require('../src/lib/calibrate');

test('four wizard steps sum to the 3-minute target', () => {
  assert.equal(cal.STEPS.length, 4);
  assert.equal(cal.STEPS.reduce((s, st) => s + st.seconds, 0), cal.TARGET_SEC);
  assert.equal(cal.TARGET_SEC, 180);
});

test('a pack is ready only with spots and an empty reference', () => {
  const bare = cal.buildPack({ street: 'הרצל', spots: [] });
  assert.equal(cal.isReady(bare), false);
  const spotsOnly = cal.buildPack({
    street: 'הרצל',
    spots: [{ id: 's1', x: 0.1, y: 0.1, w: 0.1, h: 0.2 }],
  });
  assert.equal(cal.isReady(spotsOnly), false);
  const ready = cal.buildPack({
    street: 'הרצל',
    spots: [{ id: 's1', x: 0.1, y: 0.1, w: 0.1, h: 0.2, emptyRef: { mean: 120, variance: 10, n: 40 } }],
  });
  assert.equal(ready.kind, 'parkwiz-calibration');
  assert.equal(ready.heuristic, 'heuristic-occupancy');
  assert.equal(ready.hasEmpty, true);
  assert.equal(cal.isReady(ready), true);
});

test('clock helper and honesty note stay on the pack', () => {
  assert.equal(cal.formatClock(125000), '02:05');
  assert.equal(cal.underTarget(179000), true);
  assert.equal(cal.underTarget(181000), false);
  const p = cal.emptyPack('הרצל');
  assert.match(p.note, /heuristic/);
  assert.equal(cal.normalizePack(null), null);
});

test('calibration wizard is Hebrew RTL with a timer and honesty banner', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-calibrate.html'), 'utf8');
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /class="banner"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /ParkWizCalibrate/);
  assert.match(html, /id="timer"/);
  assert.match(html, /heuristic/);
  assert.doesNotMatch(html, /unpkg|cdnjs|googleapis/i);
});
