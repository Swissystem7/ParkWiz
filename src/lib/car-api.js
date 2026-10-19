// ParkWiz — the car ↔ app event contract (#267, EPIC #265 row 16).
//
// A connected car is not a browser. It cannot log in, it cannot read a toast,
// and whatever it sends travels over somebody else's telematics cloud. So the
// contract here is deliberately narrow: three event types (spot-freed,
// spot-claim, spot-release), a geofenced relay, and a hard privacy rule that
// no plate, VIN or driver name may cross the wire — normalizeEvent *drops*
// those keys rather than trusting a caller to leave them out, because the
// buyer pages promise "בלי לוחיות" and a telematics payload is exactly where
// a VIN leaks in by accident.
//
// Nothing here talks to the network, so the whole file is testable offline.
// The spot ranker and the Smartcar / read-only OCPP adapters, the wire-contract
// docs (docs/car-api.md, docs/car-api-he.md) and the browser simulator land
// with the rest of #267 — see docs/dev/PR-275-SPLIT.md.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizCarApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PROTOCOL_VERSION = 1;
  const EVENTS = Object.freeze(['spot-freed', 'spot-claim', 'spot-release']);
  const SPOT_KINDS = Object.freeze(['street', 'lot', 'charger']);
  const RELEASE_REASONS = Object.freeze(['taken', 'gave-up', 'expired']);
  // Keys that must never reach the relay. Matched case-insensitively against
  // every key at every depth, so {vehicle:{VIN}} is dropped too.
  const IDENTITY_KEYS = Object.freeze([
    'plate', 'platenumber', 'licenseplate', 'license_plate', 'vin',
    'drivername', 'driver_name', 'phone', 'email', 'imei', 'deviceid',
  ]);
  // A freed spot is a perishable claim: past this the subscriber must re-check
  // rather than drive to it. 120s is roughly the Waze-style confidence decay
  // already used on the map demo.
  const DEFAULT_TTL_S = 120;
  const MAX_TTL_S = 900;
  // Default geofence for "nearby subscribed cars". Wider than this and a car
  // gets woken for spots it cannot reach before the TTL expires.
  const DEFAULT_RADIUS_M = 800;
  const MAX_RADIUS_M = 5000;
  const AUTH_PREFIX = 'pw1';
  const SCOPES = Object.freeze(['spot:read', 'spot:write']);

  function num(value, fallback) {
    const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function str(value) {
    return value == null ? '' : String(value).trim();
  }

  // Great-circle metres. Spots inside one city are tens to hundreds of metres
  // apart, where a flat-earth approximation is already off by enough to pick
  // the wrong bay, so this stays a real haversine.
  function distanceM(a, b) {
    const lat1 = num(a && a.lat, NaN);
    const lon1 = num(a && a.lon, NaN);
    const lat2 = num(b && b.lat, NaN);
    const lon2 = num(b && b.lon, NaN);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const R = 6371000;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // --- privacy ------------------------------------------------------------

  // Returns a copy with every identity-ish key removed, plus the list of paths
  // that were dropped. The list matters: the demo page shows it, so a DPO
  // watching can see the guard fire instead of taking our word for it.
  function stripIdentity(input, path) {
    const base = path || '';
    const dropped = [];
    const walk = (value, at) => {
      if (Array.isArray(value)) {
        return value.map((item, i) => walk(item, at + '[' + i + ']'));
      }
      if (!value || typeof value !== 'object') return value;
      const out = {};
      Object.keys(value).forEach((key) => {
        const here = at ? at + '.' + key : key;
        if (IDENTITY_KEYS.indexOf(key.toLowerCase()) !== -1) {
          dropped.push(here);
          return;
        }
        out[key] = walk(value[key], here);
      });
      return out;
    };
    return { clean: walk(input, base), dropped };
  }

  // --- auth ---------------------------------------------------------------

  // Token shape only: pw1.<carId>.<expEpochS>.<scope+scope>.<sig>. The
  // signature is an HMAC-SHA256 over canonicalAuthString() computed by the
  // relay with CAR_RELAY_SECRET from the environment — this file deliberately
  // does not implement it, so nobody can mistake the browser demo for a place
  // where a shared secret lives. Pass opts.verify to check the signature where
  // one is actually available.
  function canonicalAuthString(claims) {
    const c = claims || {};
    return [AUTH_PREFIX, str(c.carId), String(num(c.exp, 0)), (c.scopes || []).join('+')].join('.');
  }

  function buildAuthHeader(claims, sig) {
    return 'Bearer ' + canonicalAuthString(claims) + '.' + str(sig);
  }

  function checkAuth(header, opts) {
    const o = opts || {};
    const nowS = Math.floor(num(o.now, Date.now()) / 1000);
    const raw = str(header).replace(/^Bearer\s+/i, '');
    const parts = raw.split('.');
    const fail = (reason) => ({ ok: false, reason, carId: '', scopes: [], signatureChecked: false });
    if (parts.length !== 5) return fail('malformed');
    if (parts[0] !== AUTH_PREFIX) return fail('version');
    const carId = parts[1];
    const exp = num(parts[2], NaN);
    const scopes = parts[3] ? parts[3].split('+') : [];
    const sig = parts[4];
    if (!carId) return fail('no-car-id');
    if (!Number.isFinite(exp)) return fail('malformed');
    if (exp <= nowS) return fail('expired');
    if (!sig) return fail('no-signature');
    if (scopes.some((s) => SCOPES.indexOf(s) === -1)) return fail('unknown-scope');
    if (o.scope && scopes.indexOf(o.scope) === -1) return fail('scope');
    let signatureChecked = false;
    if (typeof o.verify === 'function') {
      if (!o.verify(canonicalAuthString({ carId, exp, scopes }), sig)) return fail('bad-signature');
      signatureChecked = true;
    }
    return { ok: true, reason: '', carId, scopes, exp, signatureChecked };
  }

  // --- the event contract -------------------------------------------------

  function normalizeSpot(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = str(raw.id);
    if (!id) return null;
    const lat = num(raw.lat, NaN);
    const lon = num(raw.lon, NaN);
    const kind = SPOT_KINDS.indexOf(str(raw.kind)) !== -1 ? str(raw.kind) : 'street';
    const spot = { id, kind };
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      spot.lat = lat;
      spot.lon = lon;
    }
    if (kind === 'charger' && raw.charger && typeof raw.charger === 'object') {
      spot.charger = {
        ocppId: str(raw.charger.ocppId),
        connectorId: num(raw.charger.connectorId, 1),
        kw: num(raw.charger.kw, null),
      };
    }
    return spot;
  }

  // Opt-in is a field, not an assumption: a source without consent:'opt-in'
  // is rejected by validateEvent, so a fleet that forgot the consent screen
  // cannot stream departures through the relay by default.
  function normalizeSource(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const kind = ['car', 'app', 'ocpp'].indexOf(str(r.kind)) !== -1 ? str(r.kind) : 'app';
    return {
      kind,
      carId: str(r.carId),
      consent: str(r.consent) === 'opt-in' ? 'opt-in' : '',
    };
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const { clean, dropped } = stripIdentity(raw);
    const type = str(clean.type);
    if (EVENTS.indexOf(type) === -1) return null;
    const spot = normalizeSpot(clean.spot);
    if (!spot) return null;
    const tsMs = clean.ts ? Date.parse(clean.ts) : num(clean.tsMs, NaN);
    const ts = Number.isFinite(tsMs) ? new Date(tsMs).toISOString() : '';
    const event = {
      v: PROTOCOL_VERSION,
      type,
      id: str(clean.id) || [type, spot.id, ts || 'no-ts'].join(':'),
      ts,
      ttlS: clamp(num(clean.ttlS, DEFAULT_TTL_S), 1, MAX_TTL_S),
      spot,
      source: normalizeSource(clean.source),
      droppedFields: dropped,
    };
    if (type === 'spot-freed') {
      event.confidence = clamp(num(clean.confidence, 0.6), 0, 1);
    }
    if (type === 'spot-claim') {
      event.etaS = clamp(num(clean.etaS, 60), 0, 3600);
    }
    if (type === 'spot-release') {
      event.reason = RELEASE_REASONS.indexOf(str(clean.reason)) !== -1 ? str(clean.reason) : 'gave-up';
    }
    return event;
  }

  function validateEvent(raw) {
    const errors = [];
    const event = normalizeEvent(raw);
    if (!event) {
      const type = str(raw && raw.type);
      if (EVENTS.indexOf(type) === -1) errors.push('type');
      else errors.push('spot');
      return { ok: false, errors, event: null };
    }
    if (!event.ts) errors.push('ts');
    if (!event.source.carId) errors.push('source.carId');
    if (event.source.consent !== 'opt-in') errors.push('source.consent');
    // A claim or a release can name a spot by id alone, but a freed spot
    // nobody can locate is undeliverable — the relay fans out by geofence.
    if (event.type === 'spot-freed' && !Number.isFinite(event.spot.lat)) {
      errors.push('spot.lat/lon');
    }
    return { ok: errors.length === 0, errors, event };
  }

  function isExpired(event, nowMs) {
    if (!event || !event.ts) return true;
    const t = Date.parse(event.ts);
    if (!Number.isFinite(t)) return true;
    return num(nowMs, Date.now()) - t > event.ttlS * 1000;
  }

  // --- the relay (#265 row 3) --------------------------------------------

  // In-process pub/sub with the same semantics the hosted relay has to keep:
  // geofenced fan-out, at-most-once per event id, TTL drop, and no delivery
  // back to the publisher. The demo page runs this in the browser; a server
  // can require() the same file so the contract cannot drift between them.
  function createRelay(opts) {
    const o = opts || {};
    const now = typeof o.now === 'function' ? o.now : () => Date.now();
    const subs = new Map();
    // id -> the ms at which the event it belongs to expires. A plain Set would
    // grow for as long as the relay runs; pruning on expiry is safe because a
    // re-publish of an expired id is rejected by the TTL check anyway.
    const seen = new Map();
    let seq = 0;
    const stats = { published: 0, rejected: 0, delivered: 0, duplicates: 0, expired: 0 };

    function subscribe(sub) {
      const s = sub || {};
      const id = 'sub-' + (++seq);
      const entry = {
        id,
        carId: str(s.carId),
        at: { lat: num(s.at && s.at.lat, NaN), lon: num(s.at && s.at.lon, NaN) },
        radiusM: clamp(num(s.radiusM, DEFAULT_RADIUS_M), 1, MAX_RADIUS_M),
        types: Array.isArray(s.types) && s.types.length ? s.types.filter((t) => EVENTS.indexOf(t) !== -1) : EVENTS.slice(),
        onEvent: typeof s.onEvent === 'function' ? s.onEvent : () => {},
      };
      subs.set(id, entry);
      return () => { subs.delete(id); };
    }

    function publish(raw) {
      const check = validateEvent(raw);
      if (!check.ok) {
        stats.rejected += 1;
        return { ok: false, errors: check.errors, delivered: 0, event: check.event };
      }
      const event = check.event;
      const nowMs = now();
      seen.forEach((expiresAt, id) => { if (expiresAt <= nowMs) seen.delete(id); });
      if (seen.has(event.id)) {
        stats.duplicates += 1;
        return { ok: false, errors: ['duplicate'], delivered: 0, event };
      }
      if (isExpired(event, nowMs)) {
        stats.expired += 1;
        return { ok: false, errors: ['expired'], delivered: 0, event };
      }
      seen.set(event.id, Date.parse(event.ts) + event.ttlS * 1000);
      stats.published += 1;
      let delivered = 0;
      subs.forEach((entry) => {
        if (entry.types.indexOf(event.type) === -1) return;
        // A car never hears its own departure echoed back.
        if (entry.carId && entry.carId === event.source.carId) return;
        const d = distanceM(entry.at, event.spot);
        if (d == null || d > entry.radiusM) return;
        delivered += 1;
        entry.onEvent(event, { distanceM: d, subscriberId: entry.id });
      });
      stats.delivered += delivered;
      return { ok: true, errors: [], delivered, event };
    }

    return {
      subscribe,
      publish,
      subscriberCount: () => subs.size,
      stats: () => ({ ...stats }),
    };
  }

  return {
    PROTOCOL_VERSION,
    EVENTS,
    SPOT_KINDS,
    RELEASE_REASONS,
    IDENTITY_KEYS,
    DEFAULT_TTL_S,
    MAX_TTL_S,
    DEFAULT_RADIUS_M,
    SCOPES,
    distanceM,
    stripIdentity,
    canonicalAuthString,
    buildAuthHeader,
    checkAuth,
    normalizeSpot,
    normalizeSource,
    normalizeEvent,
    validateEvent,
    isExpired,
    createRelay,
  };
});
