const assert = require('assert');
const { occupancyRate } = require('../src/lib/occupancy.js');

// Test that occupancyRate returns 0 when the input object is missing the total property
assert.strictEqual(occupancyRate({ occupied: 5 }), 0);
assert.strictEqual(occupancyRate({}), 0);
assert.strictEqual(occupancyRate(null), 0);
assert.strictEqual(occupancyRate(undefined), 0);
assert.strictEqual(occupancyRate({ total: 0, occupied: 5 }), 0);
assert.strictEqual(occupancyRate({ total: -1, occupied: 5 }), 0);
