// Backlog item 6: loadSampleOccupancy(manifest, labels) - a pure loader that
// takes the pilot manifest and labels as JSON *strings* and returns normalised
// occupancy records.
//
// No fs inside the function, no fetch, no clock, no localStorage. The test
// does read the two shipped files at the end, to prove the loader agrees with
// the dataset actually in the repo, but the loader itself only ever sees text.
//
// Every expected count below was taken from the labels by hand (a python3
// scratch script over pilot/dataset/labels.json) before the loader was
// written: 14 scenes, 44 occupied spots in total, 12 spots per scene.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ds = require('../src/lib/dataset');
const occ = require('../src/lib/occupancy');

const STREET = 'הרצל, נתניה';

const MANIFEST = JSON.stringify({
  version: 2,
  kind: 'parkwiz-demo-dataset',
  synthetic: true,
  fieldMeasured: false,
  street: STREET,
  patch: { width: 24, height: 32, spots: 4 },
  scenes: [
    { id: 'a', lighting: 'day', occupiedAt: [0, 1] },
    { id: 'b', lighting: 'night', occupiedAt: [] },
    // the manifest disagrees with the labels here on purpose
    { id: 'c', lighting: 'wet', occupiedAt: [0, 1, 2, 3] },
    { id: 'no-label', lighting: 'day', occupiedAt: [0] },
  ],
});

const LABELS = JSON.stringify({
  version: 2,
  kind: 'parkwiz-demo-labels',
  synthetic: true,
  scenes: [
    { id: 'a', occupiedAt: [0, 1] },
    { id: 'b', occupiedAt: [] },
    { id: 'c', occupiedAt: [3] },
  ],
});

test('the loader returns exactly the records the labels describe', () => {
  assert.deepEqual(ds.loadSampleOccupancy(MANIFEST, LABELS), [
    { ts: '', street: STREET, total: 4, occupied: 2, source: 'dataset-label', confidence: 0, scene: 'a', lighting: 'day' },
    { ts: '', street: STREET, total: 4, occupied: 0, source: 'dataset-label', confidence: 0, scene: 'b', lighting: 'night' },
    { ts: '', street: STREET, total: 4, occupied: 1, source: 'dataset-label', confidence: 0, scene: 'c', lighting: 'wet' },
  ]);
});

test('the labels are the ground truth, not the manifest', () => {
  // manifest scene 'c' claims all four spots are taken, the label says one.
  const recs = ds.loadSampleOccupancy(MANIFEST, LABELS);
  assert.equal(recs.find((r) => r.scene === 'c').occupied, 1);
});

test('a scene with no label is skipped, because it is not a measurement', () => {
  const recs = ds.loadSampleOccupancy(MANIFEST, LABELS);
  assert.equal(recs.length, 3);
  assert.equal(recs.some((r) => r.scene === 'no-label'), false);
});

test('the records are marked as labels, never as a reading', () => {
  for (const r of ds.loadSampleOccupancy(MANIFEST, LABELS)) {
    assert.equal(r.source, 'dataset-label');
    assert.equal(r.confidence, 0);
  }
});

// One-scene, four-spot lot whose only label entry is the value under test.
const oneEntry = (value) => ds.loadSampleOccupancy(
  MANIFEST,
  JSON.stringify({ scenes: [{ id: 'a', occupiedAt: [value] }] })
);

test('repeated and out-of-lot label indices are not evidence', () => {
  const labels = JSON.stringify({
    scenes: [{ id: 'a', occupiedAt: [0, 0, 1, 9, -1, '2', 2.5, null] }],
  });
  const recs = ds.loadSampleOccupancy(MANIFEST, labels);
  assert.equal(recs.length, 1);
  // 0 and 1 (0 counted once), plus '2'; 9 and -1 are outside a 4-spot lot,
  // 2.5 is not a spot index, null is nothing.
  assert.equal(recs[0].occupied, 3);
});

test('a label entry that is not a number names no spot', () => {
  // Every value here is an integer in [0, 4) once it goes through Number():
  //   Number(null) === Number('') === Number(false) === Number([])
  //     === Number('  ') === 0
  //   Number(true) === Number('1e0') === 1
  //   Number('0x2') === 2
  // Measured against the shipped module before this was fixed, each of the
  // eight reported occupied = 1 out of 4 for a lot nobody had labelled. The
  // count above is not evidence, so it must be 0.
  for (const value of [null, '', false, [], '  ', true, '0x2', '1e0']) {
    const recs = oneEntry(value);
    assert.equal(recs.length, 1, JSON.stringify(value));
    assert.equal(recs[0].total, 4);
    assert.equal(recs[0].occupied, 0, JSON.stringify(value) + ' must name no spot');
  }
  // the two that were already discarded, kept here so the rule stays whole
  for (const value of [{}, 'abc']) {
    assert.equal(oneEntry(value)[0].occupied, 0, JSON.stringify(value));
  }
});

test('a real number and a plain decimal-integer string are still evidence', () => {
  for (const value of [0, 1, 3, '0', '2', '03']) {
    assert.equal(oneEntry(value)[0].occupied, 1, JSON.stringify(value) + ' names a spot');
  }
  // ...and the shapes that are neither still are not. (NaN and Infinity are
  // absent on purpose: JSON.stringify writes them as null, so a JSON *text*
  // - the only thing this loader ever sees - cannot carry them.)
  for (const value of [2.5, 9, -1, '-1', ' 2', '2 ', '+2', '2.0']) {
    assert.equal(oneEntry(value)[0].occupied, 0, JSON.stringify(value) + ' names no spot');
  }
});

test('a scene timestamp is carried through, and an impossible one is dropped', () => {
  const withTs = JSON.stringify({
    street: STREET,
    patch: { spots: 4 },
    scenes: [
      { id: 'a', lighting: 'day', ts: '2026-08-12T08:00' },
      { id: 'b', lighting: 'day', ts: '2026-02-30T08:00' },
    ],
  });
  const labels = JSON.stringify({ scenes: [{ id: 'a', occupiedAt: [0] }, { id: 'b', occupiedAt: [1] }] });
  const recs = ds.loadSampleOccupancy(withTs, labels);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].ts, '2026-08-12T08:00');
  assert.equal(occ.tsProblem('2026-02-30T08:00'), 'impossible-date');
});

test('text that is not a usable dataset gives an empty list, not a throw', () => {
  for (const [m, l] of [
    ['not json', LABELS],
    [MANIFEST, 'not json'],
    ['', ''],
    [null, LABELS],
    [undefined, undefined],
    [MANIFEST, JSON.stringify([1, 2, 3])],
    [JSON.stringify({ street: STREET, scenes: [] }), LABELS],
    [JSON.stringify({ street: STREET, patch: { spots: 0 }, scenes: [{ id: 'a' }] }), LABELS],
  ]) {
    assert.deepEqual(ds.loadSampleOccupancy(m, l), [], JSON.stringify([m, l]).slice(0, 60));
  }
});

test('the loader is pure: same strings in, same records out, nothing kept', () => {
  const first = ds.loadSampleOccupancy(MANIFEST, LABELS);
  const second = ds.loadSampleOccupancy(MANIFEST, LABELS);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  first[0].occupied = 99;
  assert.equal(ds.loadSampleOccupancy(MANIFEST, LABELS)[0].occupied, 2);
});

test('the shipped manifest and labels load into the 14 scenes we labelled', () => {
  const root = path.join(__dirname, '..', 'pilot', 'dataset');
  const recs = ds.loadSampleOccupancy(
    fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
    fs.readFileSync(path.join(root, 'labels.json'), 'utf8')
  );
  assert.equal(recs.length, 14);
  assert.deepEqual(recs.map((r) => r.scene), [
    'day-empty', 'day-mixed', 'day-full', 'dusk-mixed', 'night-empty',
    'night-mixed', 'wet-mixed', 'day-shifted-empty', 'white-car-day',
    'night-shifted-empty', 'shadow-false', 'glare-false', 'camouflage-day',
    'tiny-car-day',
  ]);
  assert.deepEqual(recs.map((r) => r.occupied), [0, 6, 12, 6, 0, 6, 6, 0, 2, 0, 0, 0, 3, 3]);
  assert.equal(recs.reduce((s, r) => s + r.occupied, 0), 44);
  for (const r of recs) {
    assert.equal(r.total, 12);
    assert.equal(r.street, STREET);
    assert.equal(r.source, 'dataset-label');
  }
});

test('the loaded records are the schema the rest of the pilot code reads', () => {
  const root = path.join(__dirname, '..', 'pilot', 'dataset');
  const recs = ds.loadSampleOccupancy(
    fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
    fs.readFileSync(path.join(root, 'labels.json'), 'utf8')
  );
  const s = occ.summarize(recs);
  assert.equal(s.count, 14);
  assert.equal(s.peak.occupied, 12);
  assert.equal(s.low.occupied, 0);
  // 44 occupied spots over 14 scenes of 12 spots each
  assert.equal(s.avg, 44 / 12 / 14);
  assert.equal(s.conf, 0);
  assert.deepEqual(s.sources, ['dataset-label']);
});
