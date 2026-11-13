const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseBody } = require('../src/lib/occupancy-assign/adapter');
const {
  createService,
  zoneOf,
  etaSeconds,
  ETA_BASE_SEC,
  ETA_STALL_SEC,
  ETA_HOP_SEC,
} = require('../src/lib/occupancy-assign/assign');

const FIXTURE = path.join(__dirname, 'fixtures', 'pipeline-out.sample.json');
const FRAME_TS = Date.parse('2012-12-20T10:00:04.000Z');
const LATER_TS = Date.parse('2012-12-20T10:00:09.000Z');

function spot(id, status, ts) {
  return { spot_id: id, status, ts };
}

function driver(entry, zone) {
  return { entry: entry || null, zone: zone || null };
}

test('zone comes from a letter prefix; bare pipeline ids share main', () => {
  assert.equal(zoneOf('A-12'), 'A');
  assert.equal(zoneOf('A12'), 'A');
  assert.equal(zoneOf('B3-07'), 'B3');
  assert.equal(zoneOf('north/4'), 'north');
  assert.equal(zoneOf('A.1'), 'A');
  assert.equal(zoneOf('1'), 'main');
  assert.equal(zoneOf('20'), 'main');
  assert.equal(zoneOf('1.2'), 'main');
});

test('eta grows with the stall number and with cardinal hops off main', () => {
  assert.equal(etaSeconds('3', 'main', driver('north')), ETA_BASE_SEC + 3 * ETA_STALL_SEC);
  assert.equal(etaSeconds('C-1', 'C', driver('north')), ETA_BASE_SEC + ETA_STALL_SEC + 2 * ETA_HOP_SEC);
  assert.equal(etaSeconds('C-1', 'C', driver('south')), ETA_BASE_SEC + ETA_STALL_SEC);
  assert.equal(etaSeconds('A-1', 'A', driver('gate')), ETA_BASE_SEC + ETA_STALL_SEC + ETA_HOP_SEC);
  assert.equal(etaSeconds('A-1', 'A', driver()), ETA_BASE_SEC + ETA_STALL_SEC);
});

test('simple list: stale ts is ignored, equal ts replaces, newest wins in one batch', () => {
  const svc = createService({ now: () => 1000 });
  const t0 = Date.parse('2026-11-02T12:00:00.000Z');
  const parsed = parseBody({
    spots: [spot('A-1', 'free', '2026-11-02T12:00:00.000Z')],
    driver: { entry: 'north', zone: 'A' },
  });
  assert.equal(parsed.driver.zone, 'A');
  assert.equal(parsed.updates[0].ts, t0);
  const assigned = svc.ingestAndAssign(parsed.updates, parsed.driver);
  assert.deepEqual(assigned, { zone: 'A', spot: 'A-1', eta: ETA_BASE_SEC + ETA_STALL_SEC });
  assert.equal(svc.snapshot()['A-1'].status, 'occupied');

  const stale = parseBody([spot('A-1', 'free', '2026-11-02T11:00:00.000Z')]);
  assert.equal(svc.apply(stale.updates), 1);
  assert.equal(svc.snapshot()['A-1'].status, 'occupied');

  const same = parseBody([
    spot('B-1', 'occupied', '2026-11-02T12:00:00.000Z'),
    spot('B-1', 'free', '2026-11-02T12:00:00.000Z'),
  ]);
  svc.apply(same.updates);
  assert.equal(svc.snapshot()['B-1'].status, 'free');

  const batch = parseBody([
    spot('B-1', 'occupied', '2026-11-02T12:00:05.000Z'),
    spot('B-1', 'free', '2026-11-02T12:00:02.000Z'),
  ]);
  svc.apply(batch.updates);
  assert.equal(svc.snapshot()['B-1'].status, 'occupied');
});

test('zone filter is hard; entry only changes which free stall wins', () => {
  const svc = createService({ now: () => LATER_TS });
  svc.apply(parseBody([
    spot('A-2', 'free', '2026-11-02T12:00:00.000Z'),
    spot('B-1', 'free', '2026-11-02T12:00:00.000Z'),
    spot('C-1', 'free', '2026-11-02T12:00:00.000Z'),
  ]).updates);

  assert.equal(svc.assign(driver(null, 'a')).spot, 'A-2');
  assert.throws(() => svc.assign(driver(null, 'D')), (err) => err.code === 'NO_FREE_SPOT' && err.status === 409);

  const again = createService({ now: () => LATER_TS });
  again.apply(parseBody([
    spot('A-1', 'free', '2026-11-02T12:00:00.000Z'),
    spot('C-1', 'free', '2026-11-02T12:00:00.000Z'),
  ]).updates);
  const south = again.assign(driver('south'));
  assert.equal(south.spot, 'C-1');
  assert.equal(south.zone, 'C');
  assert.equal(south.eta, ETA_BASE_SEC + ETA_STALL_SEC);

  const tied = createService({ now: () => LATER_TS });
  tied.apply(parseBody([
    spot('B-1', 'free', '2026-11-02T12:00:00.000Z'),
    spot('A-1', 'free', '2026-11-02T12:00:00.000Z'),
  ]).updates);
  assert.equal(tied.assign(driver('gate')).spot, 'A-1');
});

test('the default clock claims a free stall', () => {
  const svc = createService();
  const got = svc.ingestAndAssign(
    parseBody([spot('1', 'free', '2026-11-02T12:00:00.000Z')]).updates,
    driver(),
  );
  assert.equal(got.spot, '1');
  assert.ok(svc.snapshot()['1'].ts >= Date.parse('2026-11-02T12:00:00.000Z'));
});

test('a claim blocks the same timestamp, and a later frame can free the stall', () => {
  const ts = Date.parse('2026-11-02T12:00:00.000Z');
  const svc = createService({ now: () => 1000 });
  svc.ingestAndAssign(parseBody([spot('3', 'free', '2026-11-02T12:00:00.000Z')]).updates, driver());
  assert.equal(svc.snapshot()['3'].ts, ts + 1);
  svc.apply(parseBody([spot('3', 'free', '2026-11-02T12:00:00.000Z')]).updates);
  assert.equal(svc.snapshot()['3'].status, 'occupied');
  svc.apply(parseBody([spot('3', 'free', '2026-11-02T12:00:05.000Z')]).updates);
  assert.equal(svc.snapshot()['3'].status, 'free');
  assert.equal(svc.assign(driver()).spot, '3');
});

test('pipeline fixture: filename clock, ignored assignment map, later frame frees a stall', () => {
  const frames = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(frames.length, 2);
  assert.equal(frames[0].frame, '2012-12-20_10_00_04.jpg');
  assert.equal(frames[0].occupied.length, 20);
  assert.deepEqual(frames[0].free, []);
  assert.deepEqual(frames[0].assignment, {});
  assert.equal(frames[0].unassigned.length, 10);
  assert.equal(frames[0].ms.total, 26.7);

  const first = parseBody(frames[0]);
  assert.equal(first.updates.length, 20);
  assert.equal(first.updates[0].ts, FRAME_TS);
  assert.equal(first.updates.every((u) => u.status === 'occupied'), true);

  const full = parseBody(frames);
  const svc = createService({ now: () => LATER_TS });
  const assigned = svc.ingestAndAssign(full.updates, driver('north', 'main'));
  assert.deepEqual(assigned, {
    zone: 'main',
    spot: '3',
    eta: ETA_BASE_SEC + 3 * ETA_STALL_SEC,
  });
  assert.equal(svc.snapshot()['1'].status, 'occupied');
  assert.equal(svc.snapshot()['3'].status, 'occupied');

  const replay = createService({ now: () => LATER_TS + 10_000 });
  replay.apply(parseBody([frames[1]]).updates);
  assert.equal(replay.snapshot()['3'].status, 'free');
  assert.equal(replay.apply(parseBody([frames[0]]).updates), 20);
  assert.equal(replay.snapshot()['3'].status, 'free');
  assert.equal(replay.assign(driver()).spot, '3');
});

test('out-of-order pipeline frames in one body still keep the newer status', () => {
  const newer = {
    frame: '2012-12-20_10_00_09.jpg',
    occupied: ['1'],
    free: ['2'],
    assignment: {},
    unassigned: [],
    ms: { total: 1 },
  };
  const older = {
    frame: '2012-12-20_10_00_04.jpg',
    occupied: ['1', '2'],
    free: [],
    assignment: {},
    unassigned: [],
    ms: { total: 1 },
  };
  const svc = createService({ now: () => LATER_TS });
  svc.apply(parseBody({ frames: [newer, older], driver: { entry: '  north  ', zone: '' } }).updates);
  assert.equal(svc.snapshot()['2'].status, 'free');
  assert.equal(svc.snapshot()['2'].ts, LATER_TS);
});

test('simple and pipeline parsers reject bad input before anyone should apply it', () => {
  const cases = [
    [{ spots: [{ spot_id: '1', status: 'FREE', ts: '2026-11-02T12:00:00.000Z' }] }, 'BAD_STATUS'],
    [{ spots: [{ spot_id: '1', status: 'free', ts: '2026-02-31T00:00:00.000Z' }] }, 'BAD_TS'],
    [{ spots: [{ spot_id: '', status: 'free', ts: '2026-11-02T12:00:00.000Z' }] }, 'BAD_SPOT'],
    [{ spots: 'nope' }, 'BAD_BODY'],
    [{ spots: [], frames: [] }, 'BAD_BODY'],
    [{ driver: 'north' }, 'BAD_DRIVER'],
    [{ driver: { entry: 1 } }, 'BAD_DRIVER'],
    [{ frame: 'not-a-frame.jpg', occupied: [], free: [] }, 'BAD_FRAME'],
    [{ frame: '2012-13-01_10_00_04.jpg', occupied: [], free: [] }, 'BAD_FRAME'],
    [{ frame: '2012-12-20_10_00_04.jpg', occupied: ['1'], free: ['1'] }, 'BAD_SPOT'],
    [{ frame: '2012-12-20_10_00_04.jpg', occupied: [1], free: [] }, 'BAD_SPOT'],
    [[{ frame: '2012-12-20_10_00_04.jpg', occupied: [], free: [] }, { spot_id: '1', status: 'free', ts: '2026-11-02T12:00:00.000Z' }], 'BAD_BODY'],
    [[{}], 'BAD_BODY'],
    ['nope', 'BAD_BODY'],
    [null, 'BAD_BODY'],
    [{ hello: 1 }, 'BAD_BODY'],
    [{ frames: {} }, 'BAD_BODY'],
    [{ spots: [null] }, 'BAD_SPOT'],
    [{ spots: [{ spot_id: '1', status: 'free', ts: 1 }] }, 'BAD_TS'],
    [{ spots: [{ spot_id: '1', status: 'free', ts: '2026-11-02T12:00:00+24:00' }] }, 'BAD_TS'],
    [{ frames: Array.from({ length: 10001 }, () => ({})) }, 'BAD_BODY'],
  ];
  for (const [body, code] of cases) {
    assert.throws(() => parseBody(body), (err) => err.code === code && err.status === 400, code);
  }
  const offset = parseBody([spot('1', 'free', '2026-11-02T15:00:00+03:00')]);
  assert.equal(offset.updates[0].ts, Date.parse('2026-11-02T15:00:00+03:00'));
});

test('a bad record does not require the caller to roll back: parse throws first', () => {
  const svc = createService({ now: () => LATER_TS });
  svc.apply(parseBody([spot('1', 'free', '2026-11-02T12:00:00.000Z')]).updates);
  assert.throws(() => parseBody([
    spot('1', 'occupied', '2026-11-02T12:00:05.000Z'),
    spot('2', 'free', 'yesterday'),
  ]));
  assert.equal(svc.snapshot()['1'].status, 'free');
});

test('the schema doc names both inputs and the response fields', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'occupancy-assign-api.md'), 'utf8');
  assert.match(doc, /spot_id/);
  assert.match(doc, /YYYY-MM-DD_HH_MM_SS/);
  assert.match(doc, /"zone": "main"/);
  assert.match(doc, /assignment/);
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  assert.match(readme, /docs\/occupancy-assign-api\.md/);
  assert.match(readme, /api\/assign\.js/);
});

test('safeAssign rejects missing lot id, empty stalls and non-numeric input', () => {
  const { safeAssign, normalizeLotId, normalizeEta } = require('../src/lib/occupancy-assign.js');
  const good = [spot('A-1', 'free', '2026-11-02T12:00:00.000Z')];
  assert.equal(safeAssign(null, null).error, 'BAD_BODY');
  assert.equal(safeAssign(null, []).error, 'BAD_BODY');
  assert.equal(safeAssign(null, { stalls: good }).error, 'MISSING_LOT_ID');
  assert.equal(safeAssign(null, { lotId: '  ', stalls: good }).error, 'MISSING_LOT_ID');
  assert.equal(safeAssign(null, { lotId: 'L1', stalls: [] }).error, 'EMPTY_STALLS');
  assert.equal(safeAssign(null, { lotId: 'L1' }).error, 'EMPTY_STALLS');
  assert.equal(safeAssign(null, { lotId: 'L1', stalls: [null] }).error, 'BAD_STALL');
  assert.equal(safeAssign(null, { lotId: 'L1', stalls: [spot('A-1', 'free', 'abc')] }).error, 'BAD_STALL');
  assert.equal(safeAssign(null, { lotId: 'L1', stalls: [spot('A-1', 'bad', '2026-11-02T12:00:00.000Z')] }).error, 'BAD_STATUS');
  assert.equal(normalizeLotId(7), '7');
  assert.equal(normalizeLotId(NaN), null);
  assert.equal(normalizeEta('12'), 12);
  assert.equal(normalizeEta('x'), null);
  assert.equal(normalizeEta(''), null);
});

test('safeAssign assigns a valid request and reports no free stall as 409', () => {
  const { safeAssign } = require('../src/lib/occupancy-assign.js');
  const svc = createService({ now: () => LATER_TS });
  const ok = safeAssign(svc, { lotId: 'L1', stalls: [spot('A-1', 'free', '2026-11-02T12:00:00.000Z')] });
  assert.equal(ok.ok, true);
  assert.equal(ok.lotId, 'L1');
  assert.equal(ok.result.spot, 'A-1');
  const none = safeAssign(svc, { lotId: 'L1', stalls: [spot('A-2', 'occupied', '2026-11-02T12:00:00.000Z')] });
  assert.equal(none.status, 409);
  assert.equal(none.error, 'NO_FREE_SPOT');
  assert.equal(safeAssign(undefined, { lotId: 'L', stalls: [spot('1', 'free', '2026-11-02T12:00:00.000Z')] }).ok, true);
  const boom = safeAssign({ ingestAndAssign() { throw new Error('x'); } }, { lotId: 'L', stalls: [spot('1', 'free', '2026-11-02T12:00:00.000Z')] });
  assert.equal(boom.status, 500);
});
