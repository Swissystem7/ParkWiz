const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ds = require('../src/lib/dataset');

test('manifest is explicitly synthetic and not a field measurement', () => {
  const m = ds.manifest();
  assert.equal(m.kind, 'parkwiz-demo-dataset');
  assert.equal(m.synthetic, true);
  assert.equal(m.fieldMeasured, false);
  assert.ok(m.note.includes('לא צילום עירייה'));
  assert.equal(m.scenes.length, 14);
  assert.equal(m.patch.spots, 12);
});

test('day-mixed labels match the shipped sample-lot car indices', () => {
  assert.deepEqual(ds.MIXED_CARS, [0, 2, 3, 6, 9, 10]);
  const mixed = ds.SCENE_DEFS.find((s) => s.id === 'day-mixed');
  assert.deepEqual(mixed.occupiedAt, ds.MIXED_CARS);
});

test('generated scenes carry ground truth on every spot', () => {
  const scenes = ds.scenes();
  assert.equal(scenes.length, 14);
  scenes.forEach((s) => {
    assert.equal(s.synthetic, true);
    assert.equal(s.fieldMeasured, false);
    assert.equal(s.spots.length, 12);
    s.spots.forEach((sp) => {
      assert.equal(typeof sp.occupied, 'boolean');
      assert.equal(sp.cur.length, ds.PATCH_W * ds.PATCH_H * 4);
    });
  });
});

test('v2 is more accurate than v1 on the synthetic set and stays honest', () => {
  const cmp = ds.compareMethods();
  assert.equal(cmp.kind, 'synthetic-demo-compare');
  assert.equal(cmp.fieldMeasured, false);
  assert.equal(cmp.v2.fieldMeasured, false);
  assert.equal(cmp.v2.kind, 'synthetic-demo');
  assert.ok(cmp.v2.n >= 160);
  assert.ok(cmp.v2.rate > cmp.legacy.rate);
  assert.ok(cmp.v2.rate >= 0.75);
  assert.ok(cmp.v2.rate < 1, 'a perfect score on our own traps would hide failure modes');
  assert.ok(cmp.wilson || cmp.v2.wilson);
});

test('lighting-shifted empty scenes stay free under v2 and fail under v1', () => {
  const scenes = ds.scenes();
  const shifted = scenes.find((s) => s.id === 'day-shifted-empty');
  const v2 = ds.evaluateScene(shifted, 'v2');
  const v1 = ds.evaluateScene(shifted, 'legacy');
  assert.equal(v2.agree, 12);
  assert.ok(v1.agree < 12);
});

test('night empty without a reference is a v1 false-positive and stays free in v2', () => {
  const h = require('../src/lib/heuristic');
  const night = ds.scenes().find((s) => s.id === 'night-empty');
  night.spots.forEach((sp) => {
    const cur = h.statsFromRgba(sp.cur);
    const v2 = h.estimateOccupied(cur, null, { lighting: 'night' });
    const v1 = h.estimateOccupiedLegacy(cur, null);
    assert.equal(v2.occupied, false);
    assert.equal(v1.occupied, true);
  });
});

test('day-mixed with background subtraction is at least 11/12', () => {
  const mixed = ds.scenes().find((s) => s.id === 'day-mixed');
  const v2 = ds.evaluateScene(mixed, 'v2');
  assert.ok(v2.agree >= 11);
  assert.equal(v2.method, 'bg-subtract-normalized');
});

test('shipped dataset files stay labeled sample/synthetic', () => {
  const root = path.join(__dirname, '..', 'pilot', 'dataset');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const labels = JSON.parse(fs.readFileSync(path.join(root, 'labels.json'), 'utf8'));
  assert.equal(manifest.synthetic, true);
  assert.equal(manifest.fieldMeasured, false);
  assert.equal(labels.synthetic, true);
  assert.ok(labels.scenes.every((s) => Array.isArray(s.occupiedAt)));
});
