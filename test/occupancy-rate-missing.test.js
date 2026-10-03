const test = require('node:test');
const assert = require('node:assert/strict');
const { occupancyRate } = require('../src/lib/occupancy');

test('occupancyRate returns 0 when total or occupied is missing or invalid', () => {
  assert.strictEqual(occupancyRate({ occupied: 5 }), 0);
  assert.strictEqual(occupancyRate({ total: 10 }), 0);
  assert.strictEqual(occupancyRate({}), 0);
  assert.strictEqual(occupancyRate(null), 0);
  assert.strictEqual(occupancyRate(undefined), 0);
  assert.strictEqual(occupancyRate({ total: 0, occupied: 5 }), 0);
  assert.strictEqual(occupancyRate({ total: -1, occupied: 5 }), 0);
  assert.strictEqual(occupancyRate({ total: 'nope', occupied: 1 }), 0);
  assert.strictEqual(occupancyRate({ total: 10, occupied: 'nope' }), 0);
});

test('occupancyRate still accepts numeric strings on total and occupied', () => {
  assert.ok(Math.abs(occupancyRate({ total: '10', occupied: '3' }) - 0.3) < 1e-12);
});
