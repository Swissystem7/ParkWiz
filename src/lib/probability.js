// ParkWiz — displayed availability from a model score + decayed community reports.
//
// communityWeight is the output of weightedAvailability (spot-units, not percent).
// Each remaining unit lifts the displayed chance by perUnit percentage points.
//
// modelScore must be a finite number (a numeric string is tolerated). A missing
// score — null, undefined, an empty string, a boolean — yields null, never a
// percentage: Number(null) is 0, so without this guard a street with no model
// output would be displayed as a confident 0% chance instead of unknown.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_PCT_PER_UNIT = 8;

  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function finiteScore(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function displayedAvailabilityPct(modelScore, communityWeight, perUnit) {
    const base = finiteScore(modelScore);
    if (base === null) return null;
    const weight = Number(communityWeight);
    const unit = Number(perUnit);
    const lift = (Number.isFinite(weight) ? weight : 0) * (Number.isFinite(unit) ? unit : DEFAULT_PCT_PER_UNIT);
    return clampPct(base + lift);
  }

  return { displayedAvailabilityPct, clampPct, DEFAULT_PCT_PER_UNIT };
});
