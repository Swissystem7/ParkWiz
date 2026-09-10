// Backlog item 4: chanceRange(avail, streetIdx) -> {min, max} over
// HOURLY_SLOTS for one street.
//
// The literal patterns pinned below were computed in a python3 scratch script
// from the formula written in src/lib/predict.js - base = avail / 100, plus
// the fixed rush weight, plus stableVar, clamped into [MIN_CHANCE, 1] and
// rounded to three decimals - before chanceRange existed. python3's math.sin
// and V8's Math.sin agree bit-for-bit on these inputs, which was checked
// separately; the three-decimal rounding leaves no room for a last-bit
// disagreement in any case.
//
// No clock, no randomness, no network: the same street and availability give
// the same range on every machine, forever. That is PW-005.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  genHourlyPattern,
  chanceRange,
  HOURLY_SLOTS,
  MIN_CHANCE,
} = require('../src/lib/predict');

// avail, streetIdx, the seven slot values, min, max
const CASES = [
  [70, 2, [0.41, 0.747, 0.654, 0.616, 0.717, 0.418, 0.38], 0.38, 0.747],
  [60, 0, [0.421, 0.641, 0.444, 0.481, 0.578, 0.343, 0.293], 0.293, 0.641],
  [40, 3, [0.078, 0.366, 0.237, 0.296, 0.373, 0.159, 0.192], 0.078, 0.373],
  [100, 5, [0.763, 1, 0.844, 0.889, 1, 0.698, 0.693], 0.693, 1],
  [0, 7, [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05], 0.05, 0.05],
];

test('the hand-computed patterns are what genHourlyPattern actually produces', () => {
  // If this goes red the demo constants moved and every number below is stale.
  for (const [avail, street, pattern] of CASES) {
    assert.deepEqual(genHourlyPattern(avail, street), pattern, `avail ${avail}, street ${street}`);
  }
});

test('chanceRange returns the hand-computed min and max', () => {
  for (const [avail, street, , min, max] of CASES) {
    assert.deepEqual(chanceRange(avail, street), { min, max }, `avail ${avail}, street ${street}`);
  }
});

test('min and max are two of the values genHourlyPattern returned, never new ones', () => {
  for (let street = 0; street < 25; street++) {
    for (const avail of [0, 5, 33, 50, 70, 87, 100]) {
      const pattern = genHourlyPattern(avail, street);
      const range = chanceRange(avail, street);
      assert.ok(pattern.includes(range.min), `min ${range.min} is not in the pattern`);
      assert.ok(pattern.includes(range.max), `max ${range.max} is not in the pattern`);
      assert.equal(range.min, Math.min(...pattern));
      assert.equal(range.max, Math.max(...pattern));
      assert.ok(range.min <= range.max);
    }
  }
});

test('chanceRange does not change genHourlyPattern', () => {
  const before = genHourlyPattern(70, 2);
  chanceRange(70, 2);
  chanceRange(0, 2);
  chanceRange(100, 2);
  assert.deepEqual(genHourlyPattern(70, 2), before);
  // and the slot list it reads is still the frozen one
  assert.deepEqual(HOURLY_SLOTS, [8, 10, 12, 14, 16, 18, 20]);
  assert.equal(Object.isFrozen(HOURLY_SLOTS), true);
});

test('the range obeys the same floor and ceiling as a single chance', () => {
  for (let street = 0; street < 25; street++) {
    for (const avail of [0, 1, 40, 99, 100]) {
      const { min, max } = chanceRange(avail, street);
      assert.ok(min >= MIN_CHANCE, `min ${min} below the floor`);
      assert.ok(max <= 1, `max ${max} above 1`);
    }
  }
});

test('an empty street collapses to a single point at the floor', () => {
  assert.deepEqual(chanceRange(0, 7), { min: MIN_CHANCE, max: MIN_CHANCE });
});

test('the same call always gives the same range', () => {
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(chanceRange(70, 2), { min: 0.38, max: 0.747 });
  }
});

test('a busier street never widens downward past a quieter one', () => {
  // genHourlyPattern is monotone in avail, so both ends of the range are too.
  for (let street = 0; street < 15; street++) {
    const low = chanceRange(40, street);
    const high = chanceRange(80, street);
    assert.ok(high.min >= low.min, `street ${street} min`);
    assert.ok(high.max >= low.max, `street ${street} max`);
  }
});
