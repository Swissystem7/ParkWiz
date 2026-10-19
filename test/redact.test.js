// Unit tests for the detection half of the redaction step: the cell grid, the
// colour classifiers, and region location on a synthetic lot frame.
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/lib/redact.js');
const H = require('./helpers/sample-frame.js');
const { ASPHALT, CAR, SKIN, PLATE, fill } = H;

function flat(width, height, rgb) {
  const frame = new Uint8ClampedArray(width * height * 4);
  fill(frame, width, { x: 0, y: 0, w: width, h: height }, rgb);
  return frame;
}

function contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h;
}

test('cell grid scales with the frame so a phone frame costs the same as a webcam frame', () => {
  assert.equal(R.cellSize(960, 540), Math.round(540 / R.CELL_DIVISOR));
  assert.equal(R.cellSize(480, 270), 6);
  // Never below the floor, or a thumbnail would classify per pixel.
  assert.equal(R.cellSize(40, 20), 4);
});

test('the skin classifier accepts skin and rejects lot surfaces', () => {
  assert.equal(R.isSkin(...SKIN), true);
  assert.equal(R.isSkin(...ASPHALT), false, 'grey asphalt is bluer than it is red');
  assert.equal(R.isSkin(...CAR), false, 'a dark car body is below the luma floor');
  assert.equal(R.isSkin(255, 255, 255), false, 'white has no chroma');
  assert.equal(R.isSkin(...PLATE), false, 'a yellow plate is not a face');
});

test('the plate classifier accepts Israeli yellow and nothing else on a lot', () => {
  assert.equal(R.isPlateYellow(...PLATE), true);
  assert.equal(R.isPlateYellow(...ASPHALT), false);
  assert.equal(R.isPlateYellow(...CAR), false);
  // Flat-bright is intentionally not a plate class: these are the roof and the
  // bonnet of a light-coloured car, and blurring a band across them would both
  // look broken and disturb the occupancy read for that bay.
  assert.equal(R.isPlateYellow(214, 218, 224), false, 'white car roof');
  assert.equal(R.isPlateYellow(240, 243, 238), false, 'a flat-bright panel');
  assert.equal(typeof R.isPlateBright, 'undefined', 'the white-plate branch is gone, not dormant');
});

test('a frame of nothing but lot surface yields no regions', () => {
  const frame = flat(240, 120, ASPHALT);
  const found = R.detectRegions(frame, 240, 120);
  assert.deepEqual(found.faces, []);
  assert.deepEqual(found.plates, []);
  assert.equal(found.cell, R.cellSize(240, 120));
});

test('detectRegions survives a missing or zero-sized frame instead of throwing', () => {
  for (const args of [[null, 10, 10], [new Uint8ClampedArray(0), 0, 0], [new Uint8ClampedArray(4), 1, -1]]) {
    const found = R.detectRegions(...args);
    assert.deepEqual(found.faces, []);
    assert.deepEqual(found.plates, []);
  }
});

test('the sample frame yields exactly one face region and one plate region', () => {
  const { frame, width, height, face, plate } = H.sampleFrame();
  const before = Uint8ClampedArray.from(frame);
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
  // Detection only reads: the buffer is untouched until the redactor runs.
  assert.deepEqual([...frame], [...before]);
});

test('a caller-supplied cell size is honoured', () => {
  const { frame, width, height } = H.sampleFrame();
  const found = R.detectRegions(frame, width, height, { cell: 4 });
  assert.equal(found.cell, 4);
  assert.equal(found.plates.length, 1);
});
