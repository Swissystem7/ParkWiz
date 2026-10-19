// A synthetic camera frame for the redaction tests.
//
// Built in code rather than shipped as a PNG so the test can state exactly
// which pixels are a face and which are a plate, and then assert those exact
// pixels no longer survive the redaction pass. Colours match the demo SVG
// frame in pilot/sample-lot-privacy.svg, so what the tests prove is what the
// operator sees on the page.
const ASPHALT = [92, 101, 112];    // #5c6570 — the lot surface
const CAR = [28, 31, 40];          // #1c1f28 — a car body
const SKIN = [198, 134, 66];       // #c68642 — a face
const FEATURE = [40, 28, 20];      // eyes and mouth — the identifying detail
const PLATE = [242, 208, 44];      // #f2d02c — an Israeli yellow plate
const GLYPH = [24, 24, 24];        // plate characters

function fill(frame, width, rect, rgb) {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * width + x) * 4;
      frame[i] = rgb[0];
      frame[i + 1] = rgb[1];
      frame[i + 2] = rgb[2];
      frame[i + 3] = 255;
    }
  }
}

function pixelAt(frame, width, x, y) {
  const i = (y * width + x) * 4;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

// Mean absolute spread of each channel inside a rect. A readable plate or face
// has texture; a redacted one is flat, so this number collapses.
function spread(frame, width, rect) {
  const sums = [0, 0, 0];
  let n = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const p = pixelAt(frame, width, x, y);
      sums[0] += p[0]; sums[1] += p[1]; sums[2] += p[2];
      n++;
    }
  }
  const mean = sums.map((s) => s / n);
  let dev = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const p = pixelAt(frame, width, x, y);
      dev += Math.abs(p[0] - mean[0]) + Math.abs(p[1] - mean[1]) + Math.abs(p[2] - mean[2]);
    }
  }
  return dev / (n * 3);
}

function countColour(frame, width, height, rgb, tolerance) {
  const tol = tolerance == null ? 6 : tolerance;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = pixelAt(frame, width, x, y);
      if (Math.abs(p[0] - rgb[0]) <= tol &&
          Math.abs(p[1] - rgb[1]) <= tol &&
          Math.abs(p[2] - rgb[2]) <= tol) n++;
    }
  }
  return n;
}

// One pedestrian face top-left, one parked car with a yellow plate bottom-centre.
function sampleFrame() {
  const width = 480;
  const height = 270;
  const frame = new Uint8ClampedArray(width * height * 4);
  const face = { x: 60, y: 54, w: 24, h: 30 };
  const plate = { x: 200, y: 186, w: 78, h: 18 };

  fill(frame, width, { x: 0, y: 0, w: width, h: height }, ASPHALT);
  fill(frame, width, { x: 174, y: 120, w: 132, h: 96 }, CAR);
  fill(frame, width, face, SKIN);
  // Eyes and mouth: the identifying detail that must not survive.
  fill(frame, width, { x: face.x + 4, y: face.y + 9, w: 5, h: 4 }, FEATURE);
  fill(frame, width, { x: face.x + 15, y: face.y + 9, w: 5, h: 4 }, FEATURE);
  fill(frame, width, { x: face.x + 7, y: face.y + 21, w: 10, h: 3 }, FEATURE);

  fill(frame, width, plate, PLATE);
  // Plate glyphs: the same, for the vehicle.
  for (let i = 0; i < 7; i++) {
    fill(frame, width, { x: plate.x + 5 + i * 10, y: plate.y + 4, w: 6, h: 10 }, GLYPH);
  }

  return { frame, width, height, face, plate };
}

module.exports = {
  ASPHALT, CAR, SKIN, FEATURE, PLATE, GLYPH,
  sampleFrame, fill, pixelAt, spread, countColour,
};
