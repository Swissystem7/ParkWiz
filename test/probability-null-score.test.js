const test = require('node:test');
const assert = require('node:assert/strict');
const { displayedAvailabilityPct } = require('../src/lib/probability');

// Regression: Number(null) === 0, so a street whose model produced no score
// used to be displayed as a confident 0% (or 8% with one community report)
// instead of an unknown chance. A missing score must yield null, like NaN and
// undefined already do.

test('a null model score is unknown, not 0%', () => {
  assert.equal(displayedAvailabilityPct(null, 0), null);
  assert.equal(displayedAvailabilityPct(null, 1), null);
});

test('an empty or blank string score is unknown, not 0%', () => {
  assert.equal(displayedAvailabilityPct('', 0), null);
  assert.equal(displayedAvailabilityPct('   ', 1), null);
});

test('booleans, arrays and objects are not scores', () => {
  for (const bad of [true, false, [], [50], {}, () => 50]) {
    assert.equal(displayedAvailabilityPct(bad, 1), null, `expected ${String(bad)} to be rejected`);
  }
});

test('infinite scores are still rejected', () => {
  assert.equal(displayedAvailabilityPct(Infinity, 0), null);
  assert.equal(displayedAvailabilityPct(-Infinity, 0), null);
  assert.equal(displayedAvailabilityPct('Infinity', 0), null);
});

test('a numeric string score is still accepted and clamped', () => {
  assert.equal(displayedAvailabilityPct('62', 0), 62);
  assert.equal(displayedAvailabilityPct(' 50 ', 1), 58);
  assert.equal(displayedAvailabilityPct('140', 0), 100);
  assert.equal(displayedAvailabilityPct('abc', 0), null);
});

test('a genuine zero score is still 0%, not unknown', () => {
  assert.equal(displayedAvailabilityPct(0, 0), 0);
  assert.equal(displayedAvailabilityPct(0, 1), 8);
  assert.equal(displayedAvailabilityPct('0', 0), 0);
});

test('a missing community weight still means no lift', () => {
  assert.equal(displayedAvailabilityPct(62, null), 62);
  assert.equal(displayedAvailabilityPct(62, undefined), 62);
  assert.equal(displayedAvailabilityPct(62, 'two'), 62);
});
