'use strict';
const assert = require('assert');
const { estimateSearchTrafficReduction } = require('./estimateSearchTrafficReduction.js');

// empty / non-array => null
assert.strictEqual(estimateSearchTrafficReduction([]), null);
assert.strictEqual(estimateSearchTrafficReduction(null), null);

// all rows have zero/missing totalSpaces => null
assert.strictEqual(
  estimateSearchTrafficReduction([{ zone: 'A', occupiedSpaces: 5, totalSpaces: 0 }]),
  null
);

// avg occupancy 0.5 vs baseline 0.85 => (1 - 0.5/0.85)*100 = 41.2%
const r1 = estimateSearchTrafficReduction([
  { zone: 'A', occupiedSpaces: 50, totalSpaces: 100 },
]);
assert.strictEqual(r1.estimatedReductionPercent, 41.2);
assert.strictEqual(r1.confidence, 0.03); // 1/30

// occupancy above baseline => clamped to 0
const r2 = estimateSearchTrafficReduction([
  { zone: 'A', occupiedSpaces: 95, totalSpaces: 100 },
]);
assert.strictEqual(r2.estimatedReductionPercent, 0);

// custom baseline + confidence caps at 1 for >=30 samples
const rows = Array.from({ length: 30 }, () => ({ occupiedSpaces: 40, totalSpaces: 100 }));
const r3 = estimateSearchTrafficReduction(rows, 0.8);
assert.strictEqual(r3.confidence, 1);
assert.strictEqual(r3.estimatedReductionPercent, 50); // (1 - 0.4/0.8)*100

// zero-totalSpaces rows skipped, valid ones still counted
const r4 = estimateSearchTrafficReduction([
  { occupiedSpaces: 5, totalSpaces: 0 },
  { occupiedSpaces: 50, totalSpaces: 100 },
]);
assert.strictEqual(r4.estimatedReductionPercent, 41.2);

console.log('estimateSearchTrafficReduction: all assertions passed');
