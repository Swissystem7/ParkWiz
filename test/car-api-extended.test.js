'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const car = require('../src/lib/car-api');

const T0 = Date.parse('2026-10-19T09:00:00.000Z');
const SPOT_BASE = { id: 'stall-101', kind: 'street', lat: 32.3215, lon: 34.8532 };

function validEvent(extra) {
  return Object.assign({
    type: 'spot-freed',
    id: 'evt-base-1',
    ts: new Date(T0).toISOString(),
    spot: SPOT_BASE,
    source: { kind: 'car', carId: 'car-primary', consent: 'opt-in' },
  }, extra || {});
}

// -----------------------------------------------------------------------------
// 1. normalizeSpot and normalizeEvent for charger stalls (lines 159-164)
// -----------------------------------------------------------------------------
test('normalizeSpot handles charger stalls with full and fallback charger metadata', () => {
  // Full charger object
  const full = car.normalizeSpot({
    id: 'charger-bay-1',
    kind: 'charger',
    lat: 32.1,
    lon: 34.8,
    charger: { ocppId: 'CP-TLV-01', connectorId: 2, kw: 150 },
  });
  assert.equal(full.id, 'charger-bay-1');
  assert.equal(full.kind, 'charger');
  assert.deepEqual(full.charger, {
    ocppId: 'CP-TLV-01',
    connectorId: 2,
    kw: 150,
  });

  // Charger with fallbacks: missing connectorId falls back to 1, missing kw falls back to null
  const fallback = car.normalizeSpot({
    id: 'charger-bay-2',
    kind: 'charger',
    charger: { ocppId: 'CP-TLV-02' },
  });
  assert.deepEqual(fallback.charger, {
    ocppId: 'CP-TLV-02',
    connectorId: 1,
    kw: null,
  });

  // Charger with non-numeric connectorId and kw
  const nonNum = car.normalizeSpot({
    id: 'charger-bay-3',
    kind: 'charger',
    charger: { ocppId: 'CP-TLV-03', connectorId: 'invalid', kw: 'fast' },
  });
  assert.deepEqual(nonNum.charger, {
    ocppId: 'CP-TLV-03',
    connectorId: 1,
    kw: null,
  });

  // Malformed charger: null, primitive, string, or boolean
  const nullCharger = car.normalizeSpot({
    id: 'charger-bay-4',
    kind: 'charger',
    charger: null,
  });
  assert.equal(nullCharger.charger, undefined);

  const stringCharger = car.normalizeSpot({
    id: 'charger-bay-5',
    kind: 'charger',
    charger: 'not-an-object',
  });
  assert.equal(stringCharger.charger, undefined);

  // Spot kind other than 'charger' ignores charger field
  const streetWithCharger = car.normalizeSpot({
    id: 'street-bay-1',
    kind: 'street',
    charger: { ocppId: 'CP-TLV-01', connectorId: 2, kw: 50 },
  });
  assert.equal(streetWithCharger.charger, undefined);

  // Non-object or missing id returns null
  assert.equal(car.normalizeSpot(null), null);
  assert.equal(car.normalizeSpot('not-a-spot'), null);
  assert.equal(car.normalizeSpot({}), null);
  assert.equal(car.normalizeSpot({ id: '   ' }), null);

  // Unknown kind falls back to 'street'
  const unknownKind = car.normalizeSpot({ id: 'bay-x', kind: 'garage' });
  assert.equal(unknownKind.kind, 'street');
});

test('normalizeEvent preserves normalized charger information on spot-freed', () => {
  const evt = car.normalizeEvent(validEvent({
    spot: {
      id: 'ev-stall-9',
      kind: 'charger',
      lat: 32.32,
      lon: 34.85,
      charger: { ocppId: 'TLV-OCPP-9', connectorId: 3, kw: 22 },
    },
  }));
  assert.ok(evt);
  assert.equal(evt.spot.kind, 'charger');
  assert.deepEqual(evt.spot.charger, {
    ocppId: 'TLV-OCPP-9',
    connectorId: 3,
    kw: 22,
  });
});

// -----------------------------------------------------------------------------
// 2. validateEvent missing spot branch (line 218)
// -----------------------------------------------------------------------------
test('validateEvent reports "spot" error for valid event types when spot is missing or invalid', () => {
  const validTypes = ['spot-freed', 'spot-claim', 'spot-release'];

  for (const type of validTypes) {
    // Missing spot (null)
    const resNull = car.validateEvent({ type, spot: null, source: { carId: 'c1', consent: 'opt-in' }, ts: '2026-10-19T09:00:00Z' });
    assert.equal(resNull.ok, false);
    assert.deepEqual(resNull.errors, ['spot']);
    assert.equal(resNull.event, null);

    // Missing spot (undefined)
    const resUndef = car.validateEvent({ type, source: { carId: 'c1', consent: 'opt-in' }, ts: '2026-10-19T09:00:00Z' });
    assert.equal(resUndef.ok, false);
    assert.deepEqual(resUndef.errors, ['spot']);
    assert.equal(resUndef.event, null);

    // Non-object spot
    const resStr = car.validateEvent({ type, spot: 'herzl-14', source: { carId: 'c1', consent: 'opt-in' }, ts: '2026-10-19T09:00:00Z' });
    assert.equal(resStr.ok, false);
    assert.deepEqual(resStr.errors, ['spot']);

    // Spot without id
    const resNoId = car.validateEvent({ type, spot: { kind: 'street' }, source: { carId: 'c1', consent: 'opt-in' }, ts: '2026-10-19T09:00:00Z' });
    assert.equal(resNoId.ok, false);
    assert.deepEqual(resNoId.errors, ['spot']);

    // Spot with empty id
    const resEmptyId = car.validateEvent({ type, spot: { id: '   ' }, source: { carId: 'c1', consent: 'opt-in' }, ts: '2026-10-19T09:00:00Z' });
    assert.equal(resEmptyId.ok, false);
    assert.deepEqual(resEmptyId.errors, ['spot']);
  }

  // Contrasting check: invalid type reports 'type' rather than 'spot'
  const resBadType = car.validateEvent({ type: 'invalid-type', spot: null });
  assert.equal(resBadType.ok, false);
  assert.deepEqual(resBadType.errors, ['type']);
});

// -----------------------------------------------------------------------------
// 3. createRelay publish rejection (lines 274-276)
// -----------------------------------------------------------------------------
test('createRelay rejects invalid payloads, updates stats.rejected, and delivers to 0 subscribers', () => {
  const relay = car.createRelay({ now: () => T0 });
  let callCount = 0;
  relay.subscribe({
    carId: 'listener',
    at: { lat: 32.3215, lon: 34.8532 },
    radiusM: 500,
    onEvent: () => { callCount += 1; },
  });

  const initialStats = relay.stats();
  assert.equal(initialStats.rejected, 0);
  assert.equal(initialStats.published, 0);

  // Reject due to invalid type
  const badType = relay.publish({ type: 'not-an-event' });
  assert.equal(badType.ok, false);
  assert.deepEqual(badType.errors, ['type']);
  assert.equal(badType.delivered, 0);
  assert.equal(badType.event, null);

  // Reject due to missing spot
  const badSpot = relay.publish({
    type: 'spot-freed',
    ts: new Date(T0).toISOString(),
    source: { carId: 'c1', consent: 'opt-in' },
  });
  assert.equal(badSpot.ok, false);
  assert.deepEqual(badSpot.errors, ['spot']);
  assert.equal(badSpot.delivered, 0);
  assert.equal(badSpot.event, null);

  // Reject due to missing consent
  const noConsent = relay.publish(validEvent({
    source: { kind: 'car', carId: 'c1', consent: 'none' },
  }));
  assert.equal(noConsent.ok, false);
  assert.ok(noConsent.errors.includes('source.consent'));
  assert.equal(noConsent.delivered, 0);

  // Reject freed spot without coordinates
  const noCoords = relay.publish(validEvent({
    spot: { id: 'spot-no-geo' },
  }));
  assert.equal(noCoords.ok, false);
  assert.ok(noCoords.errors.includes('spot.lat/lon'));
  assert.equal(noCoords.delivered, 0);

  // Verify subscriber was never contacted and stats.rejected counted each failure
  assert.equal(callCount, 0);
  const afterStats = relay.stats();
  assert.equal(afterStats.rejected, 4);
  assert.equal(afterStats.published, 0);
  assert.equal(afterStats.delivered, 0);
});

// -----------------------------------------------------------------------------
// 4. Geofence & subscriber boundaries in createRelay
// -----------------------------------------------------------------------------
test('createRelay handles subscriber geofence boundaries, coordinates, and options', () => {
  const relay = car.createRelay({ now: () => T0 });
  const eventCoord = { lat: 32.3215, lon: 34.8532 };

  const deliveries = [];
  // Inside radius
  const subIn = relay.subscribe({
    carId: 'car-inside',
    at: { lat: 32.3220, lon: 34.8535 }, // ~60m away
    radiusM: 200,
    onEvent: (evt, meta) => deliveries.push({ sub: 'inside', meta }),
  });

  // Outside radius
  relay.subscribe({
    carId: 'car-outside',
    at: { lat: 32.3300, lon: 34.8600 }, // ~1100m away
    radiusM: 200,
    onEvent: (evt, meta) => deliveries.push({ sub: 'outside', meta }),
  });

  // Missing coordinates (at is empty/null/NaN)
  relay.subscribe({
    carId: 'car-no-coords',
    at: null,
    radiusM: 2000,
    onEvent: (evt, meta) => deliveries.push({ sub: 'no-coords', meta }),
  });

  relay.subscribe({
    carId: 'car-nan-coords',
    at: { lat: NaN, lon: NaN },
    radiusM: 2000,
    onEvent: (evt, meta) => deliveries.push({ sub: 'nan-coords', meta }),
  });

  // Default subscriber options: omitted types, omitted radiusM, omitted onEvent
  const subDefault = relay.subscribe({
    carId: 'car-default',
    at: { lat: 32.3216, lon: 34.8533 },
  });

  // Empty subscriber options
  const subEmpty = relay.subscribe();

  // Custom types with unknown type filtered out
  const filteredSubSeen = [];
  relay.subscribe({
    carId: 'car-filtered',
    at: { lat: 32.3215, lon: 34.8532 },
    types: ['spot-claim', 'unsupported-type'],
    onEvent: (e) => filteredSubSeen.push(e.type),
  });

  // Clamped radius boundaries
  const subSmallRadius = relay.subscribe({
    carId: 'car-small-radius',
    at: { lat: 32.3215, lon: 34.8532 },
    radiusM: 0, // Clamped to 1
  });
  const subHugeRadius = relay.subscribe({
    carId: 'car-huge-radius',
    at: { lat: 32.3215, lon: 34.8532 },
    radiusM: 99999, // Clamped to MAX_RADIUS_M (5000)
  });

  assert.equal(relay.subscriberCount(), 9);

  const res = relay.publish(validEvent({
    spot: { id: 's1', kind: 'street', ...eventCoord },
  }));

  assert.ok(res.ok);
  // car-inside and car-default both receive the event (car-default has default onEvent no-op)
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].sub, 'inside');
  assert.ok(typeof deliveries[0].meta.distanceM === 'number');
  assert.ok(deliveries[0].meta.distanceM > 0 && deliveries[0].meta.distanceM < 200);
  assert.ok(deliveries[0].meta.subscriberId.startsWith('sub-'));

  // Filtered subscriber did not receive 'spot-freed' because it only subscribed to 'spot-claim'
  assert.deepEqual(filteredSubSeen, []);

  // Unsubscribe cleanup
  subIn();
  assert.equal(relay.subscriberCount(), 8);
  subDefault();
  subEmpty();
  subSmallRadius();
  subHugeRadius();
  assert.equal(relay.subscriberCount(), 4);
});

test('createRelay works with default options when opts is omitted', () => {
  const relay = car.createRelay();
  assert.equal(relay.subscriberCount(), 0);
  const st = relay.stats();
  assert.equal(st.published, 0);
  assert.equal(st.delivered, 0);

  // Calling publish uses the default () => Date.now() clock
  let received = false;
  relay.subscribe({
    carId: 'car-sub',
    at: SPOT_BASE,
    onEvent: () => { received = true; },
  });
  const res = relay.publish(validEvent({
    ts: new Date().toISOString(),
  }));
  assert.ok(res.ok);
  assert.equal(res.delivered, 1);
  assert.equal(received, true);
  assert.equal(relay.stats().published, 1);
});

// -----------------------------------------------------------------------------
// 5. Event normalization and auth edge cases
// -----------------------------------------------------------------------------
test('normalizeEvent numeric tsMs fallback, auto id generation, and clamp boundaries', () => {
  // numeric tsMs fallback when ts is omitted
  const evtMs = car.normalizeEvent(validEvent({
    ts: undefined,
    tsMs: T0,
  }));
  assert.equal(evtMs.ts, new Date(T0).toISOString());

  // String tsMs fallback
  const evtStrMs = car.normalizeEvent(validEvent({
    ts: null,
    tsMs: String(T0),
  }));
  assert.equal(evtStrMs.ts, new Date(T0).toISOString());

  // No ts and no valid tsMs -> ts is empty string, auto id falls back to 'no-ts'
  const evtNoTs = car.normalizeEvent(validEvent({
    id: '',
    ts: '',
    tsMs: 'invalid',
  }));
  assert.equal(evtNoTs.ts, '');
  assert.equal(evtNoTs.id, `spot-freed:${SPOT_BASE.id}:no-ts`);

  // Auto id with valid ts
  const evtAutoId = car.normalizeEvent(validEvent({
    id: undefined,
    ts: new Date(T0).toISOString(),
  }));
  assert.equal(evtAutoId.id, `spot-freed:${SPOT_BASE.id}:${new Date(T0).toISOString()}`);

  // Clamp ttlS boundaries: < 1 clamps to 1, > MAX_TTL_S clamps to MAX_TTL_S, non-number falls back to DEFAULT_TTL_S
  assert.equal(car.normalizeEvent(validEvent({ ttlS: -10 })).ttlS, 1);
  assert.equal(car.normalizeEvent(validEvent({ ttlS: 50000 })).ttlS, car.MAX_TTL_S);
  assert.equal(car.normalizeEvent(validEvent({ ttlS: 'not-a-number' })).ttlS, car.DEFAULT_TTL_S);

  // Clamp confidence (spot-freed): < 0 clamps to 0, > 1 clamps to 1, non-number falls back to 0.6
  assert.equal(car.normalizeEvent(validEvent({ type: 'spot-freed', confidence: -0.5 })).confidence, 0);
  assert.equal(car.normalizeEvent(validEvent({ type: 'spot-freed', confidence: 1.5 })).confidence, 1);
  assert.equal(car.normalizeEvent(validEvent({ type: 'spot-freed', confidence: 'high' })).confidence, 0.6);

  // Clamp etaS (spot-claim): < 0 clamps to 0, > 3600 clamps to 3600, non-number falls back to 60
  const claimBase = {
    type: 'spot-claim',
    ts: new Date(T0).toISOString(),
    spot: SPOT_BASE,
    source: { carId: 'c1', consent: 'opt-in' },
  };
  assert.equal(car.normalizeEvent({ ...claimBase, etaS: -30 }).etaS, 0);
  assert.equal(car.normalizeEvent({ ...claimBase, etaS: 9999 }).etaS, 3600);
  assert.equal(car.normalizeEvent({ ...claimBase, etaS: 'quick' }).etaS, 60);

  // spot-release reasons fallback to 'gave-up'
  const releaseBase = {
    type: 'spot-release',
    ts: new Date(T0).toISOString(),
    spot: SPOT_BASE,
    source: { carId: 'c1', consent: 'opt-in' },
  };
  assert.equal(car.normalizeEvent({ ...releaseBase, reason: 'taken' }).reason, 'taken');
  assert.equal(car.normalizeEvent({ ...releaseBase, reason: 'expired' }).reason, 'expired');
  assert.equal(car.normalizeEvent({ ...releaseBase, reason: 'gave-up' }).reason, 'gave-up');
  assert.equal(car.normalizeEvent({ ...releaseBase, reason: 'other' }).reason, 'gave-up');
  assert.equal(car.normalizeEvent({ ...releaseBase, reason: null }).reason, 'gave-up');
});

test('normalizeSource handles missing objects, kinds, and consent edge cases', () => {
  assert.deepEqual(car.normalizeSource(null), { kind: 'app', carId: '', consent: '' });
  assert.deepEqual(car.normalizeSource('not-an-object'), { kind: 'app', carId: '', consent: '' });
  assert.deepEqual(car.normalizeSource({ kind: 'ocpp', carId: 'charger-1', consent: 'opt-in' }), {
    kind: 'ocpp',
    carId: 'charger-1',
    consent: 'opt-in',
  });
  assert.deepEqual(car.normalizeSource({ kind: 'unknown', carId: 'c1', consent: 'opt-in' }), {
    kind: 'app',
    carId: 'c1',
    consent: 'opt-in',
  });
  assert.deepEqual(car.normalizeSource({ kind: 'car', carId: 'c1', consent: 'opt-out' }), {
    kind: 'car',
    carId: 'c1',
    consent: '',
  });
});

test('stripIdentity handles primitives, arrays, null, and custom path prefixes', () => {
  // Primitives and null
  assert.deepEqual(car.stripIdentity(null), { clean: null, dropped: [] });
  assert.deepEqual(car.stripIdentity(42), { clean: 42, dropped: [] });
  assert.deepEqual(car.stripIdentity('text'), { clean: 'text', dropped: [] });
  assert.deepEqual(car.stripIdentity(true), { clean: true, dropped: [] });

  // Arrays of primitives
  assert.deepEqual(car.stripIdentity(['apple', 123, null]), { clean: ['apple', 123, null], dropped: [] });

  // Arrays of objects with identity keys
  const resArray = car.stripIdentity([
    { name: 'spot1', plate: '123' },
    { name: 'spot2', phone: '456' },
  ]);
  assert.deepEqual(resArray.clean, [{ name: 'spot1' }, { name: 'spot2' }]);
  assert.deepEqual(resArray.dropped.sort(), ['[0].plate', '[1].phone']);

  // Custom base path
  const resPath = car.stripIdentity({ vin: 'secret', safe: 1 }, 'payload');
  assert.deepEqual(resPath.clean, { safe: 1 });
  assert.deepEqual(resPath.dropped, ['payload.vin']);
});

test('checkAuth validates all edge cases including version, malformed, exp, and verify callback', () => {
  const validClaims = { carId: 'car-99', exp: Math.floor(T0 / 1000) + 300, scopes: ['spot:read'] };
  const validHeader = car.buildAuthHeader(validClaims, 'valid-signature');

  // Prefix mismatch
  assert.equal(car.checkAuth('Bearer pw2.car-99.1700000000.spot:read.sig').reason, 'version');
  assert.equal(car.checkAuth('pw2.car-99.1700000000.spot:read.sig').reason, 'version');

  // Non-5 parts (malformed)
  assert.equal(car.checkAuth('pw1.car-99.1700000000.spot:read').reason, 'malformed'); // 4 parts
  assert.equal(car.checkAuth('pw1.car-99.1700000000.spot:read.sig.extra').reason, 'malformed'); // 6 parts

  // Empty carId
  assert.equal(car.checkAuth('Bearer pw1..1700000000.spot:read.sig').reason, 'no-car-id');

  // NaN exp
  assert.equal(car.checkAuth('Bearer pw1.car-99.not-a-number.spot:read.sig').reason, 'malformed');

  // Expired token
  assert.equal(car.checkAuth(validHeader, { now: T0 + 500 * 1000 }).reason, 'expired');

  // Missing signature
  assert.equal(car.checkAuth(`Bearer pw1.car-99.${validClaims.exp}.spot:read.`, { now: T0 }).reason, 'no-signature');

  // Scope mismatch
  assert.equal(car.checkAuth(validHeader, { now: T0, scope: 'spot:write' }).reason, 'scope');

  // Empty scopes part in token
  assert.equal(car.checkAuth(`Bearer pw1.car-99.${validClaims.exp}..sig`, { now: T0, scope: 'spot:read' }).reason, 'scope');

  // Unknown scope
  assert.equal(car.checkAuth(`Bearer pw1.car-99.${validClaims.exp}.unknown:scope.sig`, { now: T0 }).reason, 'unknown-scope');

  // Verify callback returning false vs true
  const failVerify = car.checkAuth(validHeader, { now: T0, verify: () => false });
  assert.equal(failVerify.ok, false);
  assert.equal(failVerify.reason, 'bad-signature');
  assert.equal(failVerify.signatureChecked, false);

  let verifyArgs = null;
  const passVerify = car.checkAuth(validHeader, {
    now: T0,
    verify: (canon, sig) => {
      verifyArgs = { canon, sig };
      return true;
    },
  });
  assert.equal(passVerify.ok, true);
  assert.equal(passVerify.reason, '');
  assert.equal(passVerify.signatureChecked, true);
  assert.equal(verifyArgs.sig, 'valid-signature');
  assert.equal(verifyArgs.canon, car.canonicalAuthString(validClaims));

  // canonicalAuthString with omitted claims
  assert.equal(car.canonicalAuthString(), 'pw1..0.');
  assert.equal(car.canonicalAuthString(null), 'pw1..0.');
});

test('isExpired edge cases with null, empty ts, or invalid dates', () => {
  assert.equal(car.isExpired(null), true);
  assert.equal(car.isExpired({}), true);
  assert.equal(car.isExpired({ ts: '' }), true);
  assert.equal(car.isExpired({ ts: 'invalid-date' }), true);

  const freshEvent = { ts: new Date().toISOString(), ttlS: 120 };
  assert.equal(car.isExpired(freshEvent), false); // using default Date.now()
});
