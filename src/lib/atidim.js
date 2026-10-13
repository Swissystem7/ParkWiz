// ParkWiz — the Park Atidim operator lot model (CityZone meeting surface).
//
// Everything here is pure and deterministic: the same minute-of-day always
// produces the same frame. That is on purpose. The operator demo renders a
// SYNTHETIC camera view, not a feed, so the numbers on screen must be
// reproducible and testable instead of random — a buyer who asks "why 7 free?"
// gets the same answer twice, and node --test can assert the counters.
//
// No plate, no identity, no vehicle track: a spot is a polygon that is either
// occupied or free. That is the whole data model, and it is the privacy claim
// the demo makes.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAtidim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LOT = Object.freeze({
    name: 'פארק עתידים — חניון עילי P2',
    street: 'פארק עתידים',
    camera: 'CAM-P2-NE',
    rows: 3,
    perRow: 10,
    // Normalised camera frame: y 0 = top of the image, 1 = bottom (nearest the
    // camera); x 0 = left edge, 1 = right edge.
    horizon: 0.30,
    nearHalfWidth: 0.47,
    farHalfWidth: 0.11,
    // Share of a row band taken by the spots themselves; the rest is the aisle.
    bandFill: 0.62,
  });

  // The day the demo series is dated when no date is given. A fixed day keeps
  // hourlyRecords() byte-identical across runs, which is what makes the chart
  // on the demo page assertable.
  const DEMO_DAY = '2026-10-13';

  // Office-park profile: empty at night, full between 10:00 and 15:00.
  // Anchors are hourly; targetRate interpolates between them per minute.
  const HOURLY_PROFILE = Object.freeze([
    0.08, 0.07, 0.06, 0.06, 0.06, 0.08, 0.14, 0.33,
    0.62, 0.84, 0.93, 0.96, 0.94, 0.91, 0.90, 0.86,
    0.74, 0.55, 0.38, 0.27, 0.20, 0.15, 0.12, 0.10,
  ]);

  const MINUTES_PER_DAY = 24 * 60;

  // FNV-1a. Not a security hash — it is here because it is short, stable
  // across engines, and gives every spot id the same score forever.
  function hash32(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function unit(str) {
    return hash32(str) / 4294967296;
  }

  function clampMinute(minute) {
    const m = Math.floor(Number(minute));
    if (!Number.isFinite(m)) return 0;
    return ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  }

  function clockLabel(minute) {
    const m = clampMinute(minute);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  // Perspective: the far row sits just under the horizon and is narrow, the
  // near row fills the bottom of the frame. One easing curve drives both so a
  // spot never crosses the row in front of it.
  function perspectiveY(t, cfg) {
    const c = cfg || LOT;
    return c.horizon + (1 - c.horizon) * Math.pow(t, 1.55);
  }

  function perspectiveHalfWidth(t, cfg) {
    const c = cfg || LOT;
    return c.farHalfWidth + (c.nearHalfWidth - c.farHalfWidth) * t;
  }

  // The four corners of one spot, clockwise from its far-left corner, in the
  // normalised frame. Row 0 is the far row, so it is both the highest and the
  // narrowest band in the image.
  function quadFor(row, col, cfg) {
    const c = cfg || LOT;
    const t0 = row / c.rows;
    const t1 = t0 + (1 / c.rows) * c.bandFill;
    const y0 = perspectiveY(t0, c);
    const y1 = perspectiveY(t1, c);
    const hw0 = perspectiveHalfWidth(t0, c);
    const hw1 = perspectiveHalfWidth(t1, c);
    const a0 = col / c.perRow;
    const a1 = (col + 1) / c.perRow;
    const xAt = (a, hw) => 0.5 + (a - 0.5) * 2 * hw;
    return [
      [xAt(a0, hw0), y0],
      [xAt(a1, hw0), y0],
      [xAt(a1, hw1), y1],
      [xAt(a0, hw1), y1],
    ];
  }

  // Rows run far-to-near and spots left-to-right inside a row, so this order
  // is also the painter's order for a canvas overlay.
  function buildSpots(cfg) {
    const c = cfg || LOT;
    const spots = [];
    for (let row = 0; row < c.rows; row++) {
      for (let col = 0; col < c.perRow; col++) {
        const id = 'P2-' + String.fromCharCode(65 + row) + String(col + 1).padStart(2, '0');
        spots.push({ id, label: id.slice(3), row, col, quad: quadFor(row, col, c) });
      }
    }
    return spots;
  }

  // Drivers take the easy spots first: the score is a stable per-spot hash, and
  // the lowest scores fill first. So a rising occupancy rate only ever ADDS
  // cars — an overlay never flickers a car out while the lot is filling.
  function spotScore(id) {
    return unit('spot:' + id);
  }

  function fillOrder(spots) {
    return (Array.isArray(spots) ? spots.slice() : []).sort((a, b) => {
      const d = spotScore(a.id) - spotScore(b.id);
      return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
    });
  }

  function targetRate(minute) {
    const m = clampMinute(minute);
    const h = Math.floor(m / 60);
    const frac = (m % 60) / 60;
    const a = HOURLY_PROFILE[h];
    const b = HOURLY_PROFILE[(h + 1) % 24];
    const base = a + (b - a) * frac;
    // Deterministic per-minute wobble, so the counter breathes like a real lot
    // instead of stepping only on the hour.
    const jitter = (unit('min:' + m) - 0.5) * 0.05;
    return Math.max(0, Math.min(1, base + jitter));
  }

  // The state of the whole lot at one minute: counters plus the set of spot ids
  // that are occupied. occupiedIds is what an overlay colours red.
  function snapshot(minute, spots) {
    const list = Array.isArray(spots) ? spots : [];
    const m = clampMinute(minute);
    const total = list.length;
    const rate = targetRate(m);
    const occupied = total ? Math.round(rate * total) : 0;
    const occupiedIds = new Set(fillOrder(list).slice(0, occupied).map((s) => s.id));
    return {
      minute: m,
      clock: clockLabel(m),
      total,
      occupied,
      free: total - occupied,
      rate: total ? occupied / total : 0,
      occupiedIds,
    };
  }

  // Occupancy records in the shared schema (src/lib/occupancy.js), so an hourly
  // chart of this lot is drawn by the same renderer the municipal dashboard and
  // the pilot report already use.
  function hourlyRecords(spots, dateIso) {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(dateIso || '')) ? String(dateIso) : DEMO_DAY;
    const out = [];
    for (let h = 0; h < 24; h++) {
      const snap = snapshot(h * 60, spots);
      out.push({
        ts: day + 'T' + String(h).padStart(2, '0') + ':00:00',
        street: LOT.street,
        total: snap.total,
        occupied: snap.occupied,
        source: 'demo',
        confidence: 0,
      });
    }
    return out;
  }

  return {
    LOT,
    DEMO_DAY,
    HOURLY_PROFILE,
    MINUTES_PER_DAY,
    hash32,
    unit,
    clampMinute,
    clockLabel,
    perspectiveY,
    perspectiveHalfWidth,
    quadFor,
    buildSpots,
    spotScore,
    fillOrder,
    targetRate,
    snapshot,
    hourlyRecords,
  };
});
