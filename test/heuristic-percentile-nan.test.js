'use strict';
const assert = require('node:assert');
const { strictEqual } = require('../src/lib/heuristic');
const { percentile } = require('../src/lib/heuristic');

// Test that percentile handles non-numeric percentile parameter gracefully
// without crashing, returning the lower bound (first element) as per contract.
assert.strictEqual(percentile([10, 20], NaN), 10);
assert.strictEqual(percentile([10, 20], 'not-a-number'), 10);
assert.strictEqual(percentile([5, 15, 25], Infinity), 5);
assert.strictEqual(percentile([5, 15, 25], -Infinity), 5);
