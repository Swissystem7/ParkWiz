// ParkWiz — spot-freed event core. The spine of EPIC #265 ("the moment a spot
// frees, the system tells the driver where to go").
//
// Everything in the epic hangs off one event, so the event lives here once:
//   * row 2  (core value)        — occupied -> free transitions become events.
//   * row 3  (alert relay)       — relayPayload() is the ONLY shape that may
//                                  leave the browser: {lot, spotId, freedAt}.
//   * row 5  (privacy by design) — no frame, no crop, no plate, no driver id
//                                  ever enters an event or a payload.
//   * row 7  (accuracy)          — a low-confidence or half-confirmed reading
//                                  reports 'uncertain' (yellow) instead of a
//                                  wrong green, and a transition must hold for
//                                  confirmFrames before it fires an alert.
//   * row 9  (reserved spots)    — every spot carries a type, and an event is
//                                  only `eligible` for drivers allowed to use it.
//   * row 10 (navigate to spot)  — destinationHe() + navigationLinks() turn an
//                                  event into "where do I drive".
//
// Pure functions and one factory, zero dependencies, UMD like the rest of
// src/lib. The UI surfaces (operator board, camera demo, kiosk sign, relay)
// each layer on top; none of them re-implements the transition rule.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizSpotFreed = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Row 9. A driver is alerted only about spots they may actually park in —
  // alerting a visitor about a tenant bay is worse than not alerting at all,
  // because they drive over and find it is not theirs.
  const SPOT_TYPES = Object.freeze({
    visitor: Object.freeze({ id: 'visitor', he: 'מבקרים' }),
    tenant: Object.freeze({ id: 'tenant', he: 'דיירים' }),
    disabled: Object.freeze({ id: 'disabled', he: 'נכים' }),
    ev: Object.freeze({ id: 'ev', he: 'טעינה חשמלית' }),
  });
  const DEFAULT_ALLOWED = Object.freeze(['visitor']);

  const FREE = 'free';
  const OCCUPIED = 'occupied';
  const UNCERTAIN = 'uncertain';

  // Park Atidim, Tel Aviv — the gate a driver is sent to, not the bay itself:
  // consumer navigation apps route to a street address, and the last 40 metres
  // are the lot's own signage plus the floor/bay in the alert text.
  const ATIDIM_ENTRANCE = Object.freeze({
    lat: 32.1136,
    lon: 34.8395,
    name: 'פארק עתידים — שער ראשי',
  });

  function clamp01(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function normalizeType(value) {
    const key = String(value === undefined || value === null ? '' : value).toLowerCase();
    return SPOT_TYPES[key] ? key : 'visitor';
  }

  function typeHe(value) {
    return SPOT_TYPES[normalizeType(value)].he;
  }

  function normalizeAllowed(list) {
    if (!Array.isArray(list) || list.length === 0) return DEFAULT_ALLOWED.slice();
    const out = [];
    for (const item of list) {
      const t = normalizeType(item);
      if (!out.includes(t)) out.push(t);
    }
    return out;
  }

  // Grid labels shared by the board, the camera overlay and the kiosk sign, so
  // "B-03" means the same bay on all three. Rows are letters, columns 1-based.
  function labelGrid(cols, rows) {
    const c = Math.max(0, Math.trunc(Number(cols)) || 0);
    const r = Math.max(0, Math.trunc(Number(rows)) || 0);
    const ids = [];
    for (let row = 0; row < r; row++) {
      const letter = String.fromCharCode(65 + (row % 26));
      for (let col = 0; col < c; col++) {
        ids.push(letter + '-' + (col + 1 < 10 ? '0' : '') + (col + 1));
      }
    }
    return ids;
  }

  // Reproducible type mix for the demo lots: the same bay is always the EV bay,
  // so a screenshot taken in rehearsal still matches the room.
  function demoSpotTypes(ids) {
    const out = {};
    (Array.isArray(ids) ? ids : []).forEach((id, i) => {
      const n = i + 1;
      out[String(id)] = n % 7 === 0 ? 'disabled' : (n % 5 === 0 ? 'ev' : (n % 3 === 0 ? 'tenant' : 'visitor'));
    });
    return out;
  }

  // Row 7. Below minConfidence we refuse to read the frame at all — the
  // night/rain case the dashboard paints yellow rather than guessing green.
  function readingOf(spot, minConfidence) {
    const raw = Number(spot && spot.confidence);
    const confidence = Number.isFinite(raw) ? clamp01(raw) : 1;
    if (confidence < minConfidence) return { state: UNCERTAIN, confidence };
    return { state: spot && spot.occupied ? OCCUPIED : FREE, confidence };
  }

  /**
   * Tracks one lot across observations and emits confirmed transitions.
   *
   * observe(spots, nowMs) -> { events, states }
   *   spots  — [{ id, occupied, confidence?, type? }]
   *   events — [{ kind:'freed'|'taken', lot, spotId, spotType, at, confidence, eligible }]
   *   states — { [spotId]: 'free' | 'occupied' | 'uncertain' } for painting the map
   *
   * The first observation of a spot only establishes a baseline: a camera that
   * boots pointing at an empty lot must not alert 60 drivers at once.
   */
  function createFreedTracker(options) {
    const opt = options || {};
    const lot = String(opt.lot || 'atidim');
    const confirmFrames = Math.max(1, Math.trunc(Number(opt.confirmFrames)) || 1);
    const minConfidence = opt.minConfidence === undefined ? 0.6 : clamp01(opt.minConfidence);
    const declaredTypes = opt.spotTypes && typeof opt.spotTypes === 'object' ? opt.spotTypes : {};
    const allowed = normalizeAllowed(opt.allowedTypes);
    const tracked = new Map();

    function observe(spots, nowMs) {
      const at = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
      const list = Array.isArray(spots) ? spots : [];
      const events = [];
      const states = {};
      for (const raw of list) {
        if (!raw || raw.id === undefined || raw.id === null) continue;
        const id = String(raw.id);
        const type = normalizeType(raw.type === undefined ? declaredTypes[id] : raw.type);
        const read = readingOf(raw, minConfidence);
        let rec = tracked.get(id);
        if (!rec) {
          rec = { state: read.state, pending: null, count: 0, type };
          tracked.set(id, rec);
          states[id] = read.state;
          continue;
        }
        rec.type = type;
        if (read.state === UNCERTAIN) {
          // An untrusted frame neither confirms nor cancels: it just stops the
          // clock on whatever transition was building.
          rec.pending = null;
          rec.count = 0;
          states[id] = UNCERTAIN;
          continue;
        }
        if (read.state === rec.state) {
          rec.pending = null;
          rec.count = 0;
          states[id] = rec.state;
          continue;
        }
        rec.count = rec.pending === read.state ? rec.count + 1 : 1;
        rec.pending = read.state;
        if (rec.count < confirmFrames) {
          // Mid-transition and not yet trusted — yellow, never a green we may
          // have to take back one frame later.
          states[id] = UNCERTAIN;
          continue;
        }
        const was = rec.state;
        rec.state = read.state;
        rec.pending = null;
        rec.count = 0;
        states[id] = rec.state;
        if (was === OCCUPIED || was === FREE) {
          events.push(Object.freeze({
            kind: rec.state === FREE ? 'freed' : 'taken',
            lot,
            spotId: id,
            spotType: type,
            at,
            confidence: Number(read.confidence.toFixed(3)),
            eligible: allowed.includes(type),
          }));
        }
      }
      return { events, states };
    }

    return {
      lot,
      confirmFrames,
      minConfidence,
      allowedTypes: allowed.slice(),
      observe,
      stateOf(id) {
        const rec = tracked.get(String(id));
        return rec ? rec.state : null;
      },
    };
  }

  // Rows 3 + 5. The relay is allowed to know that a bay opened and nothing
  // else. Built by whitelist, never by deleting fields off an event, so a field
  // added to the event later cannot leak by default.
  function relayPayload(event) {
    if (!event || event.kind !== 'freed') return null;
    return { lot: String(event.lot || ''), spotId: String(event.spotId || ''), freedAt: Number(event.at) || 0 };
  }

  function freedEvents(events, opts) {
    const onlyEligible = !opts || opts.onlyEligible !== false;
    return (Array.isArray(events) ? events : [])
      .filter((e) => e && e.kind === 'freed' && (!onlyEligible || e.eligible));
  }

  function agoHe(ms) {
    const delta = Math.max(0, Math.round(Number(ms) || 0));
    if (delta < 10000) return 'ממש עכשיו';
    const seconds = Math.round(delta / 1000);
    if (seconds < 60) return 'לפני ' + seconds + ' שניות';
    const minutes = Math.round(seconds / 60);
    if (minutes === 1) return 'לפני דקה';
    if (minutes < 60) return 'לפני ' + minutes + ' דקות';
    const hours = Math.round(minutes / 60);
    return hours === 1 ? 'לפני שעה' : 'לפני ' + hours + ' שעות';
  }

  // Row 10, half one: which bay, on which floor, in which lot. The floor map is
  // per-lot config, so a second lot does not need a code change.
  function destinationHe(event, opts) {
    if (!event) return '';
    const o = opts || {};
    const floors = o.floors && typeof o.floors === 'object' ? o.floors : {};
    const id = String(event.spotId || '');
    const floor = floors[id.split('-')[0]];
    return [o.lotName || 'חניון פארק עתידים', floor, 'מקום ' + id].filter(Boolean).join(' · ');
  }

  function alertTextHe(event, opts) {
    if (!event || event.kind !== 'freed') return '';
    const o = opts || {};
    const now = Number.isFinite(Number(o.nowMs)) ? Number(o.nowMs) : Number(event.at);
    return 'התפנה מקום ' + String(event.spotId) + ' (' + typeHe(event.spotType) + ') · '
      + destinationHe(event, o) + ' · ' + agoHe(now - Number(event.at));
  }

  // Row 10, half two: the deep links. Both apps accept a lat,lon destination,
  // which is why the lot config carries coordinates and not a typed address.
  function navigationLinks(entrance) {
    const e = entrance || ATIDIM_ENTRANCE;
    const lat = Number(e.lat);
    const lon = Number(e.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const ll = lat + ',' + lon;
    return {
      label: String(e.name || ATIDIM_ENTRANCE.name),
      waze: 'https://waze.com/ul?ll=' + encodeURIComponent(ll) + '&navigate=yes',
      google: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(ll),
    };
  }

  return {
    SPOT_TYPES,
    DEFAULT_ALLOWED,
    ATIDIM_ENTRANCE,
    FREE,
    OCCUPIED,
    UNCERTAIN,
    normalizeType,
    typeHe,
    normalizeAllowed,
    labelGrid,
    demoSpotTypes,
    createFreedTracker,
    relayPayload,
    freedEvents,
    agoHe,
    destinationHe,
    alertTextHe,
    navigationLinks,
  };
});
