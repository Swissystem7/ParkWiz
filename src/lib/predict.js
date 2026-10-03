// ParkWiz — deterministic availability prediction (PW-005).
//
// Same street + same hour always yields the same chance. There is no
// Math.random here, and there must never be: the Sentinel workflow fails the
// build if it reappears in this file.
//
// The formula is intentionally transparent:
//   base  — current availability, 0..1
//   rush  — fixed penalty for known rush hours
//   var   — a stable per-street/per-hour wobble in ~±0.075, derived from a
//           hash-like sine so it looks organic while staying reproducible
//
// The weights are demo constants. In a real deployment `base` would come from
// historical report data rather than from the seeded availability of the demo.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RUSH_WEIGHT = Object.freeze({ 8: -0.25, 18: -0.25, 20: -0.25, 12: -0.12, 14: -0.12 });
  const HOURLY_SLOTS = Object.freeze([8, 10, 12, 14, 16, 18, 20]);
  const MIN_CHANCE = 0.05;

  function stableVar(streetIdx, hour) {
    const x = Math.sin((streetIdx + 1) * 12.9898 + hour * 78.233) * 43758.5453;
    return ((x - Math.floor(x)) - 0.5) * 0.15;
  }

  function genHourlyPattern(avail, streetIdx) {
    const base = avail / 100;
    return HOURLY_SLOTS.map((h) => {
      const rush = RUSH_WEIGHT[h] || 0;
      return +Math.max(MIN_CHANCE, Math.min(1, base + rush + stableVar(streetIdx, h))).toFixed(3);
    });
  }

  // chanceRange - the spread of one street's day, so a municipality is shown a
  // window instead of a single number it will quote back as a promise.
  //
  // It READS genHourlyPattern and changes nothing about it: same slots, same
  // rush weights, same wobble, same three-decimal rounding. min and max are
  // always two of the seven values genHourlyPattern returned, never a
  // recomputation of them, so the range can never disagree with the curve
  // drawn next to it.
  //
  // Whatever genHourlyPattern does with a non-numeric avail, chanceRange does
  // too. That is deliberate: the input contract belongs to genHourlyPattern
  // and is being discussed on its own (draft PR #50), not quietly forked here.
  function chanceRange(avail, streetIdx) {
    const pattern = genHourlyPattern(avail, streetIdx);
    return { min: Math.min.apply(null, pattern), max: Math.max.apply(null, pattern) };
  }

  return { RUSH_WEIGHT, HOURLY_SLOTS, MIN_CHANCE, stableVar, genHourlyPattern, chanceRange };
});
