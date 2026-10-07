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

test('underTarget never reports an untimed or invalid elapsed as under target', () => {
  assert.equal(cal.underTarget(null), false);
  assert.equal(cal.underTarget(undefined), false);
  assert.equal(cal.underTarget(''), false);
  assert.equal(cal.underTarget('abc'), false);
  assert.equal(cal.underTarget(-1), false);
  assert.equal(cal.underTarget(0), true);
  assert.equal(cal.underTarget(180000), true);
});

test('calibration wizard does not claim a save time when the clock never started', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-calibrate.html'), 'utf8');
  assert.match(html, /if \(!state\.startedAt\) \{\s*note\.textContent = "כיול נשמר \(השעון לא הופעל/);
});

test('formatClock returns null for non-numeric input', () => {
  assert.strictEqual(cal.formatClock('invalid'), null);
});

test('underTarget is false when there is no elapsed time to judge', () => {
  for (const bad of [null, undefined, '', 'soon', NaN, Infinity]) {
    assert.equal(cal.underTarget(bad), false, `underTarget(${String(bad)})`);
  }
  assert.equal(cal.underTarget(0), true);
  assert.equal(cal.underTarget('179000'), true);
});

test('an imported reference keeps a median of zero instead of swapping in the mean', () => {
  const spot = cal.normalizeSpot({ x: 0.1, y: 0.1, w: 0.2, h: 0.2, emptyRef: { mean: 3, median: 0, variance: 4 } }, 0);
  assert.equal(spot.emptyRef.median, 0);
  assert.equal(spot.emptyRef.mean, 3);
});

test('imported reference stats are never negative or non-finite', () => {
  const spot = cal.normalizeSpot({
    x: 0.1, y: 0.1, w: 0.2, h: 0.2,
    emptyRef: { mean: 120, median: 'x', variance: -9, mad: Infinity, n: -2.5, p10: 100, p90: 140 },
    nightRef: { mean: 30, median: 28, variance: '', mad: 2, n: 12.7, p10: 'nope', p90: 40 },
  }, 0);
  assert.deepEqual(spot.emptyRef, {
    mean: 120, variance: 0, n: 0, median: 120, mad: 0, p10: 100, p90: 140, lighting: '',
  });
  // A half-missing percentile pair collapses to the median rather than
  // reporting a 0..40 range built from the one value that was present.
  assert.deepEqual(spot.nightRef, {
    mean: 30, variance: 0, n: 12, median: 28, mad: 2, p10: 28, p90: 28, lighting: '',
  });
});

test('a swapped percentile pair is reordered so p10 <= p90', () => {
  const spot = cal.normalizeSpot({ x: 0, y: 0, w: 1, h: 1, emptyRef: { mean: 50, p10: 90, p90: 10 } }, 0);
  assert.equal(spot.emptyRef.p10, 10);
  assert.equal(spot.emptyRef.p90, 90);
});

test('buildPack stores savedAt as a string even when given a number', () => {
  const pack = cal.buildPack({ street: 'הרצל', savedAt: 1700000000000, spots: [] });
  assert.equal(pack.savedAt, '1700000000000');
  const fresh = cal.buildPack({ street: 'הרצל', savedAt: '', spots: [] });
  assert.match(fresh.savedAt, /^\d{4}-\d{2}-\d{2}T/);
});
