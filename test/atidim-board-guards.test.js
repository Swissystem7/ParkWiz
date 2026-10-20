// Input guards on the 18-bay board model in src/lib/atidim-lot.js. The page
// merges demo/atidim-data.json over lot.DEFAULT, so a hand-edited config with
// a missing or bad size must render an empty lot, not NaN bays. Carried over
// from PR #149, the only part of it not already on master (docs/dev/PR-149-SPLIT.md).
const test = require('node:test');
const assert = require('node:assert/strict');

const lot = require('../src/lib/atidim-lot');

test('a malformed lot is empty, not NaN bays', () => {
  for (const bad of [{}, { cols: 0, rows: 3 }, { cols: 6, rows: -1 }, { cols: 'x', rows: 3 }]) {
    assert.equal(lot.totalBays(bad), 0, JSON.stringify(bad));
    assert.equal(lot.stateAt(10, bad).occupied, 0);
    assert.equal(lot.stateAt(10, bad).pct, 0);
    assert.deepEqual(lot.snapshotAt(10, bad).bays, []);
  }
  // Hours outside the day contribute nothing rather than a negative count.
  for (const bad of [-1, 24, NaN, 'noon']) {
    assert.equal(lot.baselineRateForHour(bad), 0, String(bad));
  }
  assert.equal(lot.occupiedAtRate(18, 5), 18, 'rate is clamped to 0..1');
  assert.equal(lot.occupiedAtRate(18, -2), 0);
  assert.equal(lot.occupiedAtRate(0, 0.5), 0);
});

test('the board model is separate from the camera model', () => {
  assert.equal(lot.ATIDIM_LOT.totalCapacity, 220);
  assert.equal(lot.getHourlyCurve().length, 24);
  assert.equal(lot.totalBays(lot.DEFAULT), 18);
  assert.notEqual(lot.totalBays(lot.DEFAULT), lot.ATIDIM_LOT.totalCapacity);
});
