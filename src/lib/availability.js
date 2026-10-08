// ParkWiz — time-decayed availability score from community reports.
//
// A report's weight halves every 15 minutes; reports older than 2 hours are
// dropped entirely rather than decayed to a negligible value, so a stale burst
// of reports can never accumulate into a signal.
//
// `reports` is an array of { ts: epochMs, delta: number }. Positive delta means
// "a spot opened up", negative means "a spot was taken".
//
// Malformed reports (missing/non-numeric ts or delta) are ignored rather than
// poisoning the whole score with NaN — one bad entry must never blank out the
// street card. The UI's "N active reports" counter uses the same cutoff via
// countActiveReports, so the count and the weighted score can never disagree
// about which reports are still live.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HALF_LIFE_MS = 15 * 60 * 1000;
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function isWellFormed(report) {
    return !!report && Number.isFinite(report.ts) && Number.isFinite(report.delta);
  }

  // A report counts as active when it is well-formed, not from the future, and
  // no older than MAX_AGE_MS (inclusive — a report exactly at the cutoff counts).
  function isActiveReport(report, nowMs) {
    if (!isWellFormed(report)) return false;
    if (report.ts > nowMs) return false;
    return report.ts >= nowMs - MAX_AGE_MS;
  }

  function countActiveReports(reports, nowMs) {
    if (!Array.isArray(reports)) return 0;
    return reports.reduce((n, r) => (isActiveReport(r, nowMs) ? n + 1 : n), 0);
  }

  function weightedAvailability(reports, nowMs, validate = false) {
    if (!Array.isArray(reports)) return 0;
    if (validate && reports.some((report) => isWellFormed(report) && report.ts > nowMs)) {
      throw new RangeError('Report timestamp cannot be in the future');
    }
    return reports.reduce((sum, r) => {
      if (!isActiveReport(r, nowMs)) return sum;
      return sum + r.delta * Math.pow(0.5, (nowMs - r.ts) / HALF_LIFE_MS);
    }, 0);
  }

  return { weightedAvailability, countActiveReports, isActiveReport, HALF_LIFE_MS, MAX_AGE_MS };
});
