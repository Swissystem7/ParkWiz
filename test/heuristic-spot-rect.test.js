const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('../src/lib/heuristic');

const W = 800;
const H = 480;

test('a rectangle inside the frame maps to the same pixels the pages used before', () => {
  const r = h.spotPixelRect({ x: 0.0625, y: 0.075, w: 0.135, h: 0.35 }, W, H);
  assert.deepEqual(r, { x: 50, y: 36, w: 108, h: 168 });
});

test('a rectangle that overhangs the right or bottom edge is clipped to the frame', () => {
  const r = h.spotPixelRect({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, W, H);
  assert.deepEqual(r, { x: 720, y: 432, w: 80, h: 48 });
  assert.ok(r.x + r.w <= W && r.y + r.h <= H);
});

test('a rectangle that starts before the frame is clipped at zero', () => {
  const r = h.spotPixelRect({ x: -0.1, y: -0.2, w: 0.3, h: 0.4 }, W, H);
  assert.equal(r.x, 0);
  assert.equal(r.y, 0);
  assert.ok(r.w >= 1 && r.h >= 1);
});

test('a rectangle entirely outside the frame is null, never a zero-width getImageData call', () => {
  // x at or past the right edge: the old Math.min(w, width - x) was 0 or negative.
  assert.equal(h.spotPixelRect({ x: 1, y: 0.1, w: 0.2, h: 0.2 }, W, H), null);
  assert.equal(h.spotPixelRect({ x: 1.2, y: 0.1, w: 0.2, h: 0.2 }, W, H), null);
  assert.equal(h.spotPixelRect({ x: 0.1, y: 1.5, w: 0.2, h: 0.2 }, W, H), null);
  // fully to the left / above the frame
  assert.equal(h.spotPixelRect({ x: -0.5, y: 0.1, w: 0.2, h: 0.2 }, W, H), null);
  assert.equal(h.spotPixelRect({ x: 0.1, y: -0.5, w: 0.2, h: 0.2 }, W, H), null);
});

test('hairline rectangles keep the 1px floor the pages always had', () => {
  const r = h.spotPixelRect({ x: 0.5, y: 0.5, w: 0.0001, h: 0.0001 }, W, H);
  assert.deepEqual(r, { x: 400, y: 240, w: 1, h: 1 });
});

test('malformed spots and empty images are rejected', () => {
  assert.equal(h.spotPixelRect(null, W, H), null);
  assert.equal(h.spotPixelRect({ x: 'a', y: 0, w: 0.1, h: 0.1 }, W, H), null);
  assert.equal(h.spotPixelRect({ x: 0.1, y: 0.1, w: 0, h: 0.1 }, W, H), null);
  assert.equal(h.spotPixelRect({ x: 0.1, y: 0.1, w: 0.1, h: -0.1 }, W, H), null);
  assert.equal(h.spotPixelRect({ x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, 0, H), null);
  assert.equal(h.spotPixelRect({ x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, W, NaN), null);
});

test('a spot with no pixels is reported as unknown, not as free or occupied', () => {
  const inside = h.statsFromRgba(new Uint8ClampedArray(64 * 4).fill(120), 4);
  const lot = h.estimateLot([
    { id: 's1', cur: inside },
    { id: 's2', cur: null, curSamples: null },
  ]);
  assert.equal(lot.total, 2);
  assert.equal(lot.estimates[1].method, 'unknown');
  assert.equal(lot.estimates[1].occupied, false);
  assert.equal(lot.estimates[1].confidence, 0);
});

test('both calibration pages read spot pixels through spotPixelRect', () => {
  const root = path.join(__dirname, '..');
  for (const page of ['pilot-kit.html', 'pilot-calibrate.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, /HEU\.spotPixelRect\(spot, c\.width, c\.height\)/, page);
    assert.doesNotMatch(html, /Math\.min\(w, c\.width - x\)/, page + ' still computes its own clipped width');
    assert.match(html, /cur: curData \? HEU\.statsFromRgba/, page + ' must not build stats from a null patch');
  }
});
