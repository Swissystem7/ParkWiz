const test = require('node:test');
const assert = require('node:assert/strict');
const { displayedAvailabilityPct } = require('../src/lib/probability');

test('a missing model score is rejected, not shown as a 0% chance', () => {
  for (const blank of [null, '', '   ', false, true, [], {}]) {
    assert.equal(displayedAvailabilityPct(blank, 0), null, JSON.stringify(blank));
    assert.equal(displayedAvailabilityPct(blank, 1), null, JSON.stringify(blank));
  }
});

test('numeric strings still count as scores', () => {
  assert.equal(displayedAvailabilityPct('62', 0), 62);
  assert.equal(displayedAvailabilityPct(' 50 ', '1'), 58);
});

test('a blank per-unit falls back to the default instead of disabling the lift', () => {
  assert.equal(displayedAvailabilityPct(50, 1, null), 58);
  assert.equal(displayedAvailabilityPct(50, 1, ''), 58);
  assert.equal(displayedAvailabilityPct(50, 1, 0), 50);
});

test('a non-numeric community weight adds no lift', () => {
  assert.equal(displayedAvailabilityPct(50, true), 50);
  assert.equal(displayedAvailabilityPct(50, '', 8), 50);
});
