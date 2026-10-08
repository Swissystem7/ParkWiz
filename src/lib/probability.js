// ParkWiz — displayed availability from a model score + decayed community reports.
//
// communityWeight is the output of weightedAvailability (spot-units, not percent).
// Each remaining unit lifts the displayed chance by perUnit percentage points.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_PCT_PER_UNIT = 8;

  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  // Number(null), Number(''), Number(false) and Number([]) are all 0, so a
  // missing value would pass as a real zero. Only numbers and numeric strings count.
  function toFinite(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
  }

  function displayedAvailabilityPct(modelScore, communityWeight, perUnit) {
    const base = toFinite(modelScore);
    if (!Number.isFinite(base)) return null;
    const weight = toFinite(communityWeight);
    const unit = toFinite(perUnit);
    const lift = (Number.isFinite(weight) ? weight : 0) * (Number.isFinite(unit) ? unit : DEFAULT_PCT_PER_UNIT);
    return clampPct(base + lift);
  }

  return { displayedAvailabilityPct, clampPct, DEFAULT_PCT_PER_UNIT };
});
