'use strict';

const assert = require('node:assert');
const { normalizePlate } = require('./normalizePlate.js');

// Normal case: 7-digit plate -> XX-XXX-XX
assert.deepStrictEqual(normalizePlate('1234567'), {
  valid: true, plate: '1234567', formatted: '12-345-67',
});

// 8-digit plate -> XXX-XX-XXX
assert.deepStrictEqual(normalizePlate('12345678'), {
  valid: true, plate: '12345678', formatted: '123-45-678',
});

// Strips spaces and dashes before validating (7 digits)
assert.deepStrictEqual(normalizePlate('12-345-67'), {
  valid: true, plate: '1234567', formatted: '12-345-67',
});
assert.deepStrictEqual(normalizePlate(' 123 456 78 '), {
  valid: true, plate: '12345678', formatted: '123-45-678',
});

// Accepts numeric input
assert.deepStrictEqual(normalizePlate(1234567), {
  valid: true, plate: '1234567', formatted: '12-345-67',
});

const INVALID = { valid: false, plate: null, formatted: null };

// Too few digits
assert.deepStrictEqual(normalizePlate('123456'), INVALID);
// Too many digits
assert.deepStrictEqual(normalizePlate('123456789'), INVALID);
// Non-digit characters
assert.deepStrictEqual(normalizePlate('12A4567'), INVALID);
// Empty string
assert.deepStrictEqual(normalizePlate(''), INVALID);
// Non-string / non-number input
assert.deepStrictEqual(normalizePlate(null), INVALID);
assert.deepStrictEqual(normalizePlate(undefined), INVALID);
assert.deepStrictEqual(normalizePlate({}), INVALID);

console.log('all tests passed');
