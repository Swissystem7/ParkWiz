// Unit tests for the destructive half of the redaction step: mosaic, blur, and
// the one-call redactFrame over a synthetic lot frame.
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/lib/redact.js');
const H = require('./helpers/sample-frame.js');
const { ASPHALT, FEATURE, GLYPH, fill, pixelAt } = H;

// A small frame where every pixel differs, so any stray write shows up.
function gradient(width, height) {
  const frame = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; p < width * height; p++, i += 4) {
    frame[i] = (p * 7) % 256; frame[i + 1] = (p * 13) % 256; frame[i + 2] = (p * 29) % 256; frame[i + 3] = 255;
  }
  return frame;
}

function inside(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

function contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;
}

function eachPixel(rect, fn) {
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) fn(x, y);
}

function lumaRange(frame, width, rect) {
  let lo = 255, hi = 0;
  eachPixel(rect, (x, y) => {
    const [r, g, b] = pixelAt(frame, width, x, y);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  });
  return hi - lo;
}

test('mosaic replaces each tile with its rounded mean colour', () => {
  const frame = gradient(4, 4);
  const before = Uint8ClampedArray.from(frame);
  assert.equal(R.pixelateRect(frame, 4, 4, { x: 0, y: 0, w: 4, h: 4 }, 2), true);
  for (const [tx, ty] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
    const tile = [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]];
    for (let ch = 0; ch < 3; ch++) {
      const mean = Math.round(tile.reduce((s, [x, y]) => s + before[(y * 4 + x) * 4 + ch], 0) / 4);
      for (const [x, y] of tile) assert.equal(frame[(y * 4 + x) * 4 + ch], mean, `tile ${tx},${ty} ch ${ch}`);
    }
  }
});

test('pixelateRect and blurRect leave every byte outside the rect identical', () => {
  const rect = { x: 3, y: 2, w: 7, h: 5 };
  for (const run of [(f) => R.pixelateRect(f, 16, 12, rect, 3), (f) => R.blurRect(f, 16, 12, rect, 2)]) {
    const frame = gradient(16, 12);
    const before = Uint8ClampedArray.from(frame);
    assert.equal(run(frame), true);
    let changed = 0;
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (inside(rect, x, y)) { if (frame[i] !== before[i]) changed++; continue; }
        for (let ch = 0; ch < 4; ch++) assert.equal(frame[i + ch], before[i + ch], `outside ${x},${y}`);
      }
    }
    assert.ok(changed > 0, 'something inside the rect actually changed');
  }
});

test('alpha is never written by mosaic or blur', () => {
  const rect = { x: 2, y: 2, w: 6, h: 6 };
  for (const run of [(f) => R.pixelateRect(f, 10, 10, rect, 2), (f) => R.blurRect(f, 10, 10, rect, 2)]) {
    const frame = gradient(10, 10);
    eachPixel(rect, (x, y) => { frame[(y * 10 + x) * 4 + 3] = 77; });
    run(frame);
    eachPixel(rect, (x, y) => assert.equal(frame[(y * 10 + x) * 4 + 3], 77));
  }
});

test('rects are clipped to the frame; outside or empty rects are a no-op', () => {
  const offEdge = [{ x: -3, y: 2, w: 6, h: 4 }, { x: 7, y: 2, w: 9, h: 4 }, { x: 2, y: -5, w: 4, h: 7 }, { x: 2, y: 6, w: 4, h: 20 }];
  for (const rect of offEdge) {
    for (const fn of [R.pixelateRect, R.blurRect]) {
      const frame = gradient(10, 8);
      assert.equal(fn(frame, 10, 8, rect, 2), true, JSON.stringify(rect));
    }
  }
  const empty = [{ x: 20, y: 20, w: 5, h: 5 }, { x: -9, y: -9, w: 4, h: 4 }, { x: 2, y: 2, w: 0, h: 4 }, { x: 2, y: 2, w: 4, h: -3 }, null];
  for (const rect of empty) {
    for (const fn of [R.pixelateRect, R.blurRect]) {
      const frame = gradient(10, 8);
      const before = Uint8ClampedArray.from(frame);
      assert.doesNotThrow(() => assert.equal(fn(frame, 10, 8, rect, 2), false));
      assert.deepEqual([...frame], [...before], JSON.stringify(rect));
    }
  }
});

test('redactFrame returns zero counts on bad input instead of throwing', () => {
  for (const args of [[null], [null, 10, 10], [new Uint8ClampedArray(16), 0, 4], [new Uint8ClampedArray(4), 4, 4],
    [{ data: new Uint8ClampedArray(0), width: 0, height: 0 }]]) {
    const out = R.redactFrame(...args);
    assert.deepEqual(out, { faces: [], plates: [], cell: 0, redacted: 0 });
  }
});

test('redactFrame destroys the face and the plate on the sample frame', () => {
  const { frame, width, height, face, plate } = H.sampleFrame();
  const original = Uint8ClampedArray.from(frame);
  const out = R.redactFrame(frame, width, height);
  assert.ok(out.faces.length >= 1 && out.plates.length >= 1);
  assert.equal(out.redacted, out.faces.length + out.plates.length);
  assert.ok(out.faces.some((f) => contains(f, face)), 'a face box covers the planted face');
  assert.ok(out.plates.some((p) => contains(p, plate)), 'a plate box covers the planted plate');

  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  eachPixel(face, (x, y) => assert.ok(!same(pixelAt(frame, width, x, y), FEATURE), `feature at ${x},${y}`));
  eachPixel(plate, (x, y) => assert.ok(!same(pixelAt(frame, width, x, y), GLYPH), `glyph at ${x},${y}`));
  assert.ok(lumaRange(frame, width, face) < 0.5 * lumaRange(original, width, face), 'face detail flattened');

  for (const [x, y] of [[0, 0], [479, 0], [0, 269], [479, 269], [400, 40]]) {
    assert.deepEqual(pixelAt(frame, width, x, y), ASPHALT, `far pixel ${x},${y}`);
  }
});

test('ImageData-shaped input gives the same counts and mutates its data', () => {
  const a = H.sampleFrame();
  const b = H.sampleFrame();
  const before = Uint8ClampedArray.from(b.frame);
  const raw = R.redactFrame(a.frame, a.width, a.height);
  const img = { data: b.frame, width: b.width, height: b.height };
  const shaped = R.redactFrame(img, {});
  assert.equal(shaped.faces.length, raw.faces.length);
  assert.equal(shaped.plates.length, raw.plates.length);
  assert.equal(shaped.redacted, raw.redacted);
  assert.equal(shaped.cell, raw.cell);
  assert.notDeepEqual([...img.data], [...before], 'mutated in place');
  assert.deepEqual([...img.data], [...a.frame], 'same result as the raw call');
});

test("mode 'mosaic' skips the seam blur; there is no blur-only mode", () => {
  const m = H.sampleFrame();
  const b = H.sampleFrame();
  const om = R.redactFrame(m.frame, m.width, m.height, { mode: 'mosaic' });
  // 'blur' is not a mode: it still mosaics, so a weak blur can never be the only redaction.
  const ob = R.redactFrame(b.frame, b.width, b.height, { mode: 'blur' });
  assert.ok(om.redacted >= 2);
  assert.equal(ob.redacted, om.redacted);
  assert.notDeepEqual([...m.frame], [...b.frame]);
});

test('plates are filled with one solid colour', () => {
  const { frame, width, height } = H.sampleFrame();
  const out = R.redactFrame(frame, width, height, { mode: 'mosaic' });
  for (const p of out.plates) {
    const first = pixelAt(frame, width, p.x, p.y);
    eachPixel(p, (x, y) => assert.deepEqual(pixelAt(frame, width, x, y), first, `plate ${x},${y}`));
  }
});

test('a tiny block cannot turn redaction into a no-op', () => {
  const frame = gradient(4, 4);
  const before = Uint8ClampedArray.from(frame);
  assert.equal(R.pixelateRect(frame, 4, 4, { x: 0, y: 0, w: 4, h: 4 }, 1), true);
  assert.notDeepEqual([...frame], [...before], 'block 1 is raised to 2');

  const a = H.sampleFrame();
  const b = H.sampleFrame();
  R.redactFrame(a.frame, a.width, a.height, { block: 1 });
  R.redactFrame(b.frame, b.width, b.height, { block: R.REDACT.minBlock });
  assert.deepEqual([...a.frame], [...b.frame], 'a caller block is floored at REDACT.minBlock');
  assert.ok(Object.isFrozen(R.REDACT));
});
