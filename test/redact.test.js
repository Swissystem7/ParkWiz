// Unit tests for the redaction step itself: the colour classifiers, the two
// destructive primitives, and the privacy-mode lock. The end-to-end pass over a
// whole frame lives in redact-sample-frame.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/lib/redact.js');
const { ASPHALT, CAR, SKIN, PLATE, fill, pixelAt, spread } = require('./helpers/sample-frame.js');

function flat(width, height, rgb) {
  const frame = new Uint8ClampedArray(width * height * 4);
  fill(frame, width, { x: 0, y: 0, w: width, h: height }, rgb);
  return frame;
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

test('a frame of nothing but lot surface yields no regions, so nothing is blurred', () => {
  const frame = flat(240, 120, ASPHALT);
  const found = R.detectRegions(frame, 240, 120);
  assert.deepEqual(found.faces, []);
  assert.deepEqual(found.plates, []);
  const before = Uint8ClampedArray.from(frame);
  const report = R.redactFrame(frame, 240, 120);
  assert.equal(report.regions, 0);
  assert.deepEqual([...frame], [...before], 'an empty lot frame is passed through untouched');
});

test('detectRegions survives a missing or zero-sized frame instead of throwing', () => {
  for (const args of [[null, 10, 10], [new Uint8ClampedArray(0), 0, 0], [new Uint8ClampedArray(4), 1, -1]]) {
    const found = R.detectRegions(...args);
    assert.deepEqual(found.faces, []);
    assert.deepEqual(found.plates, []);
  }
});

test('pixelateRect flattens each block to its mean and leaves the rest of the frame alone', () => {
  const width = 8, height = 4;
  const frame = flat(width, height, ASPHALT);
  // Left half of the top-left 4x2 box is black, right half is white.
  fill(frame, width, { x: 0, y: 0, w: 2, h: 2 }, [0, 0, 0]);
  fill(frame, width, { x: 2, y: 0, w: 2, h: 2 }, [255, 255, 255]);

  assert.equal(R.pixelateRect(frame, width, height, { x: 0, y: 0, w: 4, h: 2 }, 1, 1), true);
  // One block over black+white in equal parts averages to mid grey everywhere.
  for (let x = 0; x < 4; x++) {
    assert.deepEqual(pixelAt(frame, width, x, 0), [127, 127, 127]);
    assert.deepEqual(pixelAt(frame, width, x, 1), [127, 127, 127]);
  }
  assert.deepEqual(pixelAt(frame, width, 4, 0), ASPHALT, 'pixel just outside the box');
  assert.deepEqual(pixelAt(frame, width, 0, 2), ASPHALT, 'row just below the box');
});

test('pixelateRect clips a box that hangs off the frame rather than corrupting neighbours', () => {
  const width = 6, height = 6;
  const frame = flat(width, height, ASPHALT);
  // Fully outside: nothing to do, and no write past the buffer.
  assert.equal(R.pixelateRect(frame, width, height, { x: 10, y: 10, w: 4, h: 4 }, 2, 2), false);
  assert.equal(R.pixelateRect(frame, width, height, { x: -8, y: 0, w: 4, h: 4 }, 2, 2), false);
  // Partly outside: the in-frame part is redacted, the buffer stays its size.
  fill(frame, width, { x: 4, y: 4, w: 2, h: 2 }, [0, 0, 0]);
  assert.equal(R.pixelateRect(frame, width, height, { x: 4, y: 4, w: 99, h: 99 }, 1, 1), true);
  assert.equal(frame.length, width * height * 4);
  assert.deepEqual(pixelAt(frame, width, 5, 5), [0, 0, 0]);
});

test('blurRect smooths inside the box only, and zero passes is a no-op', () => {
  const width = 12, height = 6;
  const frame = flat(width, height, ASPHALT);
  const box = { x: 1, y: 1, w: 8, h: 4 };
  fill(frame, width, { x: 1, y: 1, w: 4, h: 4 }, [0, 0, 0]);

  const untouched = Uint8ClampedArray.from(frame);
  R.blurRect(frame, width, height, box, 0);
  assert.deepEqual([...frame], [...untouched], 'zero passes changes nothing');

  const before = spread(frame, width, box);
  R.blurRect(frame, width, height, box, 2);
  assert.ok(spread(frame, width, box) < before, 'the hard edge inside the box is softened');
  assert.deepEqual(pixelAt(frame, width, 10, 1), ASPHALT, 'outside the box is untouched');
  assert.deepEqual(pixelAt(frame, width, 1, 5), ASPHALT);
});

test('privacy mode is on by default and cannot be turned off off a dev host', () => {
  const prod = R.createPrivacyMode({ hostname: 'parkwiz.example.gov.il' });
  assert.equal(prod.enabled, true, 'on by default');
  assert.equal(prod.locked, true);
  assert.equal(prod.setEnabled(false), true, 'the setter refuses to disable in production');
  assert.equal(prod.enabled, true);
  assert.equal(prod.toggle(), true);
  assert.equal(prod.enabled, true);
  assert.match(prod.labelHe(), /מצב פרטיות פועל/);
  assert.match(prod.labelHe(), /נעול בבילד ייצור/);
  assert.match(prod.labelEn(), /Privacy mode ON/);
});

test('a dev host may turn privacy mode off, and the label says so in Hebrew', () => {
  const dev = R.createPrivacyMode({ hostname: 'localhost' });
  assert.equal(dev.locked, false);
  assert.equal(dev.enabled, true, 'still on by default');
  assert.equal(dev.setEnabled(false), false);
  assert.equal(dev.enabled, false);
  assert.equal(dev.labelHe(), 'מצב פרטיות כבוי — פיתוח בלבד');
  assert.match(dev.labelEn(), /Privacy mode OFF/);
  assert.equal(dev.toggle(), true);
  assert.equal(dev.labelHe(), 'מצב פרטיות פועל');

  // A destructured handler must behave the same as a method call.
  const { toggle } = dev;
  assert.equal(toggle(), false);
  assert.equal(dev.enabled, false);
});

test('only genuine dev hosts are unlocked — a lookalike domain is production', () => {
  for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'atidim.local', 'LOCALHOST']) {
    assert.equal(R.isDevHost(host), true, host + ' is a dev host');
  }
  for (const host of ['localhost.attacker.example', 'parkwiz.co.il', 'atidim.local.example', '10.0.0.4', '', null]) {
    assert.equal(R.isDevHost(host), false, host + ' is production');
  }
  // The field kit is also run straight off a USB stick, which has no hostname.
  assert.equal(R.isDevHost('', 'file:'), true);
});

test('an unreadable environment counts as production, so the toggle stays locked', () => {
  for (const env of [undefined, {}, { hostname: undefined }, { hostname: null }]) {
    const mode = R.createPrivacyMode(env);
    assert.equal(mode.enabled, true);
    assert.equal(mode.locked, true, 'unknown host must not unlock the toggle');
  }
});
