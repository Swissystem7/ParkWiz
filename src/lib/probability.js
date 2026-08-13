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

  function displayedAvailabilityPct(modelScore, communityWeight, perUnit) {
    const base = Number(modelScore);
    if (!Number.isFinite(base)) return null;
    const weight = Number(communityWeight);
    const unit = Number(perUnit);
    const lift = (Number.isFinite(weight) ? weight : 0) * (Number.isFinite(unit) ? unit : DEFAULT_PCT_PER_UNIT);
    return clampPct(base + lift);
  }

  return { displayedAvailabilityPct, clampPct, DEFAULT_PCT_PER_UNIT };
});
