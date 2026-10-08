const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../src/lib/heuristic');

// RGBA data is 4 bytes per pixel. A sampling stride is a byte offset, so a
// stride that is not a multiple of 4 walks off the pixel grid and reads
// G/B/A bytes as if they were the R/G/B of a real pixel. On a flat red patch
// that produced wildly different luma values for identical pixels.

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

const RED = h.luma(200, 0, 0);

test('a stride that is not a multiple of 4 still samples whole pixels', () => {
  const data = rgbaFill(32, 200, 0, 0);
  for (const stride of [5, 6, 7, 9, 10]) {
    const samples = h.lumaSamples(data, stride);
    assert.ok(samples.length > 1, `stride ${stride} yields samples`);
    for (const y of samples) {
      assert.ok(Math.abs(y - RED) < 1e-9, `stride ${stride} read a misaligned pixel: ${y}`);
    }
  }
});

test('an off-grid stride snaps down to the previous pixel boundary', () => {
  const data = rgbaFill(32, 200, 0, 0);
  assert.equal(h.lumaSamples(data, 7).length, h.lumaSamples(data, 4).length);
  assert.equal(h.lumaSamples(data, 10).length, h.lumaSamples(data, 8).length);
});

test('stats from an off-grid stride match the aligned stats on a flat patch', () => {
  const data = rgbaFill(64, 200, 0, 0);
  const aligned = h.statsFromRgba(data, 4);
  const offGrid = h.statsFromRgba(data, 6);
  assert.ok(Math.abs(offGrid.mean - aligned.mean) < 1e-9);
  assert.ok(offGrid.variance < 1e-9);
});

test('aligned strides and the default are unchanged', () => {
  const data = rgbaFill(16, 10, 10, 10);
  assert.equal(h.lumaSamples(data, 4).length, 16);
  assert.equal(h.lumaSamples(data, 16).length, 4);
  assert.equal(h.lumaSamples(data).length, 4);
  assert.equal(h.lumaSamples(data, 'x').length, 4);
  assert.equal(h.lumaSamples(data, 2).length, 4);
});
