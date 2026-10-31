'use strict';
const test = require('node:test');
const assert = require('assert/strict');
const {
  createCityZoneConnector,
  createMockTransport,
  createHttpTransport,
  toCityZoneFreed,
} = require('../src/lib/cityzone-connector.js');
const { relayPayload } = require('../src/lib/spot-freed.js');

test('mock pushOccupancy: ack + recorded normalised call', () => {
  const c = createCityZoneConnector();
  const res = c.pushOccupancy('lot-1', {
    total: 10, occupied: 4, ts: '2026-10-29T00:00:00Z',
    spots: [{ id: 'A1', state: 'free' }],
  });
  assert.deepEqual(res, { accepted: true });
  assert.deepEqual(c.transport.calls, [{
    method: 'pushOccupancy', lotId: 'lot-1',
    payload: {
      total: 10, occupied: 4, timestamp: '2026-10-29T00:00:00Z',
      spots: [{ id: 'A1', state: 'free' }],
    },
  }]);
});

test('pushSpotFreed: ack + recorded normalised event', () => {
  const c = createCityZoneConnector();
  assert.deepEqual(
    c.pushSpotFreed({ lotId: 'lot-1', spotId: 'A1', timestamp: '2026-10-29T01:00:00Z' }),
    { accepted: true },
  );
  assert.deepEqual(c.pushSpotFreed({ lotId: 'lot-1', spotId: 'A2' }), { accepted: true });
  assert.deepEqual(c.transport.calls, [
    { method: 'pushSpotFreed', lotId: 'lot-1', payload: { lotId: 'lot-1', spotId: 'A1', freedAt: '2026-10-29T01:00:00Z' } },
    { method: 'pushSpotFreed', lotId: 'lot-1', payload: { lotId: 'lot-1', spotId: 'A2', freedAt: null } },
  ]);
});

test('fetchLotConfig: seeded config + record, null when unseeded', () => {
  const transport = createMockTransport({ configByLot: { 'lot-1': { name: 'Atidim' } } });
  const c = createCityZoneConnector({ transport });
  assert.deepEqual(c.fetchLotConfig('lot-1'), { name: 'Atidim' });
  assert.equal(c.fetchLotConfig('nope'), null);
  assert.deepEqual(transport.calls, [
    { method: 'fetchLotConfig', lotId: 'lot-1' },
    { method: 'fetchLotConfig', lotId: 'nope' },
  ]);
});

test('http stub: throws /not configured/ for all methods, with or without baseUrl', () => {
  for (const t of [createHttpTransport(), createHttpTransport({ baseUrl: 'https://example.invalid' })]) {
    const c = createCityZoneConnector({ transport: t });
    assert.throws(() => c.pushOccupancy('lot-1', { total: 1, occupied: 0 }), /not configured/);
    assert.throws(() => c.pushSpotFreed({ lotId: 'lot-1', spotId: 'A1' }), /not configured/);
    assert.throws(() => c.fetchLotConfig('lot-1'), /not configured/);
  }
});

test('rejects image/photoUrl field at top level', () => {
  const c = createCityZoneConnector();
  assert.throws(() => c.pushOccupancy('lot-1', { total: 1, occupied: 0, photoUrl: 'x' }), TypeError);
  assert.throws(() => c.pushOccupancy('lot-1', { total: 1, occupied: 0, image: 'x' }), /forbidden field: image/);
});

test('rejects nested plateNumber and face_embedding fields', () => {
  const c = createCityZoneConnector();
  const base = { total: 2, occupied: 1 };
  assert.throws(
    () => c.pushOccupancy('lot-1', { ...base, spots: [{ id: 'A1', state: 'free', plateNumber: '12' }] }),
    /forbidden field: plateNumber/,
  );
  assert.throws(
    () => c.pushOccupancy('lot-1', { ...base, meta: { face_embedding: [1] } }),
    /forbidden field: face_embedding/,
  );
});

test('rejects occupied>total, negative counts, and missing lotId', () => {
  const c = createCityZoneConnector();
  assert.throws(() => c.pushOccupancy('lot-1', { total: 2, occupied: 3 }), RangeError);
  assert.throws(() => c.pushOccupancy('lot-1', { total: -1, occupied: 0 }), RangeError);
  assert.throws(() => c.pushOccupancy('lot-1', { total: 2, occupied: -1 }), RangeError);
  assert.throws(() => c.pushOccupancy('lot-1', { total: 2.5, occupied: 1 }), TypeError);
  assert.throws(() => c.pushOccupancy('lot-1', { total: 2 }), TypeError);
  assert.throws(() => c.pushOccupancy('lot-1', { total: 2, occupied: 1, free: 3 }), RangeError);
  assert.throws(() => c.pushOccupancy('', { total: 2, occupied: 1 }), TypeError);
  assert.throws(() => c.pushOccupancy(undefined, { total: 2, occupied: 1 }), TypeError);
  assert.throws(() => c.fetchLotConfig(''), TypeError);
});

test('relay {lot, spotId, freedAt} maps to {lotId, spotId, freedAt}', () => {
  const relay = relayPayload({ kind: 'freed', lot: 'atidim', spotId: 'A-01', at: 5000 });
  assert.deepEqual(relay, { lot: 'atidim', spotId: 'A-01', freedAt: 5000 });
  assert.deepEqual(toCityZoneFreed(relay), { lotId: 'atidim', spotId: 'A-01', freedAt: 5000 });

  const c = createCityZoneConnector();
  assert.deepEqual(c.pushSpotFreed(relay), { accepted: true });
  assert.deepEqual(c.transport.calls[0].payload, { lotId: 'atidim', spotId: 'A-01', freedAt: 5000 });
  assert.equal(Object.hasOwn(c.transport.calls[0].payload, 'lot'), false);
});

test('freedAt 0 is kept, and lot must agree with lotId', () => {
  assert.deepEqual(
    toCityZoneFreed({ lot: 'atidim', spotId: 'A-01', freedAt: 0 }),
    { lotId: 'atidim', spotId: 'A-01', freedAt: 0 },
  );
  assert.deepEqual(
    toCityZoneFreed({ lot: 'atidim', lotId: 'atidim', spotId: 'A-01' }),
    { lotId: 'atidim', spotId: 'A-01', freedAt: null },
  );
  assert.throws(() => toCityZoneFreed({ lot: 'atidim', lotId: 'other', spotId: 'A-01' }), /disagree/);
  assert.throws(() => toCityZoneFreed({ spotId: 'A-01', freedAt: 1 }), /lotId/);
  assert.throws(() => toCityZoneFreed({ lot: 'atidim', spotId: 'A-01', plate: '1' }), /forbidden field: plate/);
});

test('fetchLotConfig returns only allowlisted fields', () => {
  const transport = createMockTransport({
    configByLot: {
      'lot-1': {
        lotId: 'lot-1',
        name: 'Atidim',
        total: 220,
        spots: [{ id: 'A1', state: 'reserved' }],
      },
      'lot-bad': { name: 'Atidim', streamUrl: 'rtsp://camera' },
      'lot-plate': { name: 'Atidim', spots: [{ id: 'A1', state: 'free', plateNumber: '12' }] },
    },
  });
  const c = createCityZoneConnector({ transport });
  assert.deepEqual(c.fetchLotConfig('lot-1'), {
    lotId: 'lot-1',
    name: 'Atidim',
    total: 220,
    spots: [{ id: 'A1', state: 'reserved' }],
  });
  assert.throws(() => c.fetchLotConfig('lot-bad'), /unknown field: streamUrl/);
  assert.throws(() => c.fetchLotConfig('lot-plate'), /forbidden field: plateNumber/);
  assert.equal(c.fetchLotConfig('missing'), null);
});

test('custom transport: result returned verbatim and errors propagate', () => {
  const ack = { ok: true, id: 42 };
  const boom = new Error('boom');
  const c = createCityZoneConnector({
    transport: {
      pushOccupancy: () => ack,
      pushSpotFreed: () => { throw boom; },
      fetchLotConfig: () => ({ name: 'Atidim' }),
    },
  });
  assert.equal(c.pushOccupancy('lot-1', { total: 1, occupied: 0 }), ack);
  assert.deepEqual(c.fetchLotConfig('lot-1'), { name: 'Atidim' });
  assert.throws(() => c.pushSpotFreed({ lotId: 'lot-1', spotId: 'A1' }), (e) => e === boom);
});
