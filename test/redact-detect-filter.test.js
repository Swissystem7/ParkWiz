// Tests for COCO-SSD detection filtering/redaction (#281).
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/lib/redact.js');

const det = (cls, bbox) => ({ class: cls, bbox, score: 0.9 });

test('class filter keeps all six target classes and drops others', () => {
  const big = [0, 0, 200, 200];
  const input = [...R.REDACT_CLASSES.map((c) => det(c, big)), det('dog', big), det('bench', big), det('cat', big)];
  const out = R.filterRedactDetections(input);
  assert.deepEqual(out.map((r) => r.class), [...R.REDACT_CLASSES]);
  assert.ok(Object.isFrozen(R.REDACT_CLASSES));
});

test('size threshold is strict: equal area dropped, override honoured', () => {
  const opts = { minBoxAreaPx: 100 };
  assert.deepEqual(R.filterRedactDetections([det('car', [0, 0, 10, 10])], opts), []);
  assert.equal(R.filterRedactDetections([det('car', [0, 0, 10, 11])], opts).length, 1);
  assert.deepEqual(R.filterRedactDetections([det('car', [0, 0, 9, 10])], opts), []);
  // Default threshold from the exported constant.
  const side = Math.sqrt(R.MIN_BOX_AREA_PX);
  assert.equal(R.MIN_BOX_AREA_PX, 10000);
  assert.deepEqual(R.filterRedactDetections([det('car', [0, 0, side, side])]), [], 'area == threshold dropped');
  // 100 x 100.01 is fractional; use integer area MIN+1: 10000+1 via 1 x (MIN+1) is
  // degenerate but valid, and 101x100=10100 also clears it — use exact +1 area.
  assert.equal(R.filterRedactDetections([det('car', [0, 0, 1, R.MIN_BOX_AREA_PX + 1])]).length, 1);
  // Bad overrides fall back to the default.
  for (const bad of [{ minBoxAreaPx: -1 }, { minBoxAreaPx: NaN }, { minBoxAreaPx: Infinity }, {}, null, undefined]) {
    assert.deepEqual(R.filterRedactDetections([det('car', [0, 0, 10, 10])], bad), []);
    assert.equal(R.filterRedactDetections([det('car', [0, 0, 200, 200])], bad).length, 1);
  }
});

test('invalid inputs yield [] and never throw', () => {
  for (const bad of [null, undefined, 42, 'person', {}, [null], [undefined], [42],
    [det('person')], [{ class: 'person', bbox: 'x' }], [{ class: 'person', bbox: [0, 0, 10] }],
    [{ class: 'person', bbox: [0, 0, NaN, 200] }], [{ class: 'person', bbox: [0, 0, 0, 200] }],
    [{ class: 'person', bbox: [0, 0, 200, -1] }], [{ class: 'person', bbox: [Infinity, 0, 200, 200] }],
    [{ bbox: [0, 0, 200, 200] }], [{ class: 'Person', bbox: [0, 0, 200, 200] }]]) {
    assert.doesNotThrow(() => R.filterRedactDetections(bad));
    assert.deepEqual(R.filterRedactDetections(bad), []);
  }
});

test('conversion, order preserved, input unmutated', () => {
  const input = [det('bus', [1, 2, 30, 40]), det('car', [5, 6, 200, 200]), det('dog', [0, 0, 200, 200])];
  const before = JSON.parse(JSON.stringify(input));
  const out = R.filterRedactDetections(input, { minBoxAreaPx: 100 });
  assert.deepEqual(out[0], { x: 1, y: 2, w: 30, h: 40, class: 'bus' });
  assert.deepEqual(out.map((r) => r.class), ['bus', 'car']);
  assert.deepEqual(input, before);
  assert.notEqual(out[0], input[0]);
});

test('redactDetections changes pixels inside a kept box only', () => {
  const width = 40, height = 40;
  const frame = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    frame[p * 4] = (p * 7) % 256; frame[p * 4 + 1] = (p * 13) % 256; frame[p * 4 + 2] = (p * 29) % 256; frame[p * 4 + 3] = 255;
  }
  const before = Uint8ClampedArray.from(frame);
  const img = { data: frame, width, height };
  const out = R.redactDetections(img, [
    det('person', [2, 2, 20, 20]),
    det('dog', [24, 24, 12, 12]),
  ], { minBoxAreaPx: 100 });
  assert.equal(out.redacted, 1);
  assert.deepEqual(out.rects, [{ x: 2, y: 2, w: 20, h: 20, class: 'person' }]);
  const px = (x, y) => [...frame.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
  const pxBefore = (x, y) => [...before.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
  assert.notDeepEqual(px(10, 10), pxBefore(10, 10), 'inside person box changed');
  assert.deepEqual(px(30, 30), pxBefore(30, 30), 'inside unknown-class box unchanged');
  assert.deepEqual(px(38, 2), pxBefore(38, 2), 'outside any box unchanged');
});
