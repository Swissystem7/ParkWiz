// The acceptance test for issue #281, on the frame the operator actually loads:
// pilot/sample-lot-privacy.svg must come out of the pipeline with its faces and
// plates destroyed, the existing demo frames must not pick up false positives,
// and the occupancy number — the only thing the pilot ships to the city — must
// be the same before and after redaction.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = require('../src/lib/redact.js');
const HEU = require('../src/lib/heuristic.js');
const { rasterSvg } = require('./helpers/svg-raster.js');
const { countColour } = require('./helpers/sample-frame.js');

const root = path.join(__dirname, '..');
const frameOf = (name) => rasterSvg(fs.readFileSync(path.join(root, 'pilot', name), 'utf8'));

// Planted in the demo frame: the yellow plate field, two skin tones, and the
// plate glyphs. The facial features are deliberately not counted — #281c14 is
// within tolerance of two of the car-body fills, so it would score the dark
// cars rather than the faces.
const PLATE_YELLOW = [242, 208, 44];
const SKIN_A = [198, 134, 66];
const SKIN_B = [181, 122, 82];
const GLYPH = [24, 24, 24];

function sensitivePixels(frame, width, height) {
  return [PLATE_YELLOW, SKIN_A, SKIN_B, GLYPH]
    .reduce((n, rgb) => n + countColour(frame, width, height, rgb), 0);
}

test('the privacy demo frame really does contain faces and plates to find', () => {
  const { frame, width, height } = frameOf('sample-lot-privacy.svg');
  assert.equal(width, 800);
  assert.equal(height, 480);
  assert.ok(sensitivePixels(frame, width, height) > 5000,
    'the fixture would prove nothing if it had no sensitive pixels');
});

test('the privacy demo frame redacts both pedestrian faces and all five plates', () => {
  const { frame, width, height } = frameOf('sample-lot-privacy.svg');
  const found = R.detectRegions(frame, width, height);

  assert.equal(found.faces.length, 2, 'the two pedestrians crossing the aisle');
  assert.equal(found.plates.length, 5, 'one rear plate per parked car');

  const report = R.redactFrame(frame, width, height);
  assert.equal(report.regions, 7);
  assert.equal(sensitivePixels(frame, width, height), 0,
    'not one face or plate pixel survives the pass the page runs');
});

test('the existing demo frames gain no false positives, so the current demo still reads', () => {
  for (const name of ['sample-lot.svg', 'sample-empty.svg', 'sample-lot-night.svg',
    'sample-lot-dusk.svg', 'sample-lot-wet.svg', 'sample-lot-white.svg', 'sample-empty-night.svg']) {
    const { frame, width, height } = frameOf(name);
    const before = Uint8ClampedArray.from(frame);
    const report = R.redactFrame(frame, width, height);
    assert.equal(report.regions, 0, name + ' has nothing to redact');
    assert.deepEqual([...frame], [...before], name + ' is passed through byte-for-byte');
  }
});

// Requirement from the issue: "Spot-occupancy detection keeps working on the
// redacted frames". ParkWiz redacts first and measures second, so this is the
// assertion the park cares about — privacy costs the pilot no accuracy.
test('the occupancy estimate is identical on the raw and the redacted frame', () => {
  const spots = JSON.parse(fs.readFileSync(path.join(root, 'pilot', 'sample-spots.json'), 'utf8')).spots;

  function spotRgba(frame, width, height, spot) {
    const r = HEU.spotPixelRect(spot, width, height);
    if (!r) return null;
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) {
      const from = ((r.y + y) * width + r.x) * 4;
      out.set(frame.subarray(from, from + r.w * 4), y * r.w * 4);
    }
    return out;
  }

  function estimate(cur, empty) {
    const items = spots.map((spot) => {
      const c = spotRgba(cur.frame, cur.width, cur.height, spot);
      const e = spotRgba(empty.frame, empty.width, empty.height, spot);
      return {
        id: spot.id,
        cur: c && HEU.statsFromRgba(c, HEU.SAMPLE_STRIDE),
        empty: e && HEU.statsFromRgba(e, HEU.SAMPLE_STRIDE),
        curSamples: c && HEU.lumaSamples(c, HEU.SAMPLE_STRIDE),
        emptySamples: e && HEU.lumaSamples(e, HEU.SAMPLE_STRIDE),
      };
    });
    return HEU.estimateLot(items);
  }

  const empty = frameOf('sample-empty.svg');
  const raw = frameOf('sample-lot-privacy.svg');
  const redacted = frameOf('sample-lot-privacy.svg');
  R.redactFrame(redacted.frame, redacted.width, redacted.height);

  const before = estimate(raw, empty);
  const after = estimate(redacted, empty);

  assert.equal(after.total, 12);
  assert.equal(after.occupied, before.occupied, 'same occupied count after redaction');
  assert.deepEqual(
    after.estimates.map((e) => e.occupied),
    before.estimates.map((e) => e.occupied),
    'and the same verdict bay by bay',
  );
});
