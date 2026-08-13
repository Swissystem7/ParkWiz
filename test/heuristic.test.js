const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('../src/lib/heuristic');

function rgbaFill(nPixels, r, g, b) {
  const data = new Uint8ClampedArray(nPixels * 4);
  for (let i = 0; i < nPixels; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

test('luma is Rec. 709 and ignores a missing channel as NaN-safe via Number()', () => {
  assert.equal(h.luma(0, 0, 0), 0);
  assert.ok(Math.abs(h.luma(255, 255, 255) - 255) < 1e-9);
  assert.ok(Math.abs(h.luma(0, 255, 0) - 0.7152 * 255) < 1e-9);
});

test('statsFromRgba reports mean and zero variance on a flat patch', () => {
  const data = rgbaFill(64, 80, 80, 80);
  const s = h.statsFromRgba(data, 4);
  assert.equal(s.n, 64);
  assert.ok(Math.abs(s.mean - 80) < 1e-9);
  assert.ok(s.variance < 1e-9);
});

test('statsFromRgba default stride matches the kit (every 4th pixel)', () => {
  const data = rgbaFill(8, 10, 10, 10);
  const s = h.statsFromRgba(data);
  assert.equal(s.n, 2);
  assert.equal(h.SAMPLE_STRIDE, 16);
});

test('empty / junk buffers do not throw', () => {
  assert.deepEqual(h.statsFromRgba(null), { mean: 0, variance: 0, n: 0 });
  assert.deepEqual(h.statsFromRgba(new Uint8ClampedArray(0)), { mean: 0, variance: 0, n: 0 });
  assert.equal(h.estimateOccupied(null), null);
  assert.equal(h.estimateOccupied({ mean: 'x', variance: 1 }), null);
});

test('vs-empty-frame flags a dark car-like patch against pale asphalt', () => {
  const empty = { mean: 140, variance: 20 };
  const car = { mean: 35, variance: 80 };
  const r = h.estimateOccupied(car, empty);
  assert.equal(r.method, 'vs-empty-frame');
  assert.equal(r.occupied, true);
  assert.ok(r.score >= h.EMPTY_SCORE_CUTOFF);
  assert.equal(r.confidence, h.CONF_VS_EMPTY);
});

test('vs-empty-frame keeps a matching empty patch free', () => {
  const empty = { mean: 140, variance: 20 };
  const same = { mean: 141, variance: 22 };
  const r = h.estimateOccupied(same, empty);
  assert.equal(r.occupied, false);
  assert.ok(r.score < h.EMPTY_SCORE_CUTOFF);
});

test('absolute-threshold flags a dark or high-variance patch without a reference', () => {
  const dark = h.estimateOccupied({ mean: 40, variance: 10 }, null);
  assert.equal(dark.method, 'absolute-threshold');
  assert.equal(dark.occupied, true);
  assert.equal(dark.confidence, h.CONF_ABSOLUTE);

  const busy = h.estimateOccupied({ mean: 120, variance: 1600 }, null);
  assert.equal(busy.occupied, true);

  const pale = h.estimateOccupied({ mean: 130, variance: 40 }, null);
  assert.equal(pale.occupied, false);
});

test('methodConfidence only knows the two kit methods', () => {
  assert.equal(h.methodConfidence('vs-empty-frame'), 0.45);
  assert.equal(h.methodConfidence('absolute-threshold'), 0.25);
  assert.equal(h.methodConfidence('neural-net'), 0);
});

test('pilot-kit calls the shared heuristic instead of an inline copy', () => {
  const kit = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');
  assert.match(kit, /src="src\/lib\/heuristic\.js"/);
  assert.match(kit, /ParkWizHeuristic/);
  assert.match(kit, /statsFromRgba/);
  assert.match(kit, /estimateOccupied/);
  assert.doesNotMatch(kit, /0\.2126 \* data\[i\] \+ 0\.7152/);
});
