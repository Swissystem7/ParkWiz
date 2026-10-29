/**
 * CityZone connector (C3) — ParkWiz ↔ CityZone integration boundary.
 *
 * Interface:
 *   createCityZoneConnector({ transport }) → { transport,
 *     pushOccupancy(lotId, snapshot), pushSpotFreed(event), fetchLotConfig(lotId) }
 *   createMockTransport({ configByLot })   → in-memory transport recording `calls`.
 *   createInMemoryTransport                → alias of createMockTransport.
 *   createHttpTransport({ baseUrl })       → stub; always throws "not configured".
 *   toCityZoneFreed(event)                 → { lotId, spotId, freedAt }
 *     Accepts the relay shape { lot, spotId, freedAt } and the connector
 *     shape { lotId, spotId, freedAt | timestamp }. `lot` is copied to
 *     `lotId`. Output never carries `lot` or `timestamp`.
 *
 * fetchLotConfig returns only lotId, name, total, and spots[{id, state}].
 * Any other key is rejected. Real HTTP is not implemented here.
 *
 * Privacy (fail-closed): occupancy data is counts / spot states only.
 * Never send images, frames, video, faces, licence plates or vehicle ids.
 * Any key whose normalised form (lowercase, `-_ ` stripped) contains
 * image|img|photo|picture|frame|video|face|facial|plate|licenseplate|
 * lpn|vehicleid|vin — at any depth — is rejected with TypeError, as is
 * any key outside the explicit allowlists below.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizCityZone = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SPOT_STATES = ['free', 'occupied', 'reserved', 'disabled'];
  const FORBIDDEN = ['image', 'img', 'photo', 'picture', 'frame', 'video',
    'face', 'facial', 'plate', 'licenseplate', 'lpn', 'vehicleid', 'vin'];
  const SNAPSHOT_KEYS = ['total', 'occupied', 'free', 'timestamp', 'ts', 'spots'];
  const SPOT_KEYS = ['id', 'state'];
  const FREED_KEYS = ['lot', 'lotId', 'spotId', 'freedAt', 'timestamp'];
  const CONFIG_KEYS = ['lotId', 'name', 'total', 'spots'];

  const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

  function assertNonEmptyString(value, name) {
    if (!nonEmpty(value)) throw new TypeError(`CityZone: ${name} must be a non-empty string`);
  }

  function scanForbidden(value) {
    if (Array.isArray(value)) { value.forEach(scanForbidden); return; }
    if (!isObj(value)) return;
    for (const key of Object.keys(value)) {
      const norm = key.toLowerCase().replace(/[-_ ]/g, '');
      if (FORBIDDEN.some((f) => norm.includes(f))) {
        throw new TypeError(`CityZone: forbidden field: ${key}`);
      }
      scanForbidden(value[key]);
    }
  }

  function assertAllowlist(obj, allowed, where) {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) throw new TypeError(`CityZone: unknown field: ${key} (${where})`);
    }
  }

  function countField(value, name, required) {
    if (value === undefined) {
      if (required) throw new TypeError(`CityZone: ${name} is required`);
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new TypeError(`CityZone: ${name} must be an integer`);
    }
    if (value < 0) throw new RangeError(`CityZone: ${name} must be non-negative`);
    return value;
  }

  function optionalString(value, name) {
    if (value !== undefined && typeof value !== 'string') {
      throw new TypeError(`CityZone: ${name} must be a string`);
    }
    return value;
  }

  function createMockTransport({ configByLot = {} } = {}) {
    const calls = [];
    return {
      calls,
      pushOccupancy(lotId, payload) {
        calls.push({ method: 'pushOccupancy', lotId, payload });
        return { accepted: true };
      },
      pushSpotFreed(event) {
        calls.push({ method: 'pushSpotFreed', lotId: event.lotId, payload: event });
        return { accepted: true };
      },
      fetchLotConfig(lotId) {
        calls.push({ method: 'fetchLotConfig', lotId });
        return configByLot[lotId] || null;
      },
    };
  }

  function createHttpTransport({ baseUrl } = {}) {
    const fail = () => {
      if (!baseUrl) throw new Error('CityZone transport not configured: missing base URL');
      throw new Error('CityZone transport not configured: HTTP transport is a stub');
    };
    return { pushOccupancy: fail, pushSpotFreed: fail, fetchLotConfig: fail };
  }

  function normalizeSnapshot(snapshot) {
    if (!isObj(snapshot)) throw new TypeError('CityZone: snapshot must be an object');
    scanForbidden(snapshot);
    assertAllowlist(snapshot, SNAPSHOT_KEYS, 'snapshot');
    const total = countField(snapshot.total, 'total', true);
    const occupied = countField(snapshot.occupied, 'occupied', true);
    if (occupied > total) throw new RangeError('CityZone: occupied must not exceed total');
    const payload = { total, occupied };
    if (snapshot.free !== undefined) {
      payload.free = countField(snapshot.free, 'free', false);
      if (payload.free > total) throw new RangeError('CityZone: free must not exceed total');
    }
    optionalString(snapshot.timestamp, 'timestamp');
    optionalString(snapshot.ts, 'ts');
    const timestamp = snapshot.timestamp !== undefined ? snapshot.timestamp : snapshot.ts;
    if (timestamp !== undefined) payload.timestamp = timestamp;
    if (snapshot.spots !== undefined) payload.spots = normalizeSpots(snapshot.spots);
    return payload;
  }

  function normalizeSpots(spots) {
    if (!Array.isArray(spots)) throw new TypeError('CityZone: spots must be an array');
    return spots.map((spot) => {
      if (!isObj(spot)) throw new TypeError('CityZone: spot must be an object');
      scanForbidden(spot);
      assertAllowlist(spot, SPOT_KEYS, 'spot');
      assertNonEmptyString(spot.id, 'spot.id');
      if (!SPOT_STATES.includes(spot.state)) {
        throw new TypeError(`CityZone: spot.state must be one of ${SPOT_STATES.join(', ')}`);
      }
      return { id: spot.id, state: spot.state };
    });
  }

  // Relay payloads use `lot` (spot-freed.js). The connector wire shape uses
  // `lotId`. Both may be present only when they are the same string.
  function lotIdOf(event) {
    const hasId = event.lotId !== undefined;
    const hasLot = event.lot !== undefined;
    if (hasId) assertNonEmptyString(event.lotId, 'lotId');
    if (hasLot) assertNonEmptyString(event.lot, 'lot');
    if (hasId && hasLot && event.lotId !== event.lot) {
      throw new TypeError('CityZone: lot and lotId disagree');
    }
    if (!hasId && !hasLot) throw new TypeError('CityZone: lotId must be a non-empty string');
    return hasId ? event.lotId : event.lot;
  }

  // `freedAt` from the relay is a finite number of milliseconds. The connector
  // also accepts an ISO string, or `timestamp` as a string alias. Zero is a
  // real instant, so it must not collapse to null.
  function coerceFreedAt(value, name) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length > 0) return value;
    throw new TypeError(`CityZone: ${name} must be a non-empty string or a finite number`);
  }

  function pickFreedAt(event) {
    if (event.freedAt !== undefined && event.freedAt !== null) return coerceFreedAt(event.freedAt, 'freedAt');
    if (event.timestamp !== undefined && event.timestamp !== null) return coerceFreedAt(event.timestamp, 'timestamp');
    return null;
  }

  function toCityZoneFreed(event) {
    if (!isObj(event)) throw new TypeError('CityZone: event must be an object');
    scanForbidden(event);
    assertAllowlist(event, FREED_KEYS, 'event');
    const lotId = lotIdOf(event);
    assertNonEmptyString(event.spotId, 'spotId');
    return { lotId, spotId: event.spotId, freedAt: pickFreedAt(event) };
  }

  function normalizeLotConfig(config) {
    if (config === null || config === undefined) return null;
    if (!isObj(config)) throw new TypeError('CityZone: lot config must be an object');
    scanForbidden(config);
    assertAllowlist(config, CONFIG_KEYS, 'lot config');
    const out = {};
    if (config.lotId !== undefined) {
      assertNonEmptyString(config.lotId, 'lotId');
      out.lotId = config.lotId;
    }
    if (config.name !== undefined) {
      assertNonEmptyString(config.name, 'name');
      out.name = config.name;
    }
    if (config.total !== undefined) out.total = countField(config.total, 'total', false);
    if (config.spots !== undefined) out.spots = normalizeSpots(config.spots);
    return out;
  }

  function createCityZoneConnector({ transport } = {}) {
    const t = transport || createMockTransport();
    return {
      transport: t,
      pushOccupancy(lotId, snapshot) {
        assertNonEmptyString(lotId, 'lotId');
        return t.pushOccupancy(lotId, normalizeSnapshot(snapshot));
      },
      pushSpotFreed(event) {
        return t.pushSpotFreed(toCityZoneFreed(event));
      },
      fetchLotConfig(lotId) {
        assertNonEmptyString(lotId, 'lotId');
        return normalizeLotConfig(t.fetchLotConfig(lotId));
      },
    };
  }

  return {
    createCityZoneConnector,
    createMockTransport,
    createInMemoryTransport: createMockTransport,
    createHttpTransport,
    toCityZoneFreed,
    SPOT_STATES,
  };
});
