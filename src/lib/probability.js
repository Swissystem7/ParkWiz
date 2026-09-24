// ParkWiz — displayed availability from a model score + decayed community reports.
//
// communityWeight is the output of weightedAvailability (spot-units, not percent).
// Each remaining unit lifts the displayed chance by perUnit percentage points.
// Optional maxPct caps the result on the same 0..100 percent scale (not a 0..1 chance).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_PCT_PER_UNIT = 8;

  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function displayedAvailabilityPct(modelScore, communityWeight, perUnit, maxPct) {
    const base = Number(modelScore);
    if (!Number.isFinite(base)) return null;
    const weight = Number(communityWeight);
    const unit = Number(perUnit);
    const lift = (Number.isFinite(weight) ? weight : 0) * (Number.isFinite(unit) ? unit : DEFAULT_PCT_PER_UNIT);
    const result = base + lift;
    // Only a number or a non-blank numeric string is a cap. Number('') / Number(false) / Number([]) are 0,
    // and a cap of 0 would show every street as 0%, so anything else is ignored like an omitted cap.
    const cap = typeof maxPct === 'number' ? maxPct
      : (typeof maxPct === 'string' && maxPct.trim() !== '' ? Number(maxPct) : NaN);
    const max = Number.isFinite(cap) ? cap : 100;
    return clampPct(Math.min(result, max));
  }

  return { displayedAvailabilityPct, clampPct, DEFAULT_PCT_PER_UNIT };
});
