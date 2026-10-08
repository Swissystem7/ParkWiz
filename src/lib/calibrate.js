// ParkWiz — 3-minute calibration pack for a city worker.
//
// A pack is spots + per-spot empty/night-empty luma stats. It is not a
// trained model. The wizard walks four steps; the clock is a target, not a SLA.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizCalibrate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TARGET_SEC = 180;
  const STEPS = Object.freeze([
    { id: 'image', label: 'תמונת snapshot', seconds: 40 },
    { id: 'spots', label: 'סימון מלבנים', seconds: 70 },
    { id: 'empty', label: 'פריים ייחוס ריק', seconds: 40 },
    { id: 'check', label: 'בדיקה ושמירה', seconds: 30 },
  ]);

  // Number(null), Number('') and Number(false) are all 0, and JSON.stringify
  // writes a NaN stat as null, so a missing value in an imported pack would
  // pass as a real zero. Only numbers and non-blank numeric strings count.
  function num(v) {
    let n = NaN;
    if (typeof v === 'number') n = v;
    else if (typeof v === 'string' && v.trim() !== '') n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSpot(s, i) {
    if (!s || typeof s !== 'object') return null;
    const x = num(s.x);
    const y = num(s.y);
    const w = num(s.w);
    const h = num(s.h);
    if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) return null;
    // Reference stats come from an imported JSON pack, so every field is
    // untrusted. A missing or non-finite spread stat is zero (no contrast),
    // never negative, and a median of 0 is a real value, not a missing one:
    // `Number(r.median) || mean` used to replace a black reference frame's
    // median with its mean. Percentiles are only meaningful as a pair, so a
    // half-missing pair collapses to the median (zero range) instead of
    // inflating the range by the one value that happened to be present.
    const ref = (r) => {
      const mean = r ? num(r.mean) : null;
      if (mean == null) return null;
      const median = num(r.median) != null ? num(r.median) : mean;
      const spread = (v) => {
        const n = num(v);
        return n != null && n > 0 ? n : 0;
      };
      const p10 = num(r.p10);
      const p90 = num(r.p90);
      const hasPercentiles = p10 != null && p90 != null;
      return {
        mean,
        variance: spread(r.variance),
        n: Math.floor(spread(r.n)),
        median,
        mad: spread(r.mad),
        p10: hasPercentiles ? Math.min(p10, p90) : median,
        p90: hasPercentiles ? Math.max(p10, p90) : median,
        lighting: r.lighting != null ? String(r.lighting) : '',
      };
    };
    return {
      id: s.id != null ? String(s.id) : ('s' + (i + 1)),
      x, y, w, h,
      emptyRef: ref(s.emptyRef),
      nightRef: ref(s.nightRef),
    };
  }

  function emptyPack(street) {
    return {
      version: 2,
      kind: 'parkwiz-calibration',
      street: street || '—',
      savedAt: '',
      heuristic: 'heuristic-occupancy',
      note: 'כיול מקומי. כל הערכה שמפיקים ממנו מסומנת heuristic. לא מודל מאומן.',
      hasEmpty: false,
      hasNightEmpty: false,
      lighting: '',
      spots: [],
    };
  }

  function normalizePack(input) {
    if (!input || typeof input !== 'object') return null;
    const spotsSrc = Array.isArray(input.spots) ? input.spots : [];
    const spots = spotsSrc.map(normalizeSpot).filter(Boolean);
    return {
      version: 2,
      kind: 'parkwiz-calibration',
      street: input.street != null ? String(input.street) : '—',
      savedAt: input.savedAt != null ? String(input.savedAt) : '',
      heuristic: 'heuristic-occupancy',
      note: input.note != null ? String(input.note) : emptyPack().note,
      hasEmpty: !!input.hasEmpty,
      hasNightEmpty: !!input.hasNightEmpty,
      lighting: input.lighting != null ? String(input.lighting) : '',
      spots,
    };
  }

  function buildPack(input) {
    const base = normalizePack(Object.assign(emptyPack(input && input.street), input || {}));
    if (!base) return null;
    base.savedAt = (input && input.savedAt != null && input.savedAt !== '')
      ? String(input.savedAt)
      : new Date().toISOString();
    base.hasEmpty = base.spots.some((s) => s.emptyRef);
    base.hasNightEmpty = base.spots.some((s) => s.nightRef);
    return base;
  }

  function remainingSteps(pack) {
    const p = pack || emptyPack();
    const out = [];
    if (!p.spots.length) out.push('spots');
    if (!p.hasEmpty) out.push('empty');
    return out;
  }

  function isReady(pack) {
    return remainingSteps(pack).length === 0;
  }

  function formatClock(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return null;
    const t = Math.max(0, Math.round(n) / 1000);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Mirrors formatClock: an elapsed time that cannot be formatted (null,
  // undefined, '') is not under target either. Number(null) is 0, so the old
  // check reported a missing clock as a 00:00 success.
  function underTarget(elapsedMs) {
    const n = Number(elapsedMs);
    if (elapsedMs == null || elapsedMs === '' || !Number.isFinite(n)) return false;
    return n <= TARGET_SEC * 1000;
  }

  return {
    TARGET_SEC,
    STEPS,
    emptyPack,
    normalizePack,
    normalizeSpot,
    buildPack,
    remainingSteps,
    isReady,
    formatClock,
    underTarget,
  };
});
