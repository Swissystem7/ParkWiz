const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { genHourlyPattern, stableVar, HOURLY_SLOTS, MIN_CHANCE } = require('../src/lib/predict');

test('returns one chance per hourly slot', () => {
  assert.equal(genHourlyPattern(60, 0).length, HOURLY_SLOTS.length);
});

test('same street and availability always give the same prediction', () => {
  assert.deepEqual(genHourlyPattern(60, 3), genHourlyPattern(60, 3));
});

test('different streets give different predictions for the same availability', () => {
  assert.notDeepEqual(genHourlyPattern(60, 0), genHourlyPattern(60, 1));
});

test('every chance stays inside the valid range', () => {
  for (let street = 0; street < 20; street++) {
    for (const avail of [0, 5, 33, 50, 87, 100]) {
      for (const chance of genHourlyPattern(avail, street)) {
        assert.ok(chance >= MIN_CHANCE, `chance ${chance} below floor`);
        assert.ok(chance <= 1, `chance ${chance} above 1`);
      }
    }
  }
});

test('an empty street never predicts zero chance', () => {
  for (const chance of genHourlyPattern(0, 7)) assert.equal(chance, MIN_CHANCE);
});

test('higher availability never lowers the predicted chance', () => {
  for (let street = 0; street < 10; street++) {
    const low = genHourlyPattern(40, street);
    const high = genHourlyPattern(80, street);
    low.forEach((chance, i) => assert.ok(high[i] >= chance, `street ${street}, slot ${i}`));
  }
});

test('rush hours are penalised relative to their quiet neighbours', () => {
  const pattern = genHourlyPattern(70, 2);
  const at = (hour) => pattern[HOURLY_SLOTS.indexOf(hour)];
  assert.ok(at(18) < at(16), 'expected 18:00 to be worse than 16:00');
});

test('the stable wobble stays inside its documented band', () => {
  for (let street = 0; street < 50; street++) {
    for (const hour of HOURLY_SLOTS) {
      assert.ok(Math.abs(stableVar(street, hour)) <= 0.075 + 1e-12);
    }
  }
});

// PW-005 is a product promise, not just an implementation detail: the same
// street and hour must always show the same chance. Guard the source itself.
test('the prediction module contains no randomness', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'predict.js'), 'utf8');
  const code = src.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.ok(!code.includes('Math.random'), 'Math.random is back in predict.js');
});
