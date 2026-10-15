// The board model behind the operator board: an 18-bay synthetic lot with a
// day-long curve, kept separate from the 220-space camera model that
// demo/atidim.html draws (see test/atidim-lot-camera-views.test.js).
// Model only — the page that renders it is a later slice (see
// docs/dev/PR-179-SPLIT.md).
const test = require('node:test');
const assert = require('node:assert/strict');

const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');

test('Atidim board lot uses 18 bays and peaks in business hours', () => {
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
});
