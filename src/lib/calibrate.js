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

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSpot(s, i) {
    if (!s || typeof s !== 'object') return null;
    const x = num(s.x);
    const y = num(s.y);
    const w = num(s.w);
    const h = num(s.h);
    if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) return null;
    const ref = (r) => {
      if (!r || !Number.isFinite(Number(r.mean))) return null;
      return {
        mean: Number(r.mean),
        variance: Number(r.variance) || 0,
        n: Number(r.n) || 0,
        median: Number(r.median) || Number(r.mean),
        mad: Number(r.mad) || 0,
        p10: Number(r.p10) || 0,
        p90: Number(r.p90) || 0,
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
    base.savedAt = (input && input.savedAt) || new Date().toISOString();
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
    const t = Math.max(0, Math.round(Number(ms) || 0) / 1000);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function underTarget(elapsedMs) {
    return Number(elapsedMs) <= TARGET_SEC * 1000;
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
