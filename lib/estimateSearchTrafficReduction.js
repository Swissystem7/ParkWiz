'use strict';

// estimateSearchTrafficReduction (B2G-PAR-2): heuristic PREDICTION for the
// municipal value prop — cruising-for-parking is ~1/3 of urban traffic, so
// steering drivers to open spots cuts search-traffic. Lower average occupancy
// vs a congested baseline => more headroom => larger estimated reduction.
// This is a heuristic, NOT a measurement. Label output PREDICTION when shown.
//   reductionPercent = (1 - avgOccupancy / baseline) * 100, clamped [0, 100].
//   confidence = min(1, validSamples / 30).
function estimateSearchTrafficReduction(occupancyData, baselineOccupancy) {
  if (!Array.isArray(occupancyData) || occupancyData.length === 0) return null;
  const baseline = (typeof baselineOccupancy === 'number' && baselineOccupancy > 0)
    ? baselineOccupancy
    : 0.85;

  let sum = 0;
  let n = 0;
  for (const row of occupancyData) {
    if (!row || !row.totalSpaces) continue; // skip missing / zero totalSpaces
    const rate = row.occupiedSpaces / row.totalSpaces;
    if (!isFinite(rate)) continue;
    sum += rate;
    n += 1;
  }
  if (n === 0) return null;

  const avgOccupancy = sum / n;
  let reduction = (1 - avgOccupancy / baseline) * 100;
  if (reduction < 0) reduction = 0;
  if (reduction > 100) reduction = 100;

  return {
    estimatedReductionPercent: Math.round(reduction * 10) / 10,
    confidence: Math.round(Math.min(1, n / 30) * 100) / 100,
  };
}

module.exports = { estimateSearchTrafficReduction };
