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

// A record is a plain object. A callable that happens to carry total/occupied is
// not one, and typeof fn === 'function' slips past a bare `typeof r !== 'object'`
// check written as `!r` alone — the only input that tells the two apart.
test('occupancyRate treats a callable carrying total/occupied as no data, not as a record', () => {
  const fn = function () {};
  fn.total = 10;
  fn.occupied = 5;
  assert.strictEqual(occupancyRate(fn), 0);

  const arrow = () => {};
  arrow.total = 4;
  arrow.occupied = 1;
  assert.strictEqual(occupancyRate(arrow), 0);
});
