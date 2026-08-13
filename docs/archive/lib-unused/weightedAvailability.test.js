'use strict';

const assert = require('node:assert');
const { weightedAvailability } = require('./weightedAvailability.js');

const now = 1_000_000_000_000;

// Empty / non-array -> 0
assert.strictEqual(weightedAvailability([], now), 0);
assert.strictEqual(weightedAvailability(null, now), 0);

// Report at now: weight 1
assert.strictEqual(weightedAvailability([{ ts: now, delta: 1 }], now), 1);
assert.strictEqual(weightedAvailability([{ ts: now, delta: -1 }], now), -1);

// Exactly 15 min old: weight 0.5
assert.strictEqual(
  weightedAvailability([{ ts: now - 900000, delta: 1 }], now),
  0.5
);

// Older than 2h: ignored
assert.strictEqual(
  weightedAvailability([{ ts: now - 7200001, delta: 1 }], now),
  0
);
// Exactly 2h old: still counted (boundary, not "older than")
assert.strictEqual(
  weightedAvailability([{ ts: now - 7200000, delta: 1 }], now),
  Math.pow(0.5, 8)
);

// Mixed: fresh +1, 15min -1, and an expired report that must not count
const mixed = [
  { ts: now, delta: 1 },
  { ts: now - 900000, delta: -1 },
  { ts: now - 8000000, delta: 1 }, // expired
];
assert.strictEqual(weightedAvailability(mixed, now), 1 - 0.5);

console.log('ok');
