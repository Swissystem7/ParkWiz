/**
 * CityZone connector (C3) — ParkWiz ↔ CityZone integration boundary.
 *
 * Interface:
 *   createCityZoneConnector({ transport }) → { transport,
 *     pushOccupancy(lotId, snapshot), pushSpotFreed(event), fetchLotConfig(lotId) }
 *   createMockTransport({ configByLot })   → in-memory transport recording `calls`.
 *   createInMemoryTransport                → alias of createMockTransport.
 *   createHttpTransport({ baseUrl })       → stub; always throws "not configured".
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
  const FREED_KEYS = ['lotId', 'spotId', 'freedAt', 'timestamp'];

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
    if (snapshot.spots !== undefined) {
      if (!Array.isArray(snapshot.spots)) throw new TypeError('CityZone: spots must be an array');
      payload.spots = snapshot.spots.map((spot) => {
        if (!isObj(spot)) throw new TypeError('CityZone: spot must be an object');
        assertAllowlist(spot, SPOT_KEYS, 'spot');
        assertNonEmptyString(spot.id, 'spot.id');
        if (!SPOT_STATES.includes(spot.state)) {
          throw new TypeError(`CityZone: spot.state must be one of ${SPOT_STATES.join(', ')}`);
        }
        return { id: spot.id, state: spot.state };
      });
    }
    return payload;
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
        if (!isObj(event)) throw new TypeError('CityZone: event must be an object');
        scanForbidden(event);
        assertAllowlist(event, FREED_KEYS, 'event');
        assertNonEmptyString(event.lotId, 'lotId');
        assertNonEmptyString(event.spotId, 'spotId');
        optionalString(event.freedAt, 'freedAt');
        optionalString(event.timestamp, 'timestamp');
        const normalized = {
          lotId: event.lotId,
          spotId: event.spotId,
          freedAt: event.freedAt || event.timestamp || null,
        };
        return t.pushSpotFreed(normalized);
      },
      fetchLotConfig(lotId) {
        assertNonEmptyString(lotId, 'lotId');
        return t.fetchLotConfig(lotId);
      },
    };
  }

  return {
    createCityZoneConnector,
    createMockTransport,
    createInMemoryTransport: createMockTransport,
    createHttpTransport,
    SPOT_STATES,
  };
});
