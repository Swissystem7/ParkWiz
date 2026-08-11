'use strict';

// weightedAvailability: sum of delta * 0.5^((now-ts)/15min),
// ignoring reports older than 2 hours (now-ts > 7200000 ms).
function weightedAvailability(reports, nowMs) {
  if (!Array.isArray(reports)) return 0;
  let sum = 0;
  for (const r of reports) {
    if (!r) continue;
    const age = nowMs - r.ts;
    if (age > 7200000) continue; // older than 2h: ignore
    sum += r.delta * Math.pow(0.5, age / 900000);
  }
  return sum;
}

module.exports = { weightedAvailability };
