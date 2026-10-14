// Park Atidim (CityZone) — synthetic lot occupancy for operator demo.
// No camera feed: hour-of-day curve + deterministic bay fill for canvas/tiles.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAtidimLot = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

  function liveSnapshot(now, lot) {
    const l = lot || DEFAULT;
    const h = localHour(now, l.timezone);
    const st = stateAt(h, l);
    return {
      ...st,
      bays: bayStates(st.occupied, st.total),
      cols: l.cols,
      rows: l.rows,
      site: l.site || DEFAULT.site,
    };
  }

  return {
    DEFAULT,
    totalBays,
    baselineRateForHour,
    stateAt,
    bayStates,
    hourlySeries,
    localHour,
    liveSnapshot,
    occupiedAtRate,
  };
});
