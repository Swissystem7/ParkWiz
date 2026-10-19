// The sample-frame test: one synthetic camera frame holding a pedestrian face
// and an Israeli yellow plate, pushed through the pipeline the pages use.
//
// The assertions are about destruction, not about detection scores. A frame has
// passed only when the identifying detail is no longer in the buffer — not
// merely covered, not merely softened. Everything a court or a DPO would ask is
// one of these four lines: was it found, was it erased, is the erasure
// irreversible, and was the rest of the frame left alone.
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/lib/redact.js');
const H = require('./helpers/sample-frame.js');
const { fakeCanvas, fakeSource } = require('./helpers/fake-canvas.js');

function contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h;
}

test('the sample frame yields exactly one face region and one plate region', () => {
  const { frame, width, height, face, plate } = H.sampleFrame();
  const found = R.detectRegions(frame, width, height);

  assert.equal(found.faces.length, 1, 'the pedestrian face');
  assert.equal(found.plates.length, 1, 'the yellow plate');
  // Padded, so the located box must fully swallow the planted rect: a box that
  // merely overlaps leaves an identifiable sliver at the edge.
  assert.ok(contains(found.faces[0], face), 'face box covers the whole planted face');
  assert.ok(contains(found.plates[0], plate), 'plate box covers the whole planted plate');
  // And neither may swallow the frame; that would be a blank page, not privacy.
  assert.ok(found.faces[0].w * found.faces[0].h < width * height * 0.1);
  assert.ok(found.plates[0].w * found.plates[0].h < width * height * 0.1);
});

test('redacting the sample frame erases the face features and the plate glyphs', () => {
  const { frame, width, height, face, plate } = H.sampleFrame();

  assert.ok(H.countColour(frame, width, height, H.FEATURE) > 0, 'eyes and mouth are present');
  assert.ok(H.countColour(frame, width, height, H.GLYPH) > 0, 'plate glyphs are present');
  const faceDetail = H.spread(frame, width, face);
  const plateDetail = H.spread(frame, width, plate);

  const report = R.redactFrame(frame, width, height);

  assert.equal(report.faces, 1);
  assert.equal(report.plates, 1);
  assert.equal(report.regions, 2, 'both regions were actually written over');
  assert.equal(report.width, width);
  assert.equal(report.height, height);

  assert.equal(H.countColour(frame, width, height, H.FEATURE), 0, 'no eye/mouth pixel survives');
  assert.equal(H.countColour(frame, width, height, H.GLYPH), 0, 'no plate glyph pixel survives');
  assert.ok(H.spread(frame, width, plate) < plateDetail * 0.1,
    'plate detail collapsed by over 90%');
  assert.ok(H.spread(frame, width, face) < faceDetail * 0.7,
    'face detail collapsed');
});

test('redaction destroys rather than hides: the same frame redacts to the same flat blocks', () => {
  const a = H.sampleFrame();
  const b = H.sampleFrame();
  R.redactFrame(a.frame, a.width, a.height);
  // A second pass over an already-redacted frame must find nothing new to
  // destroy and must not keep eroding the image — averaging a flat block gives
  // the same flat block back.
  const again = Uint8ClampedArray.from(a.frame);
  R.redactFrame(a.frame, a.width, a.height);
  let moved = 0;
  for (let i = 0; i < again.length; i++) if (Math.abs(again[i] - a.frame[i]) > 2) moved++;
  assert.ok(moved < again.length * 0.02, 'redaction is near-idempotent');

  // Deterministic: two runs of the same frame give byte-identical output, so a
  // pilot report can be reproduced from the same snapshot.
  R.redactFrame(b.frame, b.width, b.height);
  R.redactFrame(b.frame, b.width, b.height);
  assert.deepEqual([...a.frame], [...b.frame]);
});

test('the lot surface outside the redacted boxes is untouched, so occupancy still works', () => {
  const { frame, width, height } = H.sampleFrame();
  const before = Uint8ClampedArray.from(frame);
  const found = R.detectRegions(frame, width, height);
  R.redactFrame(frame, width, height);

  const boxes = [...found.faces, ...found.plates];
  const inAnyBox = (x, y) => boxes.some((b) =>
    x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);

  let changedOutside = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inAnyBox(x, y)) continue;
      const i = (y * width + x) * 4;
      if (before[i] !== frame[i] || before[i + 1] !== frame[i + 1] || before[i + 2] !== frame[i + 2]) {
        changedOutside++;
      }
    }
  }
  assert.equal(changedOutside, 0, 'redaction never writes outside a detected box');
  // The car body the occupancy heuristic reads is still dark, unblurred asphalt
  // and metal — the measurement runs on the redacted frame unharmed.
  assert.deepEqual(H.pixelAt(frame, width, 180, 130), H.CAR);
});

test('redactSource gates a frame on its way into a canvas', () => {
  const { frame, width, height } = H.sampleFrame();
  const canvas = fakeCanvas(width, height);
  const source = fakeSource(frame, width, height);

  const report = R.redactSource(source, canvas);

  assert.equal(report.regions, 2);
  assert.equal(canvas.puts, 1, 'the redacted bytes were written back to the canvas');
  // What a viewer could read off the canvas: no plate colour, no glyphs.
  assert.equal(H.countColour(canvas.data, width, height, H.GLYPH), 0);
  assert.equal(H.countColour(canvas.data, width, height, H.FEATURE), 0);
  assert.ok(H.countColour(canvas.data, width, height, H.PLATE) === 0,
    'the yellow plate field is gone from the canvas the page displays');
});

test('a reused canvas takes each new frame at the new frame own size', () => {
  const big = H.sampleFrame();
  const canvas = fakeCanvas(big.width, big.height);
  R.redactSource(fakeSource(big.frame, big.width, big.height), canvas);

  // A second, differently sized snapshot through the same canvas. fakeCanvas
  // throws if drawImage would have to scale, so this fails loudly if the
  // pipeline ever trusts the stale canvas size over the source's.
  const small = new Uint8ClampedArray(120 * 90 * 4);
  H.fill(small, 120, { x: 0, y: 0, w: 120, h: 90 }, H.ASPHALT);
  R.redactSource(fakeSource(small, 120, 90), canvas);
  assert.equal(canvas.width, 120);
  assert.equal(canvas.height, 90);
});

test('a resized canvas drops the previous frame instead of leaking it', () => {
  const { frame, width, height } = H.sampleFrame();
  const canvas = fakeCanvas(width, height);
  R.redactSource(fakeSource(frame, width, height), canvas);
  canvas.width = 32;
  canvas.height = 32;
  assert.equal(canvas.data.length, 32 * 32 * 4);
  assert.ok([...canvas.data].every((v) => v === 0), 'no stale pixels after a resize');
});

test('the stream redactor redacts every frame of a video source', () => {
  const { frame, width, height } = H.sampleFrame();
  const canvas = fakeCanvas(width, height);
  const source = fakeSource(frame, width, height);
  const seen = [];

  const stream = R.createStreamRedactor(source, canvas, {
    schedule: null,
    onFrame: (report, n) => seen.push({ regions: report.regions, n }),
  });

  assert.equal(stream.frames, 0);
  assert.equal(stream.report, null);

  stream.tick();
  assert.equal(stream.frames, 1);
  assert.equal(stream.report.regions, 2);
  assert.equal(H.countColour(canvas.data, width, height, H.GLYPH), 0, 'frame 1 is redacted');

  stream.tick();
  assert.equal(stream.frames, 2);
  assert.deepEqual(seen, [{ regions: 2, n: 1 }, { regions: 2, n: 2 }]);
});

test('the stream redactor runs on the injected scheduler and stops cleanly', () => {
  const { frame, width, height } = H.sampleFrame();
  const canvas = fakeCanvas(width, height);
  const pending = [];
  let nextHandle = 0;
  let cancelled = null;

  const stream = R.createStreamRedactor(fakeSource(frame, width, height), canvas, {
    schedule: (fn) => { pending.push(fn); return ++nextHandle; },
    cancel: (handle) => { cancelled = handle; },
  });

  stream.start();
  assert.equal(stream.frames, 1, 'start() renders the first frame immediately');
  assert.equal(stream.running, true);
  stream.start();
  assert.equal(stream.frames, 1, 'start() twice does not open a second loop');

  pending.shift()();            // the browser firing the next animation frame
  assert.equal(stream.frames, 2);

  stream.stop();
  assert.equal(stream.running, false);
  assert.equal(cancelled, 2, 'the outstanding frame request was cancelled');
  const frames = stream.frames;
  pending.forEach((fn) => fn());
  assert.equal(stream.frames, frames, 'a late callback after stop() renders nothing');
});
