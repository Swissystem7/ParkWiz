// adapter.js + assign.js agree on the 18-bay Atidim board (demo/atidim-data.json: 6 cols x 3 rows).
// The bay ids come from the same labelGrid() the board page uses (A-01 .. C-06), so the
// assignment service and the board talk about the same bays.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const board = require(path.join(__dirname, '..', 'demo', 'atidim-data.json'));
const { labelGrid } = require('../src/lib/spot-freed');
const { parseBody } = require('../src/lib/occupancy-assign/adapter');
const { createService, zoneOf, etaSeconds } = require('../src/lib/occupancy-assign/assign');

const TS = '2026-10-18T09:00:00.000Z';
const FRAME = '2026-10-18_09_00_00.jpg';
const BAYS = labelGrid(board.cols, board.rows);

function allFreeSpots() {
  return BAYS.map((id) => ({ spot_id: id, status: 'free', ts: TS }));
}

function serviceWith(body) {
  const svc = createService({ now: () => Date.parse(TS) + 1000 });
  const parsed = parseBody(body);
  svc.apply(parsed.updates);
  return { svc, parsed };
}

test('the board data describes 18 bays, labelled A-01..C-06', () => {
  assert.equal(board.cols * board.rows, 18);
  assert.equal(BAYS.length, 18);
  assert.equal(new Set(BAYS).size, 18);
  assert.equal(BAYS[0], 'A-01');
  assert.equal(BAYS[17], 'C-06');
});

test('every board bay passes the adapter unchanged and lands in its row zone', () => {
  const { svc, parsed } = serviceWith({ spots: allFreeSpots() });
  assert.deepEqual(parsed.updates.map((u) => u.spotId), BAYS);
  assert.ok(parsed.updates.every((u) => u.status === 'free' && u.ts === Date.parse(TS)));
  const snap = svc.snapshot();
  assert.deepEqual(Object.keys(snap).sort(), BAYS.slice().sort());
  for (const id of BAYS) assert.equal(snap[id].zone, id[0], id + ' zone');
  for (const id of BAYS) assert.equal(zoneOf(id), id[0]);
});

test('simple list and pipeline frame of the same 18 bays give the same state and the same pick', () => {
  const occupied = BAYS.filter((_, i) => i % 3 === 0);
  const free = BAYS.filter((_, i) => i % 3 !== 0);
  const simple = BAYS.map((id) => ({ spot_id: id, status: occupied.includes(id) ? 'occupied' : 'free', ts: TS }));
  const a = serviceWith({ spots: simple, driver: { entry: 'north' } });
  const b = serviceWith({ frames: [{ frame: FRAME, occupied, free }], driver: { entry: 'north' } });
  const strip = (snap) => Object.fromEntries(Object.entries(snap).map(([k, v]) => [k, v.status + '/' + v.zone]));
  assert.deepEqual(strip(a.svc.snapshot()), strip(b.svc.snapshot()));
  assert.deepEqual(a.svc.assign(a.parsed.driver), b.svc.assign(b.parsed.driver));
});

test('the pick is the lowest ETA bay, and its ETA is what etaSeconds says', () => {
  for (const entry of ['north', 'south', 'east', 'west', null]) {
    const { svc } = serviceWith({ spots: allFreeSpots() });
    const driver = { entry, zone: null };
    const got = svc.assign(driver);
    const expected = BAYS.map((id) => ({ id, eta: etaSeconds(id, zoneOf(id), driver) }))
      .sort((x, y) => x.eta - y.eta || (x.id < y.id ? -1 : 1))[0];
    assert.equal(got.spot, expected.id, 'entry ' + entry);
    assert.equal(got.eta, expected.eta);
    assert.equal(got.zone, expected.id[0]);
  }
});

test('north entry starts in row A, south entry in row C', () => {
  assert.equal(serviceWith({ spots: allFreeSpots() }).svc.assign({ entry: 'north', zone: null }).spot, 'A-01');
  assert.equal(serviceWith({ spots: allFreeSpots() }).svc.assign({ entry: 'south', zone: null }).spot, 'C-01');
});

test('a zone filter only returns bays of that row', () => {
  const { svc } = serviceWith({ spots: allFreeSpots(), driver: { zone: 'B' } });
  for (let i = 0; i < 6; i++) assert.equal(svc.assign({ entry: null, zone: 'b' }).zone, 'B');
  assert.throws(() => svc.assign({ entry: null, zone: 'B' }), (err) => err.status === 409 && err.code === 'NO_FREE_SPOT');
});

test('18 drivers fill all 18 bays exactly once, the 19th gets 409', () => {
  const { svc } = serviceWith({ spots: allFreeSpots() });
  const picked = [];
  for (let i = 0; i < 18; i++) picked.push(svc.assign({ entry: 'north', zone: null }).spot);
  assert.deepEqual(picked.slice().sort(), BAYS.slice().sort());
  assert.ok(Object.values(svc.snapshot()).every((s) => s.status === 'occupied'));
  assert.throws(() => svc.assign({ entry: 'north', zone: null }), (err) => err.status === 409);
});
