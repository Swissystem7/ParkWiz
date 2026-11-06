'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/lib/occupancy-boundary');
const VO = require('../src/lib/vision-occupancy');
const CZ = require('../src/lib/cityzone-connector');

const T0 = Date.parse('2026-11-06T10:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
// Synthetic fixtures only: invented cell ids and timestamps, no media/PII.
const freshFree = { id: 'A-01', status: 'free', ts: iso(T0), confidence: 0.9 };
const freshOcc = { id: 'A-02', status: 'occupied', ts: iso(T0), confidence: 0.9 };

test('fresh confident cells keep free/occupied with per-cell id+status+ts', () => {
  const out = B.serializeSnapshot({ ts: iso(T0), cells: [freshFree, freshOcc] }, { now: T0 + 1000 });
  assert.deepEqual(out, { ts: iso(T0), cells: [
    { id: 'A-01', status: 'free', ts: iso(T0) },
    { id: 'A-02', status: 'occupied', ts: iso(T0) },
  ] });
});

test('stale >60s is unknown; exactly 60s is still known', () => {
  const at60 = B.serializeCell(freshFree, { now: T0 + 60000 });
  assert.equal(at60.status, 'free');
  const over = B.serializeCell(freshFree, { now: T0 + 60001 });
  assert.equal(over.status, 'unknown');
});

test('uncertain, low/missing/non-finite confidence, bad state => unknown', () => {
  const cases = [
    { ...freshOcc, uncertain: true },
    { ...freshOcc, confidence: 0.49 },
    { id: 'A-02', status: 'occupied', ts: iso(T0) },
    { ...freshOcc, confidence: NaN },
    { ...freshOcc, confidence: 'high' },
    { ...freshOcc, status: 'reserved' },
    { ...freshOcc, status: 'maybe' },
  ];
  for (const c of cases) assert.equal(B.serializeCell(c, { now: T0 }).status, 'unknown', JSON.stringify(c));
});

test('missing, unparseable or future timestamp => unknown', () => {
  for (const ts of [undefined, '', 'not-a-date', iso(T0 + 1)]) {
    const cell = B.serializeCell({ id: 'A-01', status: 'free', confidence: 1, ts }, { now: T0 });
    assert.equal(cell.status, 'unknown');
  }
  assert.equal(B.serializeCell({ id: 'A-01', status: 'free', confidence: 1 }, { now: T0 }).ts, null);
});

test('boolean occupied maps to status; cells without id are dropped', () => {
  const out = B.serializeSnapshot([
    { id: 'A-01', occupied: true, ts: iso(T0), confidence: 1 },
    { id: 'A-02', occupied: false, ts: iso(T0), confidence: 1 },
    { status: 'free', ts: iso(T0), confidence: 1 },
    { id: '  ', status: 'free', ts: iso(T0), confidence: 1 },
  ], { now: T0 });
  assert.deepEqual(out.cells.map((c) => [c.id, c.status]), [['A-01', 'occupied'], ['A-02', 'free']]);
});

test('strict allowlist: plates/frames/images/geometry never serialize, even under long names', () => {
  const dirty = {
    ts: iso(T0), licencePlateNumber: 'SYNTHETIC-PLATE', frameData: 'AAAA', rawImage: {}, videoUrl: 'x',
    spots: [{ id: 'A-01', status: 'free', ts: iso(T0), confidence: 0.9,
      plate: 'P', license_plate: 'P', image: 'i', frame: 'f', x: 0.1, y: 0.2, w: 0.3, h: 0.4, score: 0.9,
      nested: { vehicleIdentificationNumber: 'V', faceEmbedding: [1] } }],
  };
  const out = B.serializeSnapshot(dirty, { now: T0 });
  assert.deepEqual(Object.keys(out).sort(), ['cells', 'ts']);
  assert.deepEqual(Object.keys(out.cells[0]).sort(), ['id', 'status', 'ts']);
  const json = JSON.stringify(out);
  for (const leak of ['SYNTHETIC-PLATE', 'AAAA', 'plate', 'frame', 'image', 'nested', 'score']) {
    assert.ok(!json.includes(leak), 'leaked ' + leak);
  }
});

test('vision tracker adapter: unobserved and pre-debounce cells are unknown, debounced parked car is occupied', () => {
  const spots = [{ id: 'A-01', x: 0.05, y: 0.4, w: 0.2, h: 0.25 }];
  const tracker = VO.createTracker(spots);
  // No frame yet: tracker snapshot alone must not claim free.
  let pub = B.fromVisionSnapshot(tracker.snapshot(iso(T0)), { now: T0 });
  assert.equal(pub.cells[0].status, 'unknown');
  const car = [{ x: 0.06, y: 0.42, w: 0.18, h: 0.21, cls: 'car', score: 0.9 }];
  tracker.update(car, iso(T0));
  pub = B.fromVisionSnapshot(tracker.snapshot(iso(T0)), { now: T0 });
  assert.equal(pub.cells[0].status, 'unknown', 'one frame is not yet debounced');
  tracker.update(car, iso(T0)); tracker.update(car, iso(T0));
  pub = B.fromVisionSnapshot(tracker.snapshot(iso(T0)), { now: T0 });
  assert.equal(pub.cells[0].status, 'occupied');
  // Same reading viewed 61s later is stale.
  pub = B.fromVisionSnapshot(tracker.snapshot(iso(T0)), { now: T0 + 61000 });
  assert.equal(pub.cells[0].status, 'unknown');
});

test('vision tracker adapter: debounced empty lot reads free', () => {
  const tracker = VO.createTracker([{ id: 'A-01', x: 0.05, y: 0.4, w: 0.2, h: 0.25 }]);
  let s;
  for (let i = 0; i < 3; i++) s = tracker.update([], iso(T0));
  assert.equal(B.fromVisionSnapshot(s, { now: T0 }).cells[0].status, 'free');
});

test('boundary output flows through CityZone connector with unknown + per-cell ts, nothing else', () => {
  const pub = B.serializeSnapshot({ ts: iso(T0), cells: [freshFree, { ...freshOcc, confidence: 0.1 }] }, { now: T0 });
  const snap = B.toCityZoneSnapshot(pub);
  assert.equal(snap.total, 2); assert.equal(snap.occupied, 0); assert.equal(snap.free, 1);
  const c = CZ.createCityZoneConnector();
  assert.deepEqual(c.pushOccupancy('lot-synthetic', snap), { accepted: true });
  const payload = c.transport.calls[0].payload;
  assert.deepEqual(payload.spots, [
    { id: 'A-01', state: 'free', ts: iso(T0) },
    { id: 'A-02', state: 'unknown', ts: iso(T0) },
  ]);
});
