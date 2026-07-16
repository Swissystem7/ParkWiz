// ParkWiz — time-decayed availability score. Integrated from FACT-PW-2 (draft rewritten: had 10min cutoff instead of 2h + spurious delta filter).
function weightedAvailability(reports, nowMs) {
  const cutoff = nowMs - 2 * 60 * 60 * 1000; // 2 hours
  return reports.reduce(
    (sum, r) => (r.ts >= cutoff ? sum + r.delta * Math.pow(0.5, (nowMs - r.ts) / 900000) : sum),
    0
  );
}
module.exports = { weightedAvailability };
