// The occupancy document CityZone may receive. Camera readings carry geometry
// and sometimes a crop; none of that may survive. Unsure bays stay out of
// `free` so a dark frame cannot be reported as an empty lot.
const test = require('node:test');
const assert = require('node:assert/strict');

const cz = require('../src/lib/cityzone-occupancy');
const lot = require('../src/lib/atidim-lot');

test('confident readings become counts and allowlisted spots', () => {
  const payload = cz.occupancySnapshot([
    { id: 'A-01', occupied: true, confidence: 0.9, x: 0.1, y: 0.2, w: 0.3, h: 0.4, type: 'visitor' },
    { id: 'A-02', occupied: false, confidence: 0.8 },
  ], { timestamp: '2026-10-29T08:00:00Z' });
  assert.deepEqual(payload, {
    total: 2,
    occupied: 1,
    free: 1,
    spots: [
      { id: 'A-01', state: 'occupied' },
      { id: 'A-02', state: 'free' },
    ],
    timestamp: '2026-10-29T08:00:00Z',
  });
});

test('a low-confidence bay is counted in total and not called free', () => {
  const payload = cz.occupancySnapshot([
    { id: 'A-01', occupied: false, confidence: 0.2 },
    { id: 'A-02', occupied: true, confidence: 0.95 },
    { id: 'A-03', state: 'uncertain' },
  ]);
  assert.equal(payload.total, 3);
  assert.equal(payload.occupied, 1);
  assert.equal(payload.free, 0);
  assert.deepEqual(payload.spots, [{ id: 'A-02', state: 'occupied' }]);
  assert.equal(payload.timestamp, undefined);
});

test('missing confidence is treated as sure, matching the spot-freed tracker', () => {
  const payload = cz.occupancySnapshot([{ id: 'B-01', occupied: false }]);
  assert.deepEqual(payload.spots, [{ id: 'B-01', state: 'free' }]);
  assert.equal(payload.free, 1);
  assert.equal(cz.DEFAULT_MIN_CONFIDENCE, 0.6);
});

test('reserved and disabled bays are listed and not counted as free or occupied', () => {
  const payload = cz.occupancySnapshot([
    { id: 'C-01', state: 'reserved' },
    { id: 'C-02', state: 'disabled' },
    { id: 'C-03', state: 'free', occupied: false },
  ]);
  assert.equal(payload.total, 3);
  assert.equal(payload.occupied, 0);
  assert.equal(payload.free, 1);
  assert.deepEqual(payload.spots.map((s) => s.state), ['reserved', 'disabled', 'free']);
});

test('a camera view sheds geometry and keeps only id and state', () => {
  const spots = lot.createCameraSpots('cam-01', 10);
  const payload = cz.occupancySnapshot(spots, { timestamp: '2026-10-29T10:00:00Z' });
  assert.equal(payload.total, spots.length);
  assert.equal(payload.occupied + payload.free, payload.spots.length);
  for (const spot of payload.spots) {
    assert.deepEqual(Object.keys(spot).sort(), ['id', 'state']);
    assert.equal(typeof spot.id, 'string');
  }
  assert.equal(JSON.stringify(payload).includes('"x"'), false);
  assert.equal(JSON.stringify(payload).includes('RTSP'), false);
});

test('forbidden keys are rejected at the top level and nested', () => {
  assert.throws(
    () => cz.occupancySnapshot([{ id: 'A-01', occupied: true, plate: '12-345-67' }]),
    /forbidden field: plate/,
  );
  assert.throws(
    () => cz.occupancySnapshot([{ id: 'A-01', occupied: true, crop: { face_embedding: [1] } }]),
    /forbidden field: face_embedding/,
  );
  assert.throws(
    () => cz.occupancySnapshot([{ id: 'A-01', occupied: true }], { photoUrl: 'http://x' }),
    /forbidden field: photoUrl/,
  );
});

test('disagreement, duplicates, and bad shapes throw', () => {
  assert.throws(
    () => cz.occupancySnapshot([{ id: 'A-01', state: 'free', occupied: true }]),
    /disagrees/,
  );
  assert.throws(
    () => cz.occupancySnapshot([{ id: 'A-01', state: 'reserved', occupied: true }]),
    /reserved or disabled/,
  );
  assert.throws(
    () => cz.occupancySnapshot([
      { id: 'A-01', occupied: true },
      { id: 'A-01', occupied: false },
    ]),
    /duplicate spot id/,
  );
  assert.throws(() => cz.occupancySnapshot('nope'), /readings must be an array/);
  assert.throws(
    () => cz.occupancySnapshot([{ id: 'A-01', occupied: true, confidence: 2 }]),
    /confidence/,
  );
  assert.throws(
    () => cz.occupancySnapshot([], { timestamp: '' }),
    /timestamp/,
  );
});

test('an empty reading list is a zero snapshot', () => {
  assert.deepEqual(cz.occupancySnapshot([]), { total: 0, occupied: 0, free: 0, spots: [] });
});
