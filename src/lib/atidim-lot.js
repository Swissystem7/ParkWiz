// ParkWiz — Park Atidim (CityZone) parking-lot occupancy model.
// Pure functions, zero dependencies, UMD pattern.
//
// Two views of the same lot live here, and they are deliberately separate:
//   * The operator model (ATIDIM_LOT, getHourlyCurve, camera-spot helpers) —
//     the real 220-space lot with its three camera feeds, used for occupancy
//     stats and the camera-stream overlay.
//   * The demo model (DEFAULT, snapshotAt, bayLayout, …) — an 18-bay synthetic
//     lot with no camera feed, used by demo/atidim.html so the operator page
//     renders reproducibly on a laptop with no hardware attached.
// Keep both: the demo page must stay runnable offline, and the operator model
// must stay the single source of truth for the real lot's numbers.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAtidimLot = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ATIDIM_LOT = Object.freeze({
    id: 'atidim',
    name: 'חניון פארק עתידים — תל אביב',
    operator: 'Park Atidim / CityZone',
    totalCapacity: 220,
    zones: [
      { id: 'A', name: 'אזור A (קרקע)', capacity: 80 },
      { id: 'B', name: 'אזור B (מפלס -1)', capacity: 90 },
      { id: 'C', name: 'אזור C (מתחם 7)', capacity: 50 },
    ],
    cameras: [
      { id: 'cam-01', name: 'מצלמה 01 · כניסה מזרחית', spotsMonitored: 24, streamType: 'RTSP/ONVIF' },
      { id: 'cam-02', name: 'מצלמה 02 · מפלס תחתון -1', spotsMonitored: 30, streamType: 'RTSP/ONVIF' },
      { id: 'cam-03', name: 'מצלמה 03 · מתחם עתידים 7', spotsMonitored: 26, streamType: 'RTSP/ONVIF' },
    ],
  });

  // Typical hourly occupancy curve at Park Atidim (commercial / hi-tech park)
  // Rates between 0.0 and 1.0 (clamped).
  const HOURLY_RATES = Object.freeze([
    0.08, 0.06, 0.05, 0.05, 0.06, 0.09, // 00:00 - 05:00
    0.18, 0.42, 0.76, 0.89, 0.92, 0.91, // 06:00 - 11:00
    0.90, 0.88, 0.86, 0.82, 0.70, 0.52, // 12:00 - 17:00
    0.34, 0.22, 0.16, 0.14, 0.11, 0.09, // 18:00 - 23:00
  ]);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function getHourlyCurve(capacity = ATIDIM_LOT.totalCapacity) {
    const cap = Math.max(1, Math.round(Number(capacity) || ATIDIM_LOT.totalCapacity));
    return HOURLY_RATES.map((rate, hour) => {
      const occupied = Math.round(rate * cap);
      return {
        hour,
        label: (hour < 10 ? '0' : '') + hour + ':00',
        rate,
        percentage: Math.round(rate * 100),
        occupied,
        available: Math.max(0, cap - occupied),
        isPeak: rate >= 0.85,
      };
    });
  }

  // Initial camera view spots (normalized coordinates 0..1 for responsive canvas overlay)
  function createDefaultCameraSpots() {
    const spots = [];
    const rows = 2;
    const cols = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = 'A-' + (r * cols + c + 1).toString().padStart(2, '0');
        // Perspective layout coordinates
        const x = 0.06 + c * 0.075;
        const y = r === 0 ? 0.38 : 0.62;
        const w = 0.065;
        const h = r === 0 ? 0.18 : 0.26;
        // Seed initial occupancy: ~65% occupied
        const isOccupied = ((c * 3 + r * 5 + 2) % 7) > 2;
        spots.push({
          id,
          x,
          y,
          w,
          h,
          occupied: isOccupied,
          confidence: 0.91 + ((c + r) % 8) * 0.01,
        });
      }
    }
    return spots;
  }

  function calculateOccupancy(spots, lotCapacity = ATIDIM_LOT.totalCapacity) {
    const list = Array.isArray(spots) ? spots : [];
    const capacity = Math.max(1, Math.round(Number(lotCapacity) || ATIDIM_LOT.totalCapacity));
    const occupiedInView = list.filter((s) => Boolean(s && s.occupied)).length;
    const totalInView = list.length;
    const viewRate = totalInView > 0 ? occupiedInView / totalInView : 0;

    // Extrapolate to whole lot if spots represent a sample zone, or use direct if capacity matches
    const estimatedLotOccupied = totalInView === capacity
      ? occupiedInView
      : Math.round(viewRate * capacity);
    const clampedOccupied = clamp(estimatedLotOccupied, 0, capacity);
    const available = capacity - clampedOccupied;

    return {
      capacity,
      totalInView,
      occupiedInView,
      availableInView: Math.max(0, totalInView - occupiedInView),
      estimatedLotOccupied: clampedOccupied,
      available,
      rate: Number((clampedOccupied / capacity).toFixed(3)),
      percentage: Math.round((clampedOccupied / capacity) * 100),
      status: clampedOccupied / capacity > 0.9 ? 'full' : (clampedOccupied / capacity > 0.75 ? 'busy' : 'available'),
      statusHe: clampedOccupied / capacity > 0.9 ? 'עמוס מאוד' : (clampedOccupied / capacity > 0.75 ? 'תפוסה בינונית' : 'זמינות גבוהה'),
    };
  }

  // Simulate a single arrival or departure event
  function transitionSpot(spots, action = 'toggle') {
    if (!Array.isArray(spots) || spots.length === 0) return [];
    const next = spots.map((s) => Object.assign({}, s));
    if (action === 'arrive') {
      const free = next.filter((s) => !s.occupied);
      if (free.length > 0) {
        const target = free[Math.floor(Math.random() * free.length)];
        target.occupied = true;
        target.confidence = 0.95;
      }
    } else if (action === 'leave') {
      const taken = next.filter((s) => s.occupied);
      if (taken.length > 0) {
        const target = taken[Math.floor(Math.random() * taken.length)];
        target.occupied = false;
        target.confidence = 0.94;
      }
    } else {
      // Toggle a random spot
      const idx = Math.floor(Math.random() * next.length);
      next[idx].occupied = !next[idx].occupied;
    }
    return next;
  }

  // Strict Privacy Checker: Ensures payload complies with zero-PII / zero-LPR mandate
  const FORBIDDEN_PII = ['plate', 'licensePlate', 'lpr', 'alpr', 'face', 'identity', 'imageBlob', 'videoChunk', 'macAddress'];

  function validatePrivacyCompliance(record) {
    if (!record || typeof record !== 'object') return { valid: true, violations: [] };
    const violations = [];
    for (const key of Object.keys(record)) {
      const lower = key.toLowerCase();
      for (const forbidden of FORBIDDEN_PII) {
        if (lower.includes(forbidden.toLowerCase())) {
          violations.push(key);
        }
      }
    }
    return {
      valid: violations.length === 0,
      violations,
    };
  }

  // ---------------------------------------------------------------------------
  // Operator demo lot (demo/atidim.html): no camera feed, hour-of-day curve plus
  // a deterministic bay fill for the canvas and the stat tiles.
  // ---------------------------------------------------------------------------

  const DEFAULT = Object.freeze({
    site: 'פארק עתידים — חניון מגדלי A',
    cols: 6,
    rows: 3,
    timezone: 'Asia/Jerusalem',
  });

  function totalBays(lot) {
    const l = lot || DEFAULT;
    const c = Number(l.cols);
    const r = Number(l.rows);
    if (!Number.isFinite(c) || !Number.isFinite(r) || c <= 0 || r <= 0) return 0;
    return c * r;
  }

  // Weekday office-park curve (0–1). Peaks mid-morning and late afternoon.
  function baselineRateForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h) || h < 0 || h > 23) return 0;
    if (h < 6 || h >= 22) return 0.12;
    if (h >= 7 && h < 9) return 0.35 + (h - 7) * 0.12;
    if (h >= 9 && h < 12) return 0.68 + (h === 10 ? 0.06 : 0);
    if (h === 12) return 0.55;
    if (h >= 13 && h < 17) return 0.62 + (h === 15 ? 0.08 : 0);
    if (h >= 17 && h < 20) return 0.48 - (h - 17) * 0.08;
    return 0.22;
  }

  function clampInt(n, min, max) {
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function occupiedAtRate(total, rate) {
    const t = Number(total);
    const r = Math.max(0, Math.min(1, Number(rate)));
    if (!Number.isFinite(t) || t <= 0) return 0;
    return clampInt(r * t, 0, t);
  }

  function stateAt(hour, lot) {
    const l = lot || DEFAULT;
    const total = totalBays(l);
    const rate = baselineRateForHour(hour);
    const occupied = occupiedAtRate(total, rate);
    const free = total - occupied;
    return {
      hour: Number(hour),
      total,
      occupied,
      free,
      rate,
      pct: total ? occupied / total : 0,
    };
  }

  // Deterministic fill: lowest indices occupied first (stable for demo screenshots).
  function bayStates(occupied, total) {
    const t = Number(total);
    const occ = clampInt(occupied, 0, t);
    const out = [];
    for (let i = 0; i < t; i++) out.push(i < occ);
    return out;
  }

  // The order bays get taken in. A hash scatter rather than left-to-right, so
  // the lot does not read as an obviously fake solid block on screen. Fixed
  // order, so it is also monotone: a bay taken at 09:00 is still taken at
  // 10:00, and dragging the demo hour makes cars arrive and leave instead of
  // teleporting across the lot.
  function arrivalOrder(total) {
    const t = Math.max(0, Math.trunc(Number(total)) || 0);
    const idx = [];
    for (let i = 0; i < t; i++) idx.push(i);
    return idx.sort((a, b) => ((a * 2654435761) % 1000003) - ((b * 2654435761) % 1000003));
  }

  function bayLayout(occupied, total) {
    const t = Math.max(0, Math.trunc(Number(total)) || 0);
    const occ = clampInt(occupied, 0, t);
    const out = new Array(t).fill(false);
    const order = arrivalOrder(t);
    for (let i = 0; i < occ; i++) out[order[i]] = true;
    return out;
  }

  function hourlySeries(lot) {
    const l = lot || DEFAULT;
    const total = totalBays(l);
    const series = [];
    for (let h = 0; h < 24; h++) {
      const st = stateAt(h, l);
      series.push({
        hour: h,
        ts: `2026-10-18T${String(h).padStart(2, '0')}:00:00`,
        street: l.site || DEFAULT.site,
        total,
        occupied: st.occupied,
        source: 'atidim-demo',
      });
    }
    return series;
  }

  function localHour(now, timeZone) {
    const d = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(d.getTime())) return 0;
    const tz = timeZone || DEFAULT.timezone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hourPart = parts.find((p) => p.type === 'hour');
    const h = Number(hourPart && hourPart.value);
    return Number.isFinite(h) ? h : 0;
  }

  // Any hour, so the operator page can scrub the day without faking a Date.
  function snapshotAt(hour, lot) {
    const l = lot || DEFAULT;
    const st = stateAt(hour, l);
    return {
      ...st,
      bays: bayLayout(st.occupied, st.total),
      cols: l.cols,
      rows: l.rows,
      site: l.site || DEFAULT.site,
    };
  }

  function liveSnapshot(now, lot) {
    const l = lot || DEFAULT;
    return snapshotAt(localHour(now, l.timezone), l);
  }

  return {
    // Operator model — the real 220-space lot and its camera feeds.
    ATIDIM_LOT,
    HOURLY_RATES,
    getHourlyCurve,
    createDefaultCameraSpots,
    calculateOccupancy,
    transitionSpot,
    validatePrivacyCompliance,
    // Demo model — the 18-bay synthetic lot behind demo/atidim.html.
    DEFAULT,
    totalBays,
    baselineRateForHour,
    stateAt,
    bayStates,
    arrivalOrder,
    bayLayout,
    hourlySeries,
    localHour,
    snapshotAt,
    liveSnapshot,
    occupiedAtRate,
  };
});
