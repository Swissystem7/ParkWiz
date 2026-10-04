'use strict';
const assert = require('node:assert');
const { summarizePairs } = require('../src/lib/compare');

// Test that the perfect count reflects rounded accuracy values
// The feature improves rounding accuracy so that 0.99999 is treated as perfect (1.0)
// This test must fail on the current implementation because it doesn't round properly
const pairs = [
  { accuracy: 0.99999, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99998, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99997, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99996, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99995, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99994, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99993, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99992, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99991, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99990, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99989, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99988, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99987, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99986, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99985, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99984, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99983, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99982, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99981, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99980, systemOccupied: 1, manualOccupied: 1 },
];

const result = summarizePairs(pairs);

// The current implementation does not round the accuracy values before checking
// for perfect matches (accuracy === 1), so this assertion will fail until rounding is implemented
assert.strictEqual(result.perfect, 1, 'Should count 0.99999 as a perfect match after rounding');

// Additional test to verify that the feature works correctly with multiple pairs
const pairsWithPerfect = [
  { accuracy: 0.99999, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 0.99998, systemOccupied: 1, manualOccupied: 1 },
  { accuracy: 1.0, systemOccupied: 1, manualOccupied: 1 },
];

const resultWithPerfect = summarizePairs(pairsWithPerfect);
assert.strictEqual(resultWithPerfect.perfect, 2, 'Should count both 0.99999 and 1.0 as perfect matches after rounding');
