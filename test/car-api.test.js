// The car contract is the one place in ParkWiz where a third party writes the
// payload: a telematics cloud, a charger, or an OEM app. These tests pin the
// parts that cannot be renegotiated later — the three event types, opt-in,
// the no-plate guard, geofenced at-most-once delivery, read-only OCPP, and a
// Smartcar config reader that neither returns a secret nor goes live by itself.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const car = require('../src/lib/car-api');

const root = path.join(__dirname, '..');
const T0 = Date.parse('2026-10-19T09:00:00.000Z');

const SPOT = { id: 'netanya-herzl-14', kind: 'street', lat: 32.3215, lon: 34.8532 };
const CHARGER = {
  id: 'netanya-ev-cp01-1', kind: 'charger', lat: 32.3268, lon: 34.8560,
  charger: { ocppId: 'CP-01', connectorId: 1, kw: 22 },
};
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

test('a low battery buys a charger bay extra distance, a full one does not', () => {
  const spots = [SPOT, CHARGER];
  const low = car.rankSpots({ car: { at: EV_AT, batteryPct: 18 }, spots });
  assert.equal(low.lowBattery, true);
  assert.equal(low.best.spot.id, CHARGER.id);
  assert.equal(low.best.reasonKey, 'charger-low-battery');
  // The charger really is the further bay — the preference is a detour, not a
  // coincidence of the demo geography.
  assert.ok(low.best.distanceM > low.spots.find((s) => s.spot.id === SPOT.id).distanceM);

  const full = car.rankSpots({ car: { at: EV_AT, batteryPct: 90 }, spots });
  assert.equal(full.lowBattery, false);
  assert.equal(full.best.spot.id, SPOT.id);
  assert.equal(full.best.reasonKey, 'nearest');

  // An unknown battery must not be read as empty: Number(null) is 0.
  const unknown = car.rankSpots({ car: { at: EV_AT }, spots });
  assert.equal(unknown.lowBattery, false);
  assert.equal(unknown.best.spot.id, SPOT.id);
  // A spot with no coordinates cannot be ranked against a car's position.
  assert.equal(car.rankSpots({ car: { at: EV_AT }, spots: [{ id: 'nowhere' }] }).best, null);
});

test('Smartcar battery fractions become whole percent and no VIN survives', () => {
  const v = car.fromSmartcar({
    id: 'ev-sim-1',
    vin: 'WVWZZZ1KZAW000000',
    location: { latitude: 32.3230, longitude: 34.8545 },
    battery: { percentRemaining: 0.18, range: 61 },
  });
  assert.equal(v.carId, 'ev-sim-1');
  assert.equal(v.batteryPct, 18);
  assert.equal(v.rangeKm, 61);
  assert.equal(v.mode, 'simulated');
  assert.deepEqual(v.at, { lat: 32.3230, lon: 34.8545 });
  assert.deepEqual(v.droppedFields, ['vin']);
  // A vehicle with no location read is null, not {lat: NaN}.
  assert.equal(car.fromSmartcar({ id: 'x', battery: {} }).at, null);
  assert.equal(car.fromSmartcar({ id: 'x', battery: {} }).batteryPct, null);
  // Some endpoints already report whole percent; both shapes must work.
  assert.equal(car.fromSmartcar({ battery: { percentRemaining: 42 } }).batteryPct, 42);
});

test('smartcarConfig never returns the secret and will not go live on its own', () => {
  const simulated = car.smartcarConfig({});
  assert.equal(simulated.mode, 'simulated');
  assert.equal(simulated.ok, true);
  assert.equal(simulated.hasSecret, false);

  const live = car.smartcarConfig({
    SMARTCAR_MODE: 'live',
    SMARTCAR_CLIENT_ID: 'id',
    SMARTCAR_CLIENT_SECRET: 'super-secret',
    SMARTCAR_REDIRECT_URI: 'https://example.test/cb',
  });
  assert.equal(live.ok, false);
  assert.equal(live.reason, 'live-mode-not-enabled');
  assert.equal(live.mode, 'simulated');
  assert.equal(live.hasSecret, true);
  assert.doesNotMatch(JSON.stringify(live), /super-secret/);

  const test1 = car.smartcarConfig({ SMARTCAR_MODE: 'test', SMARTCAR_CLIENT_ID: 'id' });
  assert.equal(test1.mode, 'test');
  assert.equal(test1.ok, false);
  assert.deepEqual(test1.missing, ['SMARTCAR_CLIENT_SECRET', 'SMARTCAR_REDIRECT_URI']);
  assert.deepEqual(test1.scopes, ['read_location', 'read_battery']);
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

test('OCPP is read-only and only Available is advertised as a free bay', () => {
  const map = { 'CP-01:1': CHARGER };
  const msg = (status) => ({ chargePointId: 'CP-01', payload: { connectorId: 1, status } });
  const free = car.fromOcppStatusNotification(msg('Available'), map);
  assert.equal(free.state, 'free');
  assert.equal(free.readOnly, true);
  assert.equal(free.spot.id, CHARGER.id);
  assert.equal(car.fromOcppStatusNotification(msg('Charging'), map).state, 'occupied');
  // A faulted charger is not a free bay, and must not be guessed either way.
  assert.equal(car.fromOcppStatusNotification(msg('Faulted'), map).state, 'unknown');
  assert.equal(car.fromOcppStatusNotification(msg('Unavailable'), map).state, 'unknown');

  const event = car.ocppFreedEvent(msg('Available'), map, { now: T0 });
  assert.equal(event.type, 'spot-freed');
  assert.equal(event.source.kind, 'ocpp');
  assert.equal(event.confidence, 0.95);
  assert.ok(car.validateEvent(event).ok);
  assert.equal(car.ocppFreedEvent(msg('Charging'), map, { now: T0 }), null);
  assert.equal(car.ocppFreedEvent(msg('Faulted'), map, { now: T0 }), null);
  // An unmapped connector has no spot to announce.
  assert.equal(car.ocppFreedEvent(msg('Available'), {}, { now: T0 }), null);
});

test('the OCPP simulator walks the status cycle and feeds the relay', () => {
  const sim = car.createOcppSimulator({ chargers: [{ ocppId: 'CP-01' }] });
  assert.equal(sim.status('CP-01'), 'Available');
  const seen = [];
  for (let i = 0; i < 4; i++) seen.push(sim.tick('CP-01', T0).payload.status);
  assert.deepEqual(seen, ['Preparing', 'Charging', 'Finishing', 'Available']);
  const relay = car.createRelay({ now: () => T0 });
  let delivered = 0;
  relay.subscribe({ carId: 'ev-1', at: EV_AT, radiusM: 800, onEvent: () => { delivered += 1; } });
  const event = car.ocppFreedEvent(
    { chargePointId: 'CP-01', payload: { connectorId: 1, status: 'Available', timestamp: new Date(T0).toISOString() } },
    { 'CP-01:1': CHARGER }, { now: T0 }
  );
  assert.equal(relay.publish(event).delivered, 1);
  assert.equal(delivered, 1);
  assert.equal(sim.tick('NOPE', T0), null);
});

test('distances are great-circle metres, not a flat approximation', () => {
  const d = car.distanceM(EV_AT, SPOT);
  assert.ok(d > 150 && d < 300, 'got ' + d);
  assert.equal(car.distanceM(EV_AT, { lat: 'x' }), null);
  assert.equal(car.distanceM(EV_AT, EV_AT), 0);
});

test('both contract docs document the same three events, auth, privacy and env', () => {
  const en = fs.readFileSync(path.join(root, 'docs', 'car-api.md'), 'utf8');
  const he = fs.readFileSync(path.join(root, 'docs', 'car-api-he.md'), 'utf8');
  for (const doc of [en, he]) {
    for (const type of car.EVENTS) assert.match(doc, new RegExp(type));
    assert.match(doc, /Authorization: Bearer pw1/);
    assert.match(doc, /CAR_RELAY_SECRET/);
    assert.match(doc, /SMARTCAR_CLIENT_SECRET/);
    assert.match(doc, /SMARTCAR_ALLOW_LIVE/);
    assert.match(doc, /HMAC-SHA256/);
    assert.match(doc, /OCPP 1\.6J/);
    assert.match(doc, /opt-in/);
    assert.match(doc, /car-android-auto\.md/);
  }
  // Hebrew doc stays Hebrew, English doc stays English.
  assert.match(he, /[֐-׿]/);
  assert.match(he, /קריאה בלבד/);
  assert.match(en, /read-only/);
  assert.match(en, /no plates/);
  assert.match(he, /בלי לוחיות/);
  // Every identity key the guard drops has to be named in both docs, or the
  // privacy promise and the code can drift apart.
  for (const key of ['plate', 'vin', 'phone', 'imei']) {
    assert.match(en.toLowerCase(), new RegExp(key));
    assert.match(he.toLowerCase(), new RegExp(key));
  }

  const auto = fs.readFileSync(path.join(root, 'docs', 'car-android-auto.md'), 'utf8');
  assert.match(auto, /Android Automotive/);
  assert.match(auto, /androidx\.car\.app/);
  assert.match(auto, /CarAppExtender/);
  assert.match(auto, /spot-claim/);
  assert.match(auto, /spot-release/);
  // The issue is explicit: design and prototype plan, no store publishing.
  assert.match(auto, /Nothing is published to Google Play/);
});

test('no Smartcar or relay secret is committed anywhere in the repo', () => {
  const lib = fs.readFileSync(path.join(root, 'src', 'lib', 'car-api.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'demo', 'car-demo.html'), 'utf8');
  for (const src of [lib, page]) {
    assert.doesNotMatch(src, /SMARTCAR_CLIENT_SECRET\s*=\s*['"][^'"]/);
    assert.doesNotMatch(src, /sk_live|client_secret['"]?\s*[:=]\s*['"][A-Za-z0-9-]{8}/);
  }
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /\.env/);
});
