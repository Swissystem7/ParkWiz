// ParkWiz — time-decayed availability score from community reports.
//
// A report's weight halves every 15 minutes; reports older than 2 hours are
// dropped entirely rather than decayed to a negligible value, so a stale burst
// of reports can never accumulate into a signal.
//
// `reports` is an array of { ts: epochMs, delta: number }. Positive delta means
// "a spot opened up", negative means "a spot was taken".
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HALF_LIFE_MS = 15 * 60 * 1000;
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function assertValidReports(reports, nowMs) {
    if (!Array.isArray(reports)) {
      throw new TypeError('reports must be an array');
    }
    if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
      throw new TypeError('nowMs must be a finite number');
    }
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      if (!report || typeof report !== 'object') {
        throw new TypeError('report at index ' + i + ' must be an object');
      }
      if (typeof report.ts !== 'number' || !Number.isFinite(report.ts)) {
        throw new TypeError('report.ts at index ' + i + ' must be a finite number');
      }
      if (typeof report.delta !== 'number' || !Number.isFinite(report.delta)) {
        throw new TypeError('report.delta at index ' + i + ' must be a finite number');
      }
      if (report.ts > nowMs) {
        throw new RangeError('Report timestamp cannot be in the future');
      }
    }
  }

  function weightedAvailability(reports, nowMs, validate = false) {
    if (validate) assertValidReports(reports, nowMs);
    const cutoff = nowMs - MAX_AGE_MS;
    return reports.reduce(
      (sum, r) => (r.ts >= cutoff ? sum + r.delta * Math.pow(0.5, (nowMs - r.ts) / HALF_LIFE_MS) : sum),
      0
    );
  }

  return { weightedAvailability, assertValidReports, HALF_LIFE_MS, MAX_AGE_MS };
});
