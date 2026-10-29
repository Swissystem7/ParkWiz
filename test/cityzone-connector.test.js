'use strict';
const test = require('node:test');
const assert = require('assert/strict');
const {
  createCityZoneConnector,
  createMockTransport,
  createHttpTransport,
} = require('../src/lib/cityzone-connector.js');

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

test('custom transport: result returned verbatim and errors propagate', () => {
  const ack = { ok: true, id: 42 };
  const boom = new Error('boom');
  const c = createCityZoneConnector({
    transport: {
      pushOccupancy: () => ack,
      pushSpotFreed: () => { throw boom; },
      fetchLotConfig: () => ack,
    },
  });
  assert.equal(c.pushOccupancy('lot-1', { total: 1, occupied: 0 }), ack);
  assert.equal(c.fetchLotConfig('lot-1'), ack);
  assert.throws(() => c.pushSpotFreed({ lotId: 'lot-1', spotId: 'A1' }), (e) => e === boom);
});
