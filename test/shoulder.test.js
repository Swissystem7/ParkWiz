const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SH = require('../src/lib/shoulder');
const model = require('../availability-model.js');
const { displayedAvailabilityPct } = require('../src/lib/probability');

// Every number pinned below was derived by hand from the three shoulder
// properties in the module header before the module was written:
//   shoulderOcc = max(0, (streetOcc - 0.6) / 0.4)
//   freeRun     = lengthM * (1 - shoulderOcc)
//   need        = vehicleLen + 0.4
//   pct         = ratio < 1 ? 0 : round(20 + 75 * min(1, (ratio - 1) / 2))
// Percentages are integers and pinned exactly; metres are binary floats and
// pinned to 1e-9, which is nine orders of magnitude tighter than a parking space.
function close(actual, expected, what) {
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) < 1e-9,
    `${what || 'value'}: expected ${expected}, got ${actual}`
  );
}

test('the shoulder stays empty while the marked bays still have room', () => {
  // Street occupancy at or under the spillover point: nobody has needed the
  // shoulder yet. avail 60% -> occupancy 0.40, avail 40% -> occupancy 0.60.
  assert.equal(SH.SPILLOVER_START, 0.6);
  assert.equal(SH.spilloverOccupancy(0), 0);
  assert.equal(SH.spilloverOccupancy(0.4), 0);
  assert.equal(SH.spilloverOccupancy(0.6), 0);
  close(SH.streetOccupancyFromAvailPct(60), 0.4, 'avail 60');
  close(SH.streetOccupancyFromAvailPct(40), 0.6, 'avail 40');
});

test('past the spillover point the shoulder fills linearly with the spill', () => {
  // (0.61 - 0.6) / 0.4 = 0.025 ; (0.8 - 0.6) / 0.4 = 0.5 ; (1 - 0.6) / 0.4 = 1
  close(SH.spilloverOccupancy(0.61), 0.025, 'spill 0.61');
  close(SH.spilloverOccupancy(0.8), 0.5, 'spill 0.8');
  close(SH.spilloverOccupancy(1), 1, 'spill 1');
  close(SH.spilloverOccupancy(1.4), 1, 'occupancy over 1 is clamped');
});

test('the free run is one contiguous length, because a shoulder fills from one end', () => {
  // avail 30% -> streetOcc 0.7 -> shoulderOcc 0.25 -> 12 m * 0.75 = 9 m
  close(SH.freeRunM(12, 30), 9, '12 m at avail 30');
  close(SH.freeRunM(30, 30), 22.5, '30 m at avail 30');
  close(SH.freeRunM(12, 60), 12, 'quiet street leaves the whole shoulder');
  close(SH.freeRunM(12, 0), 0, 'a jammed street fills the shoulder end to end');
});

test('the vehicle need is its length plus the same clearance the map already uses', () => {
  assert.equal(SH.MANOEUVRE_CLEARANCE_M, 0.4);
  close(SH.vehicleNeedM(4.5), 4.9, 'sedan');
  close(SH.vehicleNeedM(5.5), 5.9, 'van');
  close(SH.vehicleNeedM(4.5, 1), 5.5, 'the clearance is an override, not a constant');
});

test('hand-derived chances for the documented cases', () => {
  const pct = (shoulderLengthM, streetAvailPct, vehicleLenM) =>
    SH.shoulderAvailabilityPct({ shoulderLengthM, streetAvailPct, vehicleLenM });

  // A: 30 m, avail 60 -> run 30, need 4.9, ratio 6.122 -> t capped at 1 -> 95
  assert.equal(pct(30, 60, 4.5), 95);
  // B: 30 m, avail 30 -> run 22.5, ratio 4.592 -> t capped at 1 -> 95
  assert.equal(pct(30, 30, 4.5), 95);
  // C: 12 m, avail 30 -> run 9, ratio 1.8367 -> t 0.41837 -> 20 + 31.377 = 51.377
  assert.equal(pct(12, 30, 4.5), 51);
  // D: 12 m, avail 10 -> shoulderOcc 0.75 -> run 3, ratio 0.612 < 1 -> 0
  assert.equal(pct(12, 10, 4.5), 0);
  // E: same 9 m run, van (need 5.9) -> ratio 1.5254 -> t 0.26271 -> 39.70
  assert.equal(pct(12, 30, 5.5), 40);
  // K: run exactly one vehicle need -> the floor, not certainty
  assert.equal(pct(4.9, 100, 4.5), SH.MIN_FIT_PCT);
  assert.equal(SH.MIN_FIT_PCT, 20);
  // L: shoulder full end to end
  assert.equal(pct(30, 0, 4.5), 0);
});

test('the two shoulders on the demo map get their hand-derived chances', () => {
  // דן שומרון, 14 m beside a quiet street (avail 66): the street is only 34%
  // occupied, under the spillover point, so the shoulder is still clear -> run 14 m.
  // sedan ratio 2.857 -> t 0.9286 -> 89.64 ; van ratio 2.3729 -> t 0.68644 -> 71.48
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 14, streetAvailPct: 66, vehicleLenM: 4.5 }), 90);
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 14, streetAvailPct: 66, vehicleLenM: 5.5 }), 71);

  // בן גוריון, 18 m beside a busy street (avail 25): occupancy 0.75 is past the
  // spillover point, so shoulderOcc = 0.375 and the free run is 11.25 m. That one
  // run answers four different vehicles differently, which is the whole point of
  // measuring a shoulder in metres instead of in percent-free.
  const benGurion = (vehicleLenM) =>
    SH.shoulderAvailabilityPct({ shoulderLengthM: 18, streetAvailPct: 25, vehicleLenM });
  assert.deepEqual([3.8, 4.5, 4.9, 5.5].map(benGurion), [83, 69, 62, 54]);

  // Same street in the weekday evening: the availability model takes 25 down to 5,
  // the shoulder is 87.5% spilled into, and 2.25 m of run holds no car at all.
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 18, streetAvailPct: 5, vehicleLenM: 4.5 }), 0);
});

test('a longer vehicle never gets a better chance on the same shoulder', () => {
  // 12 m shoulder, avail 30 (9 m free): 3.8 -> 63, 4.5 -> 51, 4.9 -> 46, 5.5 -> 40
  const seen = [3.8, 4.5, 4.9, 5.5].map((vehicleLenM) =>
    SH.shoulderAvailabilityPct({ shoulderLengthM: 12, streetAvailPct: 30, vehicleLenM }));
  assert.deepEqual(seen, [63, 51, 46, 40]);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] <= seen[i - 1]);
});

test('the chance never rises as the street gets busier', () => {
  let prev = null;
  for (let avail = 100; avail >= 0; avail--) {
    const p = SH.shoulderAvailabilityPct({ shoulderLengthM: 12, streetAvailPct: avail, vehicleLenM: 4.5 });
    assert.ok(p !== null);
    if (prev !== null) assert.ok(p <= prev, `avail ${avail}: ${p} > ${prev}`);
    prev = p;
  }
  assert.equal(prev, 0);
});

test('the reported chance is never a promise of a space', () => {
  assert.equal(SH.MAX_FIT_PCT, 95);
  for (const len of [5, 14, 40, 400]) {
    const p = SH.shoulderAvailabilityPct({ shoulderLengthM: len, streetAvailPct: 100, vehicleLenM: 4.5 });
    assert.ok(p <= 95, `${len} m reported ${p}%`);
  }
});

test('missing or nonsense inputs return no estimate rather than a number', () => {
  assert.equal(SH.shoulderAvailabilityPct({ streetAvailPct: 60, vehicleLenM: 4.5 }), null);
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 14, vehicleLenM: 4.5 }), null);
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 14, streetAvailPct: 60 }), null);
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: -3, streetAvailPct: 60, vehicleLenM: 4.5 }), null);
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 14, streetAvailPct: 60, vehicleLenM: 0 }), null);
  assert.equal(SH.shoulderAvailabilityPct(), null);
  assert.equal(SH.spilloverOccupancy('x'), null);
  assert.equal(SH.freeRunM(NaN, 60), null);
});

test('free capacity is reported in whole vehicles', () => {
  // 9 m free, need 4.9 -> 1 car. 14 m free -> 2. 11.25 m free -> 2 sedans or 1 van.
  assert.equal(SH.vehicleLengthsFree({ shoulderLengthM: 12, streetAvailPct: 30, vehicleLenM: 4.5 }), 1);
  assert.equal(SH.vehicleLengthsFree({ shoulderLengthM: 14, streetAvailPct: 66, vehicleLenM: 4.5 }), 2);
  assert.equal(SH.vehicleLengthsFree({ shoulderLengthM: 18, streetAvailPct: 25, vehicleLenM: 4.5 }), 2);
  assert.equal(SH.vehicleLengthsFree({ shoulderLengthM: 18, streetAvailPct: 25, vehicleLenM: 5.5 }), 1);
  assert.equal(SH.vehicleLengthsFree({ shoulderLengthM: 12, streetAvailPct: 10, vehicleLenM: 4.5 }), 0);
});

test('isShoulder only recognises the shoulder surface', () => {
  assert.equal(SH.SURFACE, 'shoulder');
  assert.ok(SH.isShoulder('shoulder'));
  for (const t of ['blue', 'free', 'timed', 'red', 'reserved', undefined, null, '']) {
    assert.equal(SH.isShoulder(t), false, `${t} must not count as a shoulder`);
  }
});

// The point of the whole type: if a shoulder and a marked bay with the same
// inputs answered the same, 'shoulder' would be decoration on a bay.
test('a shoulder and a marked bay with identical inputs give different answers', () => {
  // Tuesday 13:00 Asia/Jerusalem: no time rule fires, so the bay score is the
  // baseline itself, and with no community reports the displayed bay chance is
  // that score. The same street availability feeds the shoulder rule.
  const now = new Date('2026-07-14T13:00:00+03:00');
  const bayPct = (baseline) => displayedAvailabilityPct(
    model.calculate({ baseline, streetIdx: 1, areaKey: 'netanya-center', reports: [], now }).score, 0);

  assert.equal(bayPct(60), 60);
  const longShoulder = SH.shoulderAvailabilityPct({ shoulderLengthM: 30, streetAvailPct: 60, vehicleLenM: 4.5 });
  assert.equal(longShoulder, 95);
  assert.notEqual(longShoulder, bayPct(60));

  assert.equal(bayPct(30), 30);
  const shortShoulder = SH.shoulderAvailabilityPct({ shoulderLengthM: 12, streetAvailPct: 30, vehicleLenM: 4.5 });
  assert.equal(shortShoulder, 51);
  assert.notEqual(shortShoulder, bayPct(30));

  // And the difference is not a constant offset: the bay rule cannot see the
  // vehicle or the shoulder length at all, while the shoulder rule turns on
  // both. Same 30% street, same sedan, two shoulder lengths, two answers.
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 4, streetAvailPct: 30, vehicleLenM: 4.5 }), 0);
  assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 60, streetAvailPct: 30, vehicleLenM: 4.5 }), 95);
});

test('the shoulder module is deterministic: no randomness, no clock, no network', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'shoulder.js'), 'utf8');
  const code = src.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  for (const banned of ['Math.random', 'Date.now', 'new Date', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!code.includes(banned), `${banned} does not belong in shoulder.js`);
  }
  const first = SH.shoulderAvailabilityPct({ shoulderLengthM: 14, streetAvailPct: 66, vehicleLenM: 4.5 });
  for (let i = 0; i < 50; i++) {
    assert.equal(SH.shoulderAvailabilityPct({ shoulderLengthM: 14, streetAvailPct: 66, vehicleLenM: 4.5 }), first);
  }
});
