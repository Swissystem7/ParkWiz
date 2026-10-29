// CityZone occupancy snapshot — one slice of the C3 connector (draft PR #370).
//
// PR #370 owns the transport boundary (mock, HTTP stub, push/fetch). This
// module is the producer in front of that boundary, and it does not import
// it: a snapshot built here is the only occupancy document CityZone may
// receive, and it is useful before that draft lands.
//
// Counts and spot states only. Built by copying the allowlisted fields, never
// by deleting keys off a camera reading, so geometry, stream URLs, and a
// field added later cannot leak by default. A forbidden key (image, plate,
// face, vehicle id, and the same list as the connector) at any depth is a
// TypeError — fail closed, including on the options object.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizCityZoneOccupancy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SPOT_STATES = ['free', 'occupied', 'reserved', 'disabled'];
  const FORBIDDEN = ['image', 'img', 'photo', 'picture', 'frame', 'video',
    'face', 'facial', 'plate', 'licenseplate', 'lpn', 'vehicleid', 'vin'];
  // Same default as createFreedTracker: below this we refuse to call a bay
  // free or occupied. Missing confidence is treated as sure (the board model
  // does not always send one).
  const DEFAULT_MIN_CONFIDENCE = 0.6;

  const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

  function scanForbidden(value) {
    if (Array.isArray(value)) {
      value.forEach(scanForbidden);
      return;
    }
    if (!isObj(value)) return;
    for (const key of Object.keys(value)) {
      const norm = key.toLowerCase().replace(/[-_ ]/g, '');
      if (FORBIDDEN.some((f) => norm.includes(f))) {
        throw new TypeError(`CityZone: forbidden field: ${key}`);
      }
      scanForbidden(value[key]);
    }
  }

  // `occupied` and `state` are two views of one fact. If both are present
  // they must agree; a reserved or disabled bay has no boolean to collapse
  // into, so `occupied` beside those states is rejected rather than dropped.
  function resolveState(reading) {
    const hasState = reading.state !== undefined;
    const hasOccupied = reading.occupied !== undefined;
    if (hasState && reading.state === 'uncertain') {
      if (hasOccupied) throw new TypeError('CityZone: uncertain reading cannot also be occupied');
      return 'uncertain';
    }
    if (hasState) {
      if (!SPOT_STATES.includes(reading.state)) {
        throw new TypeError(`CityZone: spot.state must be one of ${SPOT_STATES.join(', ')}, or uncertain`);
      }
      if (hasOccupied) {
        if (typeof reading.occupied !== 'boolean') {
          throw new TypeError('CityZone: occupied must be a boolean');
        }
        const asOccupied = reading.state === 'occupied';
        if (reading.state !== 'occupied' && reading.state !== 'free') {
          throw new TypeError('CityZone: reserved or disabled spot cannot also carry occupied');
        }
        if (reading.occupied !== asOccupied) {
          throw new TypeError('CityZone: occupied disagrees with state');
        }
      }
      return reading.state;
    }
    if (typeof reading.occupied !== 'boolean') {
      throw new TypeError('CityZone: reading needs occupied or state');
    }
    return reading.occupied ? 'occupied' : 'free';
  }

  /**
   * occupancySnapshot(readings, opts) → { total, occupied, free, timestamp?, spots }
   *
   * readings — [{ id, occupied?, state?, confidence?, ...camera fields }]
   * opts.timestamp — optional non-empty string, copied through
   * opts.minConfidence — default 0.6
   *
   * `total` is the number of readings, including ones too unsure to call.
   * Unsure bays are left out of `spots`, `occupied`, and `free`, so
   * occupied + free can be less than total. That gap is the uncertain
   * count; it is never reported as a free bay.
   */
  function occupancySnapshot(readings, opts) {
    if (!Array.isArray(readings)) throw new TypeError('CityZone: readings must be an array');
    const options = opts === undefined || opts === null ? {} : opts;
    if (!isObj(options)) throw new TypeError('CityZone: options must be an object');
    scanForbidden(readings);
    scanForbidden(options);

    let minConfidence = DEFAULT_MIN_CONFIDENCE;
    if (options.minConfidence !== undefined) {
      const raw = Number(options.minConfidence);
      if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
        throw new TypeError('CityZone: minConfidence must be between 0 and 1');
      }
      minConfidence = raw;
    }

    let timestamp;
    if (options.timestamp !== undefined) {
      if (typeof options.timestamp !== 'string' || options.timestamp.length === 0) {
        throw new TypeError('CityZone: timestamp must be a non-empty string');
      }
      timestamp = options.timestamp;
    }

    const seen = new Set();
    let occupied = 0;
    let free = 0;
    const spots = [];
    for (const raw of readings) {
      if (!isObj(raw)) throw new TypeError('CityZone: reading must be an object');
      if (typeof raw.id !== 'string' || raw.id.length === 0) {
        throw new TypeError('CityZone: spot id must be a non-empty string');
      }
      if (seen.has(raw.id)) throw new TypeError(`CityZone: duplicate spot id: ${raw.id}`);
      seen.add(raw.id);

      const confidence = raw.confidence === undefined ? 1 : Number(raw.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new TypeError('CityZone: confidence must be between 0 and 1');
      }
      const state = resolveState(raw);
      if (confidence < minConfidence || state === 'uncertain') continue;
      if (state === 'occupied') occupied += 1;
      else if (state === 'free') free += 1;
      spots.push({ id: raw.id, state });
    }

    const payload = { total: readings.length, occupied, free, spots };
    if (timestamp !== undefined) payload.timestamp = timestamp;
    return payload;
  }

  return {
    SPOT_STATES,
    DEFAULT_MIN_CONFIDENCE,
    occupancySnapshot,
  };
});
