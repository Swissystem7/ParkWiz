// The car contract is the one place in ParkWiz where a third party writes the
// payload: a telematics cloud, a charger, or an OEM app. These tests pin the
// parts that cannot be renegotiated later — the three event types, opt-in,
// the no-plate guard, the token shape and geofenced at-most-once delivery.
// The ranker, Smartcar and read-only OCPP tests land with those adapters.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const car = require('../src/lib/car-api');

const T0 = Date.parse('2026-10-19T09:00:00.000Z');

const SPOT = { id: 'netanya-herzl-14', kind: 'street', lat: 32.3215, lon: 34.8532 };
const EV_AT = { lat: 32.3230, lon: 34.8545 };

function freed(extra) {
  return Object.assign({
    type: 'spot-freed',
    id: 'evt-1',
    ts: new Date(T0).toISOString(),
    spot: SPOT,
    source: { kind: 'car', carId: 'car-leaving', consent: 'opt-in' },
  }, extra || {});
}

test('the contract is exactly three event types at protocol v1', () => {
  assert.deepEqual([...car.EVENTS], ['spot-freed', 'spot-claim', 'spot-release']);
  assert.equal(car.PROTOCOL_VERSION, 1);
  assert.equal(car.normalizeEvent(freed({ type: 'spot-stolen' })), null);
  assert.equal(car.normalizeEvent(null), null);
  const v = car.validateEvent(freed({ type: 'spot-stolen' }));
  assert.deepEqual(v.errors, ['type']);
});

test('a valid spot-freed normalizes with a TTL, confidence and ISO timestamp', () => {
  const e = car.normalizeEvent(freed());
  assert.equal(e.v, 1);
  assert.equal(e.ttlS, car.DEFAULT_TTL_S);
  assert.equal(e.confidence, 0.6);
  assert.equal(e.ts, '2026-10-19T09:00:00.000Z');
  assert.equal(e.spot.kind, 'street');
  assert.ok(car.validateEvent(freed()).ok);
  // TTL is clamped, never trusted: a day-long "free spot" is a lie by the time
  // the subscriber arrives.
  assert.equal(car.normalizeEvent(freed({ ttlS: 99999 })).ttlS, car.MAX_TTL_S);
  assert.equal(car.normalizeEvent(freed({ ttlS: 0 })).ttlS, 1);
});

test('a freed spot with no coordinates is rejected, a claim by id is not', () => {
  const noGeo = car.validateEvent(freed({ spot: { id: 'x', kind: 'street' } }));
  assert.equal(noGeo.ok, false);
  assert.ok(noGeo.errors.includes('spot.lat/lon'));
  const claim = car.validateEvent({
    type: 'spot-claim', id: 'c1', ts: new Date(T0).toISOString(),
    spot: { id: 'netanya-herzl-14' }, etaS: 90,
    source: { kind: 'car', carId: 'ev-1', consent: 'opt-in' },
  });
  assert.ok(claim.ok, claim.errors.join(','));
  assert.equal(claim.event.etaS, 90);
});

test('spot-release carries a known reason and falls back instead of inventing one', () => {
  const base = {
    type: 'spot-release', id: 'r1', ts: new Date(T0).toISOString(),
    spot: { id: 'netanya-herzl-14' },
    source: { kind: 'car', carId: 'ev-1', consent: 'opt-in' },
  };
  assert.equal(car.normalizeEvent({ ...base, reason: 'taken' }).reason, 'taken');
  assert.equal(car.normalizeEvent({ ...base, reason: 'because' }).reason, 'gave-up');
});

test('an event without opt-in consent is rejected, not silently accepted', () => {
  const anon = car.validateEvent(freed({ source: { kind: 'car', carId: 'c', consent: 'implied' } }));
  assert.equal(anon.ok, false);
  assert.ok(anon.errors.includes('source.consent'));
  const noCar = car.validateEvent(freed({ source: { kind: 'car', consent: 'opt-in' } }));
  assert.ok(noCar.errors.includes('source.carId'));
  const noTs = car.validateEvent(freed({ ts: 'not-a-date' }));
  assert.ok(noTs.errors.includes('ts'));
});

test('plates, VINs and phone numbers are dropped at every depth before publish', () => {
  const raw = freed({
    plate: '12-345-67',
    source: { kind: 'car', carId: 'c', consent: 'opt-in', vin: 'WVWZZZ1KZAW000000', phone: '050-0000000' },
    spot: { ...SPOT, driverName: 'דני' },
  });
  const e = car.normalizeEvent(raw);
  const json = JSON.stringify(e);
  assert.doesNotMatch(json, /12-345-67|WVWZZZ|050-0000000|דני/);
  assert.deepEqual(e.droppedFields.sort(), ['plate', 'source.phone', 'source.vin', 'spot.driverName']);
  // The event itself stays valid — the guard strips identity, it does not
  // reject the departure report and lose the free spot.
  assert.ok(car.validateEvent(raw).ok);
  const nested = car.stripIdentity({ a: [{ VIN: 'x', keep: 1 }] });
  assert.deepEqual(nested.clean, { a: [{ keep: 1 }] });
  assert.deepEqual(nested.dropped, ['a[0].VIN']);
});

test('the relay fans out only to subscribed cars inside the radius', () => {
  const relay = car.createRelay({ now: () => T0 });
  const near = [];
  const far = [];
  relay.subscribe({ carId: 'ev-near', at: EV_AT, radiusM: 800, onEvent: (e, m) => near.push(m.distanceM) });
  relay.subscribe({ carId: 'ev-far', at: { lat: 32.40, lon: 34.95 }, radiusM: 800, onEvent: () => far.push(1) });
  const res = relay.publish(freed());
  assert.ok(res.ok, res.errors.join(','));
  assert.equal(res.delivered, 1);
  assert.equal(near.length, 1);
  assert.equal(far.length, 0);
  assert.ok(near[0] > 0 && near[0] < 800);
});

test('the relay never echoes an event back to the car that sent it', () => {
  const relay = car.createRelay({ now: () => T0 });
  let hits = 0;
  relay.subscribe({ carId: 'car-leaving', at: EV_AT, radiusM: 800, onEvent: () => { hits += 1; } });
  assert.equal(relay.publish(freed()).delivered, 0);
  assert.equal(hits, 0);
});

test('the relay delivers an event id at most once and drops expired ones', () => {
  const relay = car.createRelay({ now: () => T0 });
  let hits = 0;
  relay.subscribe({ carId: 'ev-1', at: EV_AT, radiusM: 800, onEvent: () => { hits += 1; } });
  assert.equal(relay.publish(freed()).delivered, 1);
  const again = relay.publish(freed());
  assert.equal(again.ok, false);
  assert.deepEqual(again.errors, ['duplicate']);
  assert.equal(hits, 1);

  const late = car.createRelay({ now: () => T0 + 10 * 60 * 1000 });
  late.subscribe({ carId: 'ev-1', at: EV_AT, radiusM: 800, onEvent: () => { hits += 1; } });
  const stale = late.publish(freed());
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.errors, ['expired']);
  assert.equal(hits, 1);
  assert.ok(car.isExpired(car.normalizeEvent(freed()), T0 + 10 * 60 * 1000));
  assert.equal(car.isExpired(car.normalizeEvent(freed()), T0 + 1000), false);
});

test('the dedup table is pruned by TTL, so a long-lived relay does not grow', () => {
  let clock = T0;
  const relay = car.createRelay({ now: () => clock });
  relay.subscribe({ carId: 'ev-1', at: EV_AT, radiusM: 800, onEvent: () => {} });
  assert.equal(relay.publish(freed()).delivered, 1);
  // Once the event's own TTL is gone its dedup entry is dropped, so the second
  // attempt is refused by the TTL check rather than by a table that remembers
  // every id the relay ever saw.
  clock = T0 + 10 * 60 * 1000;
  assert.deepEqual(relay.publish(freed()).errors, ['expired']);
  assert.equal(relay.stats().duplicates, 0);
  assert.equal(relay.stats().expired, 1);
});

test('subscribers can filter by type and unsubscribe', () => {
  const relay = car.createRelay({ now: () => T0 });
  const seen = [];
  const off = relay.subscribe({
    carId: 'ev-1', at: EV_AT, radiusM: 800, types: ['spot-claim'], onEvent: (e) => seen.push(e.type),
  });
  assert.equal(relay.subscriberCount(), 1);
  relay.publish(freed());
  assert.deepEqual(seen, []);
  off();
  assert.equal(relay.subscriberCount(), 0);
});

test('auth tokens are checked for shape, expiry and scope — and say so honestly', () => {
  const claims = { carId: 'ev-sim-1', exp: Math.floor(T0 / 1000) + 600, scopes: ['spot:write'] };
  const header = car.buildAuthHeader(claims, 'deadbeef');
  const ok = car.checkAuth(header, { now: T0, scope: 'spot:write' });
  assert.equal(ok.ok, true);
  assert.equal(ok.carId, 'ev-sim-1');
  // No verify callback means the signature was not checked, and the result
  // must not pretend otherwise.
  assert.equal(ok.signatureChecked, false);
  const verified = car.checkAuth(header, {
    now: T0, scope: 'spot:write', verify: (canon, sig) => canon === car.canonicalAuthString(claims) && sig === 'deadbeef',
  });
  assert.equal(verified.signatureChecked, true);
  assert.equal(car.checkAuth(header, { now: T0, verify: () => false }).reason, 'bad-signature');
  assert.equal(car.checkAuth(header, { now: T0 + 3600 * 1000 }).reason, 'expired');
  assert.equal(car.checkAuth(header, { now: T0, scope: 'spot:read' }).reason, 'scope');
  assert.equal(car.checkAuth('Bearer nope', { now: T0 }).reason, 'malformed');
  assert.equal(car.checkAuth(car.buildAuthHeader({ ...claims, scopes: ['spot:admin'] }, 'x'), { now: T0 }).reason, 'unknown-scope');
  assert.equal(car.checkAuth(car.buildAuthHeader(claims, ''), { now: T0 }).reason, 'no-signature');
});

test('distances are great-circle metres, not a flat approximation', () => {
  const d = car.distanceM(EV_AT, SPOT);
  assert.ok(d > 150 && d < 300, 'got ' + d);
  assert.equal(car.distanceM(EV_AT, { lat: 'x' }), null);
  assert.equal(car.distanceM(EV_AT, EV_AT), 0);
});
