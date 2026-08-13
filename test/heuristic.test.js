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
  assert.ok(Math.abs(s.median - 80) < 1e-9);
  assert.ok(s.mad < 1e-9);
});

test('statsFromRgba default stride matches the kit (every 4th pixel)', () => {
  const data = rgbaFill(8, 10, 10, 10);
  const s = h.statsFromRgba(data);
  assert.equal(s.n, 2);
  assert.equal(h.SAMPLE_STRIDE, 16);
});

test('empty / junk buffers do not throw', () => {
  const empty = h.statsFromRgba(null);
  assert.equal(empty.n, 0);
  assert.equal(empty.mean, 0);
  assert.equal(h.statsFromRgba(new Uint8ClampedArray(0)).n, 0);
  assert.equal(h.estimateOccupied(null), null);
  assert.equal(h.estimateOccupied({ mean: 'x', variance: 1 }), null);
});

test('vs-empty-normalized flags a dark car-like patch against pale asphalt', () => {
  const empty = { mean: 140, variance: 20, mad: 3, p10: 136, p90: 144 };
  const car = { mean: 35, variance: 80, mad: 14, p10: 20, p90: 55 };
  const r = h.estimateOccupied(car, empty);
  assert.equal(r.method, 'vs-empty-normalized');
  assert.equal(r.occupied, true);
  assert.equal(r.heuristic, true);
  assert.equal(r.confidence, h.CONF_VS_EMPTY_NORM);
});

test('vs-empty-normalized keeps a matching empty patch free', () => {
  const empty = { mean: 140, variance: 20, mad: 3, p10: 136, p90: 144 };
  const same = { mean: 141, variance: 22, mad: 3.1, p10: 137, p90: 145 };
  const r = h.estimateOccupied(same, empty);
  assert.equal(r.occupied, false);
  assert.ok(r.score < h.NORM_SCORE_CUTOFF);
});

test('lighting-shifted empty asphalt is not occupied after normalization', () => {
  const empty = { mean: 140, variance: 18, mad: 3, p10: 136, p90: 144 };
  const darker = { mean: 77, variance: 5.5, mad: 1.65, p10: 74.8, p90: 79.2 };
  const v2 = h.estimateOccupied(darker, empty);
  const v1 = h.estimateOccupiedLegacy(darker, empty);
  assert.equal(v2.occupied, false);
  assert.equal(v1.occupied, true);
  assert.equal(v2.method, 'vs-empty-normalized');
});

test('legacy vs-empty-frame still flags a dark car (v1 contract)', () => {
  const empty = { mean: 140, variance: 20 };
  const car = { mean: 35, variance: 80 };
  const r = h.estimateOccupiedLegacy(car, empty);
  assert.equal(r.method, 'vs-empty-frame');
  assert.equal(r.occupied, true);
  assert.ok(r.score >= h.EMPTY_SCORE_CUTOFF);
});

test('absolute-threshold flags a dark or high-variance day patch without a reference', () => {
  const dark = h.estimateOccupied({ mean: 40, variance: 10, mad: 2 }, null, { lighting: 'day' });
  assert.equal(dark.method, 'absolute-threshold');
  assert.equal(dark.occupied, true);
  assert.equal(dark.confidence, h.CONF_ABSOLUTE);
  assert.equal(dark.heuristic, true);

  const busy = h.estimateOccupied({ mean: 120, variance: 1600, mad: 30 }, null, { lighting: 'day' });
  assert.equal(busy.occupied, true);

  const pale = h.estimateOccupied({ mean: 130, variance: 40, mad: 4 }, null, { lighting: 'day' });
  assert.equal(pale.occupied, false);
});

test('night absolute fallback does not mark dark empty asphalt occupied', () => {
  const nightEmpty = { mean: 26, variance: 12, mad: 2.2, p10: 23, p90: 29 };
  const r = h.estimateOccupied(nightEmpty, null, { lighting: 'night' });
  assert.equal(r.method, 'absolute-threshold');
  assert.equal(r.occupied, false);
  const legacy = h.estimateOccupiedLegacy(nightEmpty, null);
  assert.equal(legacy.occupied, true);
});

test('night absolute fallback flags structured headlights / windows', () => {
  const nightCar = { mean: 22, variance: 520, mad: 16, p10: 8, p90: 80 };
  const r = h.estimateOccupied(nightCar, null, { lighting: 'night' });
  assert.equal(r.occupied, true);
});

test('classifyLighting uses the documented luma bands', () => {
  assert.equal(h.classifyLighting(20), 'night');
  assert.equal(h.classifyLighting(50), 'dusk');
  assert.equal(h.classifyLighting(120), 'day');
});

test('aligned background subtraction detects a painted car and ignores a gain-only shift', () => {
  const empty = rgbaFill(64, 140, 140, 140);
  const car = rgbaFill(64, 140, 140, 140);
  for (let i = 0; i < 32; i++) {
    car[i * 4] = 20;
    car[i * 4 + 1] = 22;
    car[i * 4 + 2] = 28;
  }
  const dim = rgbaFill(64, 77, 77, 77);
  const emptyS = h.lumaSamples(empty, 4);
  const carS = h.lumaSamples(car, 4);
  const dimS = h.lumaSamples(dim, 4);
  const hit = h.estimateOccupied(h.statsFromSamples(carS), h.statsFromSamples(emptyS), {
    lighting: 'day',
    curSamples: carS,
    emptySamples: emptyS,
  });
  const miss = h.estimateOccupied(h.statsFromSamples(dimS), h.statsFromSamples(emptyS), {
    lighting: 'day',
    curSamples: dimS,
    emptySamples: emptyS,
  });
  assert.equal(hit.method, 'bg-subtract-normalized');
  assert.equal(hit.occupied, true);
  assert.equal(miss.occupied, false);
});

test('per-spot night reference is preferred over a day empty frame', () => {
  const dayEmpty = { mean: 140, variance: 20, mad: 3, p10: 136, p90: 144 };
  const nightEmpty = { mean: 28, variance: 10, mad: 2, p10: 25, p90: 31 };
  const nightSame = { mean: 27, variance: 11, mad: 2.1, p10: 24, p90: 31 };
  const r = h.estimateOccupied(nightSame, dayEmpty, {
    lighting: 'night',
    emptyNight: nightEmpty,
  });
  assert.equal(r.method, 'vs-empty-normalized');
  assert.equal(r.occupied, false);
});

test('estimateLot labels the whole lot as heuristic and reports lighting', () => {
  const lot = h.estimateLot([
    { id: 's1', cur: { mean: 35, variance: 80, mad: 14, p10: 20, p90: 55 }, empty: { mean: 140, variance: 20, mad: 3, p10: 136, p90: 144 } },
    { id: 's2', cur: { mean: 141, variance: 21, mad: 3, p10: 137, p90: 145 }, empty: { mean: 140, variance: 20, mad: 3, p10: 136, p90: 144 } },
  ], { lighting: 'day' });
  assert.equal(lot.source, 'heuristic-occupancy');
  assert.equal(lot.heuristic, true);
  assert.equal(lot.total, 2);
  assert.equal(lot.occupied, 1);
  assert.equal(lot.lighting, 'day');
});

test('methodConfidence knows the v2 methods and rejects a neural net', () => {
  assert.equal(h.methodConfidence('bg-subtract-normalized'), h.CONF_BG_SUBTRACT);
  assert.equal(h.methodConfidence('vs-empty-normalized'), h.CONF_VS_EMPTY_NORM);
  assert.equal(h.methodConfidence('vs-empty-frame'), 0.45);
  assert.equal(h.methodConfidence('absolute-threshold'), 0.25);
  assert.equal(h.methodConfidence('neural-net'), 0);
});

test('pilot-kit calls the shared heuristic instead of an inline copy', () => {
  const kit = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');
  assert.match(kit, /src="src\/lib\/heuristic\.js"/);
  assert.match(kit, /ParkWizHeuristic/);
  assert.match(kit, /statsFromRgba/);
  assert.match(kit, /estimateOccupied|estimateLot/);
  assert.doesNotMatch(kit, /0\.2126 \* data\[i\] \+ 0\.7152/);
});
