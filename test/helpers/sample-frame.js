// A synthetic camera frame for the redaction tests.
//
// Built in code rather than shipped as a PNG so the test can state exactly
// which pixels are a face and which are a plate, and then assert those exact
// pixels are located (and, once the redactor lands, destroyed).
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
  sampleFrame, fill, pixelAt,
};
