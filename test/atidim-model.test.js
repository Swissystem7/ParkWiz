// The Park Atidim lot model is shown live in a meeting, so it is asserted here
// rather than eyeballed: the same minute must always give the same frame, the
// counters must add up, and the geometry must stay inside the camera frame.
//
// This file covers src/lib/atidim.js only — the module has no DOM and no
// surface of its own, which is why it can be reviewed and landed on its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const AT = require('../src/lib/atidim');
const OCC = require('../src/lib/occupancy');

const SPOTS = AT.buildSpots();

test('the lot is a fixed grid of uniquely identified spots', () => {
  assert.equal(SPOTS.length, AT.LOT.rows * AT.LOT.perRow);
  assert.equal(new Set(SPOTS.map((s) => s.id)).size, SPOTS.length);
  for (const s of SPOTS) {
    assert.equal(s.quad.length, 4);
    for (const [x, y] of s.quad) {
      assert.ok(x >= 0 && x <= 1, `${s.id} x=${x} outside the frame`);
      assert.ok(y >= 0 && y <= 1, `${s.id} y=${y} outside the frame`);
      assert.ok(y >= AT.LOT.horizon, `${s.id} is drawn above the horizon`);
    }
  }
});

test('perspective keeps rows apart and widens them towards the camera', () => {
  for (let row = 0; row + 1 < AT.LOT.rows; row++) {
    const far = SPOTS.find((s) => s.row === row);
    const nearer = SPOTS.find((s) => s.row === row + 1);
    const bottomOfFar = far.quad[2][1];
    const topOfNearer = nearer.quad[0][1];
    assert.ok(bottomOfFar < topOfNearer, `row ${row} overlaps row ${row + 1}`);
    const width = (q) => q[1][0] - q[0][0];
    assert.ok(width(nearer.quad) > width(far.quad), 'rows farther from the camera must be narrower');
  }
});

test('spots in a row are side by side, never on top of each other', () => {
  const rowA = SPOTS.filter((s) => s.row === 0).sort((a, b) => a.col - b.col);
  for (let i = 0; i + 1 < rowA.length; i++) {
    const right = rowA[i].quad[1][0];
    const left = rowA[i + 1].quad[0][0];
    assert.ok(Math.abs(right - left) < 1e-9, 'adjacent spots must share an edge');
  }
});

test('the same minute always renders the same frame', () => {
  for (const m of [0, 7 * 60 + 15, 11 * 60, 23 * 60 + 59]) {
    const a = AT.snapshot(m, SPOTS);
    const b = AT.snapshot(m, SPOTS);
    assert.equal(a.occupied, b.occupied);
    assert.deepEqual([...a.occupiedIds].sort(), [...b.occupiedIds].sort());
  }
});

test('counters add up and the rate matches the counters', () => {
  for (let m = 0; m < AT.MINUTES_PER_DAY; m += 37) {
    const s = AT.snapshot(m, SPOTS);
    assert.equal(s.free + s.occupied, s.total);
    assert.ok(s.free >= 0 && s.occupied >= 0);
    assert.equal(s.occupiedIds.size, s.occupied);
    assert.ok(Math.abs(s.rate - s.occupied / s.total) < 1e-12);
  }
});

test('an empty lot is a zeroed snapshot instead of a divide by zero', () => {
  const s = AT.snapshot(11 * 60, []);
  assert.deepEqual(
    { total: s.total, occupied: s.occupied, free: s.free, rate: s.rate, size: s.occupiedIds.size },
    { total: 0, occupied: 0, free: 0, rate: 0, size: 0 },
  );
  assert.deepEqual(AT.fillOrder(undefined), []);
});

// The overlay must not flicker a car out of a spot while the lot is filling:
// the fill order is fixed, so a fuller frame is a superset of an emptier one.
test('filling the lot only adds cars, never moves them', () => {
  const quiet = AT.snapshot(4 * 60, SPOTS);
  const busy = AT.snapshot(11 * 60, SPOTS);
  assert.ok(busy.occupied > quiet.occupied, 'midday must be busier than 04:00');
  for (const id of quiet.occupiedIds) {
    assert.ok(busy.occupiedIds.has(id), `${id} emptied while the lot filled`);
  }
});

test('the daily profile reads like an office park, and never leaves [0,1]', () => {
  assert.equal(AT.HOURLY_PROFILE.length, 24);
  for (let m = 0; m < AT.MINUTES_PER_DAY; m++) {
    const r = AT.targetRate(m);
    assert.ok(r >= 0 && r <= 1, `rate ${r} at minute ${m}`);
  }
  assert.ok(AT.targetRate(3 * 60) < 0.15, 'the lot is empty at night');
  assert.ok(AT.targetRate(11 * 60) > 0.85, 'the lot is full at 11:00');
  assert.ok(AT.targetRate(21 * 60) < AT.targetRate(9 * 60), 'evening empties out');
});

test('minutes wrap instead of throwing, and the clock is zero padded', () => {
  assert.equal(AT.clampMinute(-1), AT.MINUTES_PER_DAY - 1);
  assert.equal(AT.clampMinute(AT.MINUTES_PER_DAY + 5), 5);
  assert.equal(AT.clockLabel(0), '00:00');
  assert.equal(AT.clockLabel(9 * 60 + 5), '09:05');
  assert.equal(AT.clockLabel(NaN), '00:00');
  assert.equal(AT.snapshot(AT.MINUTES_PER_DAY, SPOTS).clock, '00:00');
});

test('the hourly series feeds the shared occupancy renderer', () => {
  const recs = AT.hourlyRecords(SPOTS, '2026-10-13');
  assert.equal(recs.length, 24);
  assert.equal(OCC.parse(JSON.stringify(recs)).length, 24);
  const sum = OCC.summarize(recs);
  assert.equal(OCC.hourFromTs(sum.peak.ts), 11);
  assert.ok(OCC.occupancyRate(sum.peak) > OCC.occupancyRate(sum.low));
  assert.match(OCC.chartSvg(recs), /<svg class="chart"/);
  assert.match(OCC.hourHeatmapSvg(recs), /<svg class="chart heatmap"/);
  // No plate, no identity, no dwell time: a record is a count and nothing else.
  assert.deepEqual(Object.keys(recs[0]).sort(), ['confidence', 'occupied', 'source', 'street', 'total', 'ts']);
});

test('a bad or missing date falls back to the fixed demo day', () => {
  for (const bad of [undefined, '', 'yesterday', '13/10/2026']) {
    assert.equal(AT.hourlyRecords(SPOTS, bad)[0].ts, AT.DEMO_DAY + 'T00:00:00');
  }
  assert.equal(AT.hourlyRecords(SPOTS, '2026-01-02')[23].ts, '2026-01-02T23:00:00');
});
