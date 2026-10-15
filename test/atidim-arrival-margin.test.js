// Waze-style arrival margin (#201): a window around the planned arrival, never
// a single promised minute. Fuller coverage is tracked in #202.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lot = require('../src/lib/atidim-lot');

test('margin is a symmetric window, wider at the morning rush than at night', () => {
  const rush = lot.computeArrivalMargin(8);
  const night = lot.computeArrivalMargin(3);
  assert.ok(rush.marginMinutes > night.marginMinutes);
  assert.equal(rush.from, '07:' + String(60 - rush.marginMinutes).padStart(2, '0'));
  assert.equal(night.marginMinutes % 5, 0);
  assert.ok(night.marginMinutes >= 5 && rush.marginMinutes <= 30);
});

test('window wraps midnight and the copy never claims certainty', () => {
  const m = lot.computeArrivalMargin(0);
  assert.match(m.from, /^23:\d\d$/);
  assert.match(m.textHe, /חיזוי, לא הבטחה/);
  assert.equal(lot.computeArrivalMargin('bad').hour, 0);
});
