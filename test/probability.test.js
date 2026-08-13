const test = require('node:test');
const assert = require('node:assert/strict');
const { displayedAvailabilityPct, clampPct, DEFAULT_PCT_PER_UNIT } = require('../src/lib/probability');
const { weightedAvailability, HALF_LIFE_MS } = require('../src/lib/availability');
const model = require('../availability-model.js');

test('a finite model score with no community signal is just the clamped score', () => {
  assert.equal(displayedAvailabilityPct(62, 0), 62);
  assert.equal(displayedAvailabilityPct(62, null), 62);
  assert.equal(displayedAvailabilityPct(-4, 0), 0);
  assert.equal(displayedAvailabilityPct(140, 0), 100);
});

test('community weight lifts the displayed chance by the documented unit', () => {
  assert.equal(DEFAULT_PCT_PER_UNIT, 8);
  assert.equal(displayedAvailabilityPct(50, 1), 58);
  assert.equal(displayedAvailabilityPct(50, 2, 8), 66);
  assert.equal(displayedAvailabilityPct(95, 2), 100);
});

test('non-finite model scores are rejected', () => {
  assert.equal(displayedAvailabilityPct(NaN, 1), null);
  assert.equal(displayedAvailabilityPct(undefined, 0), null);
});

test('decayed report weight feeds the displayed percent', () => {
  const now = 1_000_000_000_000;
  const fresh = weightedAvailability([{ ts: now, delta: 1 }], now);
  const half = weightedAvailability([{ ts: now - HALF_LIFE_MS, delta: 1 }], now);
  assert.equal(displayedAvailabilityPct(40, fresh), 48);
  assert.equal(displayedAvailabilityPct(40, half), 44);
});

test('availability model + community lift stays deterministic', () => {
  const input = {
    baseline: 70,
    streetIdx: 1,
    areaKey: 'netanya-center',
    reports: [],
    now: new Date('2026-07-14T18:00:00+03:00'),
  };
  const score = model.calculate(input).score;
  assert.equal(score, 50);
  assert.equal(displayedAvailabilityPct(score, 1), 58);
  assert.equal(clampPct(50.4), 50);
});
