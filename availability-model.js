(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAvailability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODEL_VERSION = 'pw-availability-1';
  const MIN_TTL_MS = 3 * 60 * 1000;
  const MAX_TTL_MS = 7 * 60 * 1000;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function timeAdjustment(date) {
    const day = date.getDay();
    const hour = date.getHours();
    if (hour >= 23 || hour < 6) return { value: 12, label: 'שעות לילה: ‎+12' };
    if (day >= 1 && day <= 5 && (hour === 7 || hour === 8)) return { value: -12, label: 'בוקר יום חול: ‎-12' };
    if (day >= 1 && day <= 5 && hour >= 17 && hour <= 20) return { value: -20, label: 'ערב יום חול: ‎-20' };
    if (day === 5 && hour >= 8 && hour <= 12) return { value: -8, label: 'שישי בבוקר: ‎-8' };
    return { value: 0, label: 'ללא התאמת שעה' };
  }

  function validReports(reports, streetIdx, nowMs) {
    return (reports || []).filter((report) =>
      report.source === 'user' &&
      report.streetIdx === streetIdx &&
      Number.isFinite(report.createdAt) &&
      Number.isFinite(report.expiresAt) &&
      report.expiresAt > nowMs &&
      report.expiresAt - report.createdAt >= MIN_TTL_MS &&
      report.expiresAt - report.createdAt <= MAX_TTL_MS &&
      report.count >= 1 && report.count <= 3
    );
  }

  function calculate({ baseline, streetIdx, reports = [], now = new Date() }) {
    const nowMs = now instanceof Date ? now.getTime() : Number(now);
    const date = now instanceof Date ? now : new Date(nowMs);
    const time = timeAdjustment(date);
    const activeReports = validReports(reports, streetIdx, nowMs);
    const reportBoost = Math.min(18, activeReports.reduce((sum, report) => sum + report.count * 6, 0));
    const score = Math.round(clamp(Number(baseline) + time.value + reportBoost, 0, 100));
    const confidence = Number(clamp(0.35 + activeReports.length * 0.1, 0.35, 0.65).toFixed(2));

    return {
      score,
      confidence,
      validReportCount: activeReports.length,
      modelVersion: MODEL_VERSION,
      factors: [
        `קו בסיס לדוגמה: ${Number(baseline)}`,
        time.label,
        activeReports.length ? `דיווחי משתמש תקפים: +${reportBoost}` : 'אין דיווח משתמש תקף',
      ],
    };
  }

  return { MODEL_VERSION, MIN_TTL_MS, MAX_TTL_MS, calculate, timeAdjustment, validReports };
});
