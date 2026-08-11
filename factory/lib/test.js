const assert = require('assert');
const { normalizePlate } = require('./normalizePlate');
const { weightedAvailability } = require('./weightedAvailability');

// normalizePlate
assert.deepStrictEqual(normalizePlate('12-345-67'), { valid: true, plate: '1234567', formatted: '12-345-67' });
assert.deepStrictEqual(normalizePlate('123 45 678'), { valid: true, plate: '12345678', formatted: '123-45-678' });
assert.deepStrictEqual(normalizePlate('1234567'), { valid: true, plate: '1234567', formatted: '12-345-67' });
assert.strictEqual(normalizePlate('12345').valid, false);      // too short
assert.strictEqual(normalizePlate('123456789').valid, false);  // too long
assert.strictEqual(normalizePlate('12a4567').valid, false);    // non-digit
assert.strictEqual(normalizePlate(1234567).valid, false);      // non-string
assert.deepStrictEqual(normalizePlate('bad'), { valid: false, plate: null, formatted: null });

// weightedAvailability
const now = 1_000_000_000_000;
assert.strictEqual(weightedAvailability([], now), 0);
assert.strictEqual(weightedAvailability([{ ts: now, delta: 1 }], now), 1);         // no decay at t=0
assert.strictEqual(weightedAvailability([{ ts: now - 900000, delta: 1 }], now), 0.5); // one half-life
assert.strictEqual(weightedAvailability([{ ts: now - 3 * 3600000, delta: 1 }], now), 0); // >2h ignored
assert.ok(Math.abs(weightedAvailability([{ ts: now, delta: 1 }, { ts: now, delta: -1 }], now)) < 1e-9);

console.log('OK — all asserts passed');
