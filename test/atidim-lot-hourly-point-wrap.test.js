// hourlyPoint's hour wrap (Refs #200, follow-up to the atidim smoke #156).
//
// The three anchors the issue named — hourlyPoint(24).hour === 0,
// hourlyPoint(-1).hour === 23, hourlyPoint(NaN).hour === 0 — landed with #217
// and stay in test/atidim-lot.test.js. The implementation is correct, so this
// file is test-only; what it adds is the rest of the contract of that one line:
//
//   const h = Number.isFinite(raw) ? ((Math.floor(raw) % 24) + 24) % 24 : 0;
//
// Three independent pieces, each of which a plausible "cleanup" would break:
//   * Math.floor, not Math.trunc/Math.round. On negatives they disagree:
//     floor(-0.5) is -1 (23:00, the hour that is actually running), while
//     trunc/round give 0 — midnight, the emptiest point on the curve. A clock
//     that drifts a few seconds before the hour would read as an empty lot.
//   * the double modulo, not a single `% 24`. One pass leaves -1 negative, and
//     getHourlyCurve()[-1] is undefined, which is the crash #156 went after.
//   * Number() + the isFinite guard, so undefined/''/{}/Infinity land on 00:00
//     rather than indexing the curve with NaN.
//
// demo/atidim.html reads `model.hourlyPoint(seededHour).label` straight into a
// screen-reader announcement, so "never undefined" is a page-level promise.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lot = require('../src/lib/atidim-lot');

test('every 24-hour offset of an hour wraps back onto that hour', () => {
  const curve = lot.getHourlyCurve();
  for (let hour = 0; hour < 24; hour += 1) {
    for (const turns of [-2, -1, 0, 1, 2]) {
      const point = lot.hourlyPoint(hour + turns * 24);
      assert.equal(point.hour, hour, hour + ' + ' + turns + ' days');
      assert.deepEqual(point, curve[hour]);
    }
  }
});

test('a fractional hour reads as the hour already running, not the next one', () => {
  // Math.floor, both sides of zero: 10:54 is still the 10:00 point, and a clock
  // half a minute before midnight is still in 23:00.
  assert.equal(lot.hourlyPoint(10.9).hour, 10);
  assert.equal(lot.hourlyPoint(0.9).hour, 0);
  assert.equal(lot.hourlyPoint(-0.5).hour, 23);
  assert.equal(lot.hourlyPoint(-23.5).hour, 0);
  assert.equal(lot.hourlyPoint(-24.5).hour, 23);
  assert.equal(lot.hourlyPoint(23.999).hour, 23);
});

test('an unusable hour reads as 00:00 instead of indexing the curve with NaN', () => {
  for (const bad of [undefined, null, '', '  ', {}, [], 'not an hour', Infinity, -Infinity]) {
    const point = lot.hourlyPoint(bad);
    assert.equal(point.hour, 0, String(bad) + ' -> ' + (point && point.hour));
    assert.equal(point.label, '00:00');
  }
});

test('no input produces an undefined point or a broken label', () => {
  const inputs = [0, 23, 24, 25, -1, -24, -25, 48, 1e21, -0, 10.9, -0.5,
    NaN, Infinity, -Infinity, undefined, null, '', '12', ' 12 ', true, false, {}, []];
  for (const input of inputs) {
    const point = lot.hourlyPoint(input);
    assert.ok(point, 'undefined point for ' + String(input));
    assert.ok(Number.isInteger(point.hour) && point.hour >= 0 && point.hour <= 23,
      String(input) + ' -> hour ' + point.hour);
    assert.equal(point.label, (point.hour < 10 ? '0' : '') + point.hour + ':00');
    assert.equal(point.occupied + point.available, lot.ATIDIM_LOT.totalCapacity);
  }
});

test('numeric strings and booleans coerce the way the clock does', () => {
  // lotHour() hands hourlyPoint a Number already, but the demo page and the
  // board read hours out of markup, where '12' and ' 12 ' both turn up.
  assert.equal(lot.hourlyPoint('12').hour, 12);
  assert.equal(lot.hourlyPoint(' 12 ').hour, 12);
  assert.equal(lot.hourlyPoint('24').hour, 0);
  assert.equal(lot.hourlyPoint('-1').hour, 23);
});

test('capacity rides through the wrap and falls back when it is junk', () => {
  assert.deepEqual(lot.hourlyPoint(24, 100), lot.getHourlyCurve(100)[0]);
  assert.deepEqual(lot.hourlyPoint(-1, 100), lot.getHourlyCurve(100)[23]);
  const full = lot.ATIDIM_LOT.totalCapacity;
  for (const cap of [undefined, null, 0, NaN, '', 'lots']) {
    const point = lot.hourlyPoint(24, cap);
    assert.equal(point.occupied + point.available, full, 'capacity ' + String(cap));
  }
});

test('each call hands back a fresh point, so a caller cannot corrupt the curve', () => {
  const first = lot.hourlyPoint(10);
  first.hour = 99;
  first.label = 'XX:XX';
  first.available = -1;
  const second = lot.hourlyPoint(10);
  assert.equal(second.hour, 10);
  assert.equal(second.label, '10:00');
  assert.deepEqual(second, lot.getHourlyCurve()[10]);
});
