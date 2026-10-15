// The demo half of src/lib/atidim-lot.js: the 18-bay synthetic lot that the
// Atidim operator page renders, plus the opt-in hour marker on the shared
// occupancy chart. Pure model — no DOM, no page, no camera.
const test = require('node:test');
const assert = require('node:assert/strict');

const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');

test('demo lot uses 18 bays and peaks in business hours', () => {
  assert.equal(lot.totalBays(lot.DEFAULT), 18);
  const morning = lot.stateAt(10, lot.DEFAULT);
  const night = lot.stateAt(3, lot.DEFAULT);
  assert.ok(morning.occupied > night.occupied);
  assert.equal(morning.free + morning.occupied, 18);
  assert.ok(morning.pct > 0.5 && morning.pct < 1);
  const bays = lot.bayStates(morning.occupied, morning.total);
  assert.equal(bays.length, 18);
  assert.equal(bays.filter(Boolean).length, morning.occupied);
});

test('a malformed lot is empty, not NaN bays', () => {
  for (const bad of [{}, { cols: 0, rows: 3 }, { cols: 6, rows: -1 }, { cols: 'x', rows: 3 }]) {
    assert.equal(lot.totalBays(bad), 0, JSON.stringify(bad));
    assert.equal(lot.stateAt(10, bad).occupied, 0);
    assert.equal(lot.stateAt(10, bad).pct, 0);
  }
  // Hours outside the day contribute nothing rather than a negative count.
  for (const bad of [-1, 24, NaN, 'noon']) {
    assert.equal(lot.baselineRateForHour(bad), 0, String(bad));
  }
  assert.equal(lot.occupiedAtRate(18, 5), 18, 'rate is clamped to 0..1');
  assert.equal(lot.occupiedAtRate(18, -2), 0);
});

test('hourly series feeds the shared occupancy chart (24 hours)', () => {
  const series = lot.hourlySeries(lot.DEFAULT);
  assert.equal(series.length, 24);
  const svg = occ.chartSvg(series, { width: 400, height: 120 });
  assert.match(svg, /class="chart"/);
  assert.ok(occ.byHour(series).some((b) => b.count === 1 && b.avg != null));
});

test('bay layout is a stable scatter that only grows as the lot fills', () => {
  const total = lot.totalBays(lot.DEFAULT);
  const at = (k) => lot.bayLayout(k, total);
  assert.deepEqual(at(7), at(7), 'same inputs, same lot — screenshots stay reproducible');
  assert.equal(at(7).filter(Boolean).length, 7);
  assert.equal(at(0).filter(Boolean).length, 0);
  assert.equal(at(total).filter(Boolean).length, total);
  // Not a solid block from bay 1 — that reads as obviously fake on screen.
  assert.notDeepEqual(at(7), lot.bayStates(7, total));
  // Monotone, so scrubbing the hour makes cars arrive instead of teleport.
  for (let k = 1; k < total; k++) {
    const prev = at(k - 1);
    const next = at(k);
    prev.forEach((occupied, i) => {
      if (occupied) assert.equal(next[i], true, `bay ${i} emptied between ${k - 1} and ${k}`);
    });
  }
  assert.deepEqual(lot.bayLayout(5, 0), []);
  assert.deepEqual(lot.bayLayout(NaN, 4), [false, false, false, false]);
});

test('snapshotAt renders any hour; liveSnapshot is that hour from the clock', () => {
  const quiet = lot.snapshotAt(3, lot.DEFAULT);
  const busy = lot.snapshotAt(10, lot.DEFAULT);
  assert.ok(busy.occupied > quiet.occupied);
  for (const snap of [quiet, busy]) {
    assert.equal(snap.bays.length, 18);
    assert.equal(snap.bays.filter(Boolean).length, snap.occupied);
    assert.equal(snap.free + snap.occupied, snap.total);
    assert.equal(snap.cols * snap.rows, 18);
    assert.match(snap.site, /עתידים/);
  }
  // 2026-10-19 07:30Z is 10:30 in Jerusalem.
  const live = lot.liveSnapshot(new Date('2026-10-19T07:30:00Z'), lot.DEFAULT);
  assert.deepEqual(live, lot.snapshotAt(10, lot.DEFAULT));
  // An unusable clock falls back to hour 0 instead of throwing mid-render.
  assert.equal(lot.localHour(new Date('nope'), 'Asia/Jerusalem'), 0);
});

test('chart marker calls out one hour and is opt-in', () => {
  const series = lot.hourlySeries(lot.DEFAULT);
  const plain = occ.chartSvg(series, { width: 400, height: 120 });
  assert.doesNotMatch(plain, /stroke-dasharray/, 'no marker unless asked for');
  const marked = occ.chartSvg(series, { width: 400, height: 120, markIndex: 10 });
  assert.match(marked, /stroke-dasharray="4 4"/);
  assert.match(marked, /<circle/);
  // Out-of-range or missing index must not draw a stray marker.
  for (const bad of [-1, 24, 1.5, null, undefined, 'x']) {
    assert.doesNotMatch(occ.chartSvg(series, { markIndex: bad }), /stroke-dasharray/, String(bad));
  }
});

test('the operator model is untouched by the demo model', () => {
  assert.equal(lot.ATIDIM_LOT.totalCapacity, 220);
  assert.equal(lot.getHourlyCurve().length, 24);
  assert.notEqual(lot.totalBays(lot.DEFAULT), lot.ATIDIM_LOT.totalCapacity);
});
