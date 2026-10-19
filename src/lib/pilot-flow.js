// ParkWiz — the one Atidim pilot flow (#268).
//
// Until now every piece of the pilot owned its own wiring: the camera demo
// counted stalls for itself, the operator board drew its own lot, and the
// driver alert existed only as a sentence in the pitch. This file is the spine
// they share, so there is one path from a camera frame to a driver:
//
//   camera source (browser #264 / Frigate bridge #266 / sample clip)
//     -> occupancy engine (src/lib/atidim-lot.js — calculateOccupancy)
//     -> spot-freed event on the single bus (#263)
//     -> driver alert + navigation + hold (#265), EV bays first if asked
//     -> the four surfaces: נהג / מנהל חניון / שלט כניסה / הגדרות
//
// Pure and DOM-free, UMD like the rest of src/lib, so CI can run the whole
// flow from the sample clip with no browser (test/pilot-e2e.test.js). The
// occupancy numbers are deliberately *not* recomputed here — they come from
// the lot model, which stays the single source of truth for this lot.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizPilotFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Camera sources, in the order the settings surface lists them. One list:
  // adding a source must not mean editing four pages.
  const SOURCES = Object.freeze([
    Object.freeze({
      id: 'sample', labelHe: 'קליפ דוגמה', needs: 'none',
      noteHe: 'קליפ מפוענח ששמור במכשיר — עובד ללא רשת וללא מצלמה. ברירת המחדל להדגמה.',
    }),
    Object.freeze({
      id: 'browser', labelHe: 'מצלמת הדפדפן', needs: 'permission',
      noteHe: 'המצלמה של המכשיר הזה — דורשת אישור מצלמה בדפדפן, והפריים לא יוצא מהמכשיר.',
    }),
    Object.freeze({
      id: 'frigate', labelHe: 'גשר Frigate / NVR', needs: 'url',
      noteHe: 'גשר אל Frigate או אל ה-NVR שבשער — נדרשת כתובת בסיס ברשת המקומית של החניון.',
    }),
  ]);

  // The one Hebrew RTL nav. The flow is a single page with four surfaces, so a
  // presenter moves between נהג and שלט כניסה without a page load — and with
  // no second navigation to keep in sync.
  const SURFACES = Object.freeze([
    Object.freeze({ id: 'driver', labelHe: 'נהג', hash: '#driver', paneId: 'paneDriver' }),
    Object.freeze({ id: 'manager', labelHe: 'מנהל חניון', hash: '#manager', paneId: 'paneManager' }),
    Object.freeze({ id: 'sign', labelHe: 'שלט כניסה', hash: '#sign', paneId: 'paneSign' }),
    Object.freeze({ id: 'settings', labelHe: 'הגדרות', hash: '#settings', paneId: 'paneSettings' }),
  ]);

  const EVENTS = Object.freeze({
    FRAME: 'frame',
    OCCUPANCY: 'occupancy',
    SPOT_FREED: 'spot-freed',
    ALERT: 'driver-alert',
  });

  const SETTINGS_KEY = 'parkwiz.pilot.v1';
  // A hold shorter than half a minute cannot be driven to; longer than ten
  // minutes and the operator is giving away a bay, not holding one.
  const MIN_HOLD_SECONDS = 30;
  const MAX_HOLD_SECONDS = 600;
  const DEFAULT_SETTINGS = Object.freeze({
    sourceId: 'sample',
    frigateUrl: '',
    holdSeconds: 120,
    evOnly: false,
    // Park Atidim, Tel Aviv — approximate gate coordinates, used only to build
    // the navigation deep link. Nothing leaves the device until the driver taps it.
    lat: 32.1133,
    lon: 34.8405,
  });

  function pad2(n) {
    const v = Math.abs(Math.trunc(Number(n) || 0));
    return (v < 10 ? '0' : '') + v;
  }

  function mmss(totalSeconds) {
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }

  function source(id) {
    return SOURCES.find((s) => s.id === String(id)) || SOURCES[0];
  }

  function surfaceFromHash(hash) {
    const want = String(hash || '').replace(/^#/, '').trim().toLowerCase();
    return SURFACES.find((s) => s.id === want) || SURFACES[0];
  }

  // One bus for the whole flow. A handler that throws must not stop the other
  // surfaces from updating — a broken sign cannot take the driver alert down
  // with it — so emit isolates handlers and keeps going.
  function createBus() {
    const handlers = new Map();
    const log = [];
    return {
      on(name, fn) {
        if (typeof fn !== 'function') return function noop() {};
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(fn);
        return function off() {
          const list = handlers.get(name) || [];
          const at = list.indexOf(fn);
          if (at >= 0) list.splice(at, 1);
        };
      },
      emit(name, payload) {
        log.push({ name, payload });
        if (log.length > 200) log.shift();
        (handlers.get(name) || []).slice().forEach((fn) => {
          try { fn(payload); } catch (err) { /* one bad surface must not break the flow */ }
        });
        return payload;
      },
      history(name) {
        return name ? log.filter((entry) => entry.name === name) : log.slice();
      },
    };
  }

  function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // One settings shape for every surface. An unknown source id falls back to
  // the sample clip rather than leaving the flow with no camera at all.
  function normalizeSettings(raw) {
    const r = (raw && typeof raw === 'object') ? raw : {};
    const known = SOURCES.some((s) => s.id === r.sourceId);
    return {
      sourceId: known ? r.sourceId : DEFAULT_SETTINGS.sourceId,
      frigateUrl: typeof r.frigateUrl === 'string' ? r.frigateUrl.trim() : DEFAULT_SETTINGS.frigateUrl,
      holdSeconds: clampInt(r.holdSeconds, MIN_HOLD_SECONDS, MAX_HOLD_SECONDS, DEFAULT_SETTINGS.holdSeconds),
      evOnly: Boolean(r.evOnly),
      lat: finiteOr(r.lat, DEFAULT_SETTINGS.lat),
      lon: finiteOr(r.lon, DEFAULT_SETTINGS.lon),
    };
  }

  // Storage is injectable so tests need no browser, and every access is
  // guarded: Safari private mode throws on localStorage rather than returning null.
  function loadSettings(storage) {
    const store = storage || root.localStorage;
    try {
      return normalizeSettings(JSON.parse(store.getItem(SETTINGS_KEY)));
    } catch (err) {
      return normalizeSettings(null);
    }
  }

  function saveSettings(settings, storage) {
    const next = normalizeSettings(settings);
    const store = storage || root.localStorage;
    try {
      store.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (err) { /* nothing to do: the flow runs on the in-memory copy */ }
    return next;
  }

  // The sample clip stores one row of 0/1 per frame — the *decoded* output of a
  // gate camera, not pixels — so the pipeline runs in CI and offline with no
  // video decoder. Bay ids follow the camera model's zone-NN naming.
  function expandClip(clip) {
    const c = (clip && typeof clip === 'object') ? clip : {};
    const zone = (typeof c.zone === 'string' && c.zone) ? c.zone : 'A';
    const evBays = new Set((Array.isArray(c.evBays) ? c.evBays : []).map(Number));
    const frames = Array.isArray(c.frames) ? c.frames : [];
    return frames.map((frame, index) => {
      const bays = String((frame && frame.bays) || '');
      return {
        index,
        atSec: finiteOr(frame && frame.atSec, index),
        sourceId: typeof c.sourceId === 'string' ? c.sourceId : 'sample',
        spots: bays.split('').map((ch, i) => ({
          id: zone + '-' + pad2(i + 1),
          occupied: ch === '1',
          ev: evBays.has(i + 1),
        })),
      };
    });
  }

  // A bay counts as freed only on an occupied -> free transition of a bay we
  // already saw. Comparing against "free" alone would fire every frame.
  function diffFreed(prevSpots, nextSpots) {
    const before = new Map((Array.isArray(prevSpots) ? prevSpots : [])
      .map((s) => [String(s && s.id), Boolean(s && s.occupied)]));
    return (Array.isArray(nextSpots) ? nextSpots : [])
      .filter((s) => s && before.get(String(s.id)) === true && !s.occupied);
  }

  function lotModel() {
    if (root.ParkWizAtidimLot) return root.ParkWizAtidimLot;
    if (typeof require === 'function') {
      try { return require('./atidim-lot'); } catch (err) { /* browser: loaded by <script> */ }
    }
    return null;
  }

  // Occupancy comes from the lot model; this adds only the EV columns, which
  // the lot model has no opinion about.
  function summarize(spots, lot) {
    const model = lot || lotModel();
    if (!model) throw new Error('ParkWizPilotFlow requires src/lib/atidim-lot.js (the occupancy engine)');
    const list = Array.isArray(spots) ? spots : [];
    const occ = model.calculateOccupancy(list, model.ATIDIM_LOT.totalCapacity);
    const evSpots = list.filter((s) => s && s.ev);
    return Object.assign({}, occ, {
      evTotal: evSpots.length,
      evFree: evSpots.filter((s) => !s.occupied).length,
    });
  }

  function navUrl(settings) {
    const s = normalizeSettings(settings);
    return 'https://waze.com/ul?ll=' + s.lat + ',' + s.lon + '&navigate=yes';
  }

  // The copy keeps the register of src/lib/margin.js: a hold is a short
  // courtesy window the operator grants, never a promise of a spot.
  function buildAlert(spot, frame, settings, nowMs) {
    const s = normalizeSettings(settings);
    const at = finiteOr(nowMs, Date.now());
    const kindHe = spot.ev ? 'עמדת טעינה' : 'תא חניה';
    return {
      spotId: spot.id,
      ev: Boolean(spot.ev),
      sourceId: (frame && frame.sourceId) || s.sourceId,
      freedAtMs: at,
      holdSeconds: s.holdSeconds,
      holdUntilMs: at + s.holdSeconds * 1000,
      navUrl: navUrl(s),
      headlineHe: 'התפנה ' + kindHe + ' ' + spot.id,
      bodyHe: 'מוחזק עבורך ' + Math.round(s.holdSeconds / 60) + ' דק׳ מרגע הזיהוי — חיזוי, לא הבטחה.',
    };
  }

  function holdState(alert, nowMs) {
    if (!alert) return { live: false, remaining: 0, labelHe: 'אין התראה פעילה' };
    const now = finiteOr(nowMs, Date.now());
    const remaining = Math.max(0, Math.ceil((alert.holdUntilMs - now) / 1000));
    if (remaining <= 0) {
      return { live: false, remaining: 0, labelHe: 'ההחזקה פגה — התא שוחרר לנהג הבא' };
    }
    return { live: true, remaining, labelHe: 'מוחזק עבורך עוד ' + mmss(remaining) };
  }

  // The entrance sign is read from a moving car: one number, one word.
  function signPanel(summary) {
    if (!summary) return { number: '—', wordHe: 'ממתין לנתוני מצלמה', tone: 'idle' };
    const free = Math.max(0, Math.round(Number(summary.available) || 0));
    if (free === 0) return { number: 'מלא', wordHe: 'אין מקומות פנויים', tone: 'full' };
    return {
      number: String(free),
      wordHe: free === 1 ? 'מקום פנוי' : 'מקומות פנויים',
      tone: summary.status === 'busy' || summary.status === 'full' ? 'busy' : 'free',
    };
  }

  // The flow itself: frames in, events out. Every source — browser camera,
  // Frigate bridge, sample clip, or a manual click on the operator's frame —
  // reaches the driver through this one ingest().
  function createFlow(options) {
    const opts = options || {};
    const bus = opts.bus || createBus();
    const lot = opts.lot || lotModel();
    let settings = normalizeSettings(opts.settings);
    let prevSpots = null;
    let alert = null;
    let last = null;

    function ingest(frame, nowMs) {
      const f = (frame && Array.isArray(frame.spots)) ? frame : { spots: [] };
      const summary = summarize(f.spots, lot);
      bus.emit(EVENTS.FRAME, f);
      bus.emit(EVENTS.OCCUPANCY, { summary, frame: f });
      // A cold start has nothing to diff against; without this guard the first
      // frame would alert on every bay that merely happens to be free.
      const freed = prevSpots ? diffFreed(prevSpots, f.spots) : [];
      const eligible = settings.evOnly ? freed.filter((s) => s.ev) : freed;
      eligible.forEach((spot) => bus.emit(EVENTS.SPOT_FREED, {
        spotId: spot.id,
        ev: Boolean(spot.ev),
        sourceId: f.sourceId || settings.sourceId,
        atSec: f.atSec,
      }));
      if (eligible.length > 0) {
        alert = buildAlert(eligible[0], f, settings, nowMs);
        bus.emit(EVENTS.ALERT, alert);
      }
      prevSpots = f.spots.map((s) => ({ id: s.id, occupied: Boolean(s.occupied), ev: Boolean(s.ev) }));
      last = { frame: f, summary, freed: eligible, alert };
      return last;
    }

    return {
      bus,
      ingest,
      getSettings() { return Object.assign({}, settings); },
      setSettings(next) { settings = normalizeSettings(next); return Object.assign({}, settings); },
      getAlert() { return alert; },
      getLast() { return last; },
      releaseHold() { alert = null; },
      // A new source starts a new cold start: diffing a Frigate frame against
      // the last sample-clip frame would invent departures that never happened.
      reset() { prevSpots = null; alert = null; last = null; },
    };
  }

  return {
    SOURCES,
    SURFACES,
    EVENTS,
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
    MIN_HOLD_SECONDS,
    MAX_HOLD_SECONDS,
    source,
    surfaceFromHash,
    createBus,
    normalizeSettings,
    loadSettings,
    saveSettings,
    expandClip,
    diffFreed,
    summarize,
    navUrl,
    buildAlert,
    holdState,
    signPanel,
    createFlow,
    mmss,
  };
});
