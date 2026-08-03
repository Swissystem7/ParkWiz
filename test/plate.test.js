const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlate } = require('../src/lib/plate');

test('formats a 7-digit plate as XX-XXX-XX', () => {
  assert.deepEqual(normalizePlate('1234567'), {
    valid: true, plate: '1234567', formatted: '12-345-67',
  });
});

test('formats an 8-digit plate as XXX-XX-XXX', () => {
  assert.deepEqual(normalizePlate('12345678'), {
    valid: true, plate: '12345678', formatted: '123-45-678',
  });
});

test('ignores spaces and dashes already in the input', () => {
  assert.equal(normalizePlate('12-345-67').formatted, '12-345-67');
  assert.equal(normalizePlate('123 45 678').formatted, '123-45-678');
  assert.equal(normalizePlate(' 12 34 567 ').formatted, '12-345-67');
});

test('rejects plates that are too short or too long', () => {
  assert.equal(normalizePlate('123456').valid, false);
  assert.equal(normalizePlate('123456789').valid, false);
});

test('rejects anything that is not purely digits', () => {
  assert.equal(normalizePlate('12a4567').valid, false);
  assert.equal(normalizePlate('').valid, false);
});

// Regression: the browser used to carry its own copy of this function that also
// accepted numbers, so the same input was valid in the app and invalid in the
// tests. One definition now, and it is string-only.
test('rejects non-string input, including numbers', () => {
  for (const input of [1234567, null, undefined, {}, ['1234567']]) {
    assert.equal(normalizePlate(input).valid, false, `expected ${String(input)} to be rejected`);
  }
});

test('an invalid result never leaks a plate value', () => {
  assert.deepEqual(normalizePlate('nope'), { valid: false, plate: null, formatted: null });
});

test('callers cannot mutate the shared invalid result', () => {
  const first = normalizePlate('nope');
  first.valid = true;
  assert.equal(normalizePlate('also nope').valid, false);
});
