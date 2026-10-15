// ParkWiz — Park Atidim (CityZone) parking-lot occupancy model.
// Pure functions, zero dependencies, UMD pattern.
//
// Two views of the same lot live here, and they are deliberately separate:
//   * The camera model (ATIDIM_LOT, getHourlyCurve, CAMERA_VIEWS,
//     createCameraSpots) — the real 220-space lot with its three camera feeds,
//     behind demo/atidim.html: occupancy stats and the camera-stream overlay.
//   * The board model (DEFAULT, snapshotAt, bayLayout, hourlySeries) — an
//     18-bay synthetic lot with no camera feed, for the full-lot plan view and
//     the day scrubber: deterministic and monotone at every hour of the day, so
//     the page renders reproducibly on a laptop with no hardware attached.
// Keep both: the board view must stay runnable offline at any hour, and the
// camera model must stay the single source of truth for the real lot's numbers.
// Both read the wall clock through lotClockParts, so neither can report an
// hour the other disagrees with.
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

  // A bar at or above this rate is drawn as a peak hour, and the chart's
  // reference line is labelled with it. One constant so the model, the chart
  // and the pitch deck cannot drift apart.
  const PEAK_THRESHOLD = 0.85;

  // The lot is in Tel Aviv; the operator reads wall-clock Israel time, which is
  // 2-3h ahead of UTC. Deriving the HUD clock and the "current hour" marker from
  // UTC showed the wrong hour of the park's own curve during a demo.
  const LOT_TIME_ZONE = 'Asia/Jerusalem';

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // Wall-clock parts at the lot, falling back to the host's local time if the
  // runtime has no IANA time-zone data (old WebView, --without-intl build).
  // `timeZone` is overridable so a page can honour the zone that came out of
  // demo/atidim-data.json instead of hard-coding the lot's own.
  function lotClockParts(date, timeZone) {
    const when = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    try {
      const parts = {};
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: timeZone || LOT_TIME_ZONE,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      for (const part of fmt.formatToParts(when)) {
        if (part.type !== 'literal') parts[part.type] = part.value;
      }
      // hourCycle h24 reports midnight as "24" in some engines.
      if (parts.hour === '24') parts.hour = '00';
      if (parts.year && parts.hour) return parts;
    } catch (err) {
      /* fall through to host local time */
    }
    return {
      year: String(when.getFullYear()),
      month: pad2(when.getMonth() + 1),
      day: pad2(when.getDate()),
      hour: pad2(when.getHours()),
      minute: pad2(when.getMinutes()),
      second: pad2(when.getSeconds()),
    };
  }

  // 'YYYY-MM-DD HH:MM:SS' at the lot — the frame timestamp shown over the stream.
  function formatLotClock(date) {
    const p = lotClockParts(date);
    return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second;
  }

  function lotHour(date) {
    const hour = Number(lotClockParts(date).hour);
    return Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 0;
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
        isPeak: rate >= PEAK_THRESHOLD,
      };
    });
  }

  // One point of the curve. Hours wrap, so a bad clock cannot produce undefined.
  function hourlyPoint(hour, capacity = ATIDIM_LOT.totalCapacity) {
    const raw = Number(hour);
    const h = Number.isFinite(raw) ? ((Math.floor(raw) % 24) + 24) % 24 : 0;
    return getHourlyCurve(capacity)[h];
  }

  // Overlay geometry per camera. Each camera watches a different zone, so
  // switching cameras in the demo has to change the frame, the monitored stall
  // count and the HUD banner — not just the button that looks pressed.
  const CAMERA_VIEWS = Object.freeze({
    'cam-01': Object.freeze({
      zone: 'A', rows: 2, cols: 12,
      label: 'מצלמה 01 · כניסה מזרחית (שער ראשי, אזור A)',
      hud: 'CAM-01 [EAST GATE] 1080p30',
    }),
    'cam-02': Object.freeze({
      zone: 'B', rows: 3, cols: 10,
      label: 'מצלמה 02 · מפלס תחתון -1 (אזור B)',
      hud: 'CAM-02 [LEVEL -1] 1080p25',
    }),
    'cam-03': Object.freeze({
      zone: 'C', rows: 2, cols: 13,
      label: 'מצלמה 03 · מתחם עתידים 7 (אזור C)',
      hud: 'CAM-03 [ATIDIM 7] 720p30',
    }),
  });

  function cameraView(cameraId) {
    const view = CAMERA_VIEWS[String(cameraId || '').toLowerCase()];
    return view || CAMERA_VIEWS['cam-01'];
  }

  // Mark exactly round(rate * n) stalls occupied, spread across the frame.
  // Deterministic: the same hour always draws the same frame, so the demo does
  // not reshuffle under the operator mid-sentence. 97 and 101 are coprime, so
  // the ranking is a permutation of the stall indexes.
  function seedOccupancy(spots, rate) {
    const target = Math.round(clamp(rate, 0, 1) * spots.length);
    const order = spots
      .map((spot, i) => ({ i, rank: (i * 97 + 31) % 101 }))
      .sort((a, b) => a.rank - b.rank);
    order.forEach((entry, position) => {
      spots[entry.i].occupied = position < target;
    });
    return spots;
  }

  // Camera-view stalls in normalized 0..1 coordinates, so the overlay scales
  // with a responsive canvas. Occupancy is seeded from the park's own curve for
  // `hour`, which keeps the live counters and the hourly chart telling one story.
  function createCameraSpots(cameraId, hour) {
    const view = cameraView(cameraId);
    const rate = hourlyPoint(hour === undefined ? lotHour() : hour).rate;
    const colStep = 0.88 / view.cols;
    const rowBand = 0.62 / view.rows;
    const spots = [];
    for (let r = 0; r < view.rows; r++) {
      // Rows further down the frame are closer to the camera, so they are taller.
      const depth = view.rows > 1 ? r / (view.rows - 1) : 0;
      for (let c = 0; c < view.cols; c++) {
        spots.push({
          id: view.zone + '-' + pad2(r * view.cols + c + 1),
          x: Number((0.06 + c * colStep).toFixed(4)),
          y: Number((0.3 + r * rowBand).toFixed(4)),
          w: Number((colStep * 0.86).toFixed(4)),
          h: Number((rowBand * (0.62 + 0.18 * depth)).toFixed(4)),
          occupied: false,
          confidence: 0.91 + ((c + r) % 8) * 0.01,
        });
      }
    }
    return seedOccupancy(spots, rate);
  }

  // Initial camera view spots (normalized coordinates 0..1 for responsive canvas overlay)
  function createDefaultCameraSpots(hour) {
    return createCameraSpots('cam-01', hour);
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
  // Operator board lot: no camera feed, hour-of-day curve plus a deterministic
  // bay fill for the plan view and the stat tiles.
  // ---------------------------------------------------------------------------

  const DEFAULT = Object.freeze({
    site: 'פארק עתידים — חניון מגדלי A',
    cols: 6,
    rows: 3,
    timezone: LOT_TIME_ZONE,
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
  // 10:00, and dragging the board's hour makes cars arrive and leave instead
  // of teleporting across the lot.
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
        ts: `2026-10-18T${pad2(h)}:00:00`,
        street: l.site || DEFAULT.site,
        total,
        occupied: st.occupied,
        source: 'atidim-demo',
      });
    }
    return series;
  }

  // Hour-of-day in the board's own time zone. Shares lotClockParts with the
  // camera clock, which buys two things the hand-rolled Intl call did not have:
  // the no-Intl fallback, and midnight reported as 0 instead of 24 (an
  // hourCycle-h24 runtime answered "24", and baselineRateForHour(24) is 0 — the
  // board drew an empty lot between 00:00 and 01:00 instead of the night floor).
  function localHour(now, timeZone) {
    const d = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(d.getTime())) return 0;
    const h = Number(lotClockParts(d, timeZone || DEFAULT.timezone).hour);
    return Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0;
  }

  // Any hour, so the board can scrub the day without faking a Date.
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
    // Camera model — the real 220-space lot and its three camera feeds.
    ATIDIM_LOT,
    HOURLY_RATES,
    PEAK_THRESHOLD,
    LOT_TIME_ZONE,
    CAMERA_VIEWS,
    cameraView,
    formatLotClock,
    lotHour,
    getHourlyCurve,
    hourlyPoint,
    createCameraSpots,
    createDefaultCameraSpots,
    calculateOccupancy,
    transitionSpot,
    validatePrivacyCompliance,
    // Board model — the 18-bay synthetic lot and its day-long curve.
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
