(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAvailability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODEL_VERSION = 'pw-availability-2';
  const MIN_TTL_MS = 3 * 60 * 1000;
  const MAX_TTL_MS = 7 * 60 * 1000;
  const BASE_CONFIDENCE = 0.35;
  const MAX_CONFIDENCE = 0.8;
  const WEEKDAY_TO_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function modelLocalDayHour(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    let weekday = 'Sun';
    let hour = 0;
    for (const part of parts) {
      if (part.type === 'weekday') weekday = part.value;
      if (part.type === 'hour') hour = Number(part.value);
    }
    return { day: WEEKDAY_TO_NUM[weekday] ?? 0, hour: Number.isFinite(hour) ? hour : 0 };
  }

  function timeAdjustment(date) {
    const { day, hour } = modelLocalDayHour(date);
    if (hour >= 23 || hour < 6) return { delta: 12, label: 'שעות לילה מאוחרות: +12' };
    if (day >= 1 && day <= 4 && hour >= 17 && hour <= 20) return { delta: -20, label: 'ערב אמצע שבוע: -20' };
    if (day === 5 && hour >= 8 && hour <= 12) return { delta: -8, label: 'בוקר יום שישי: -8' };
    if (day >= 0 && day <= 4 && (hour === 7 || hour === 8)) return { delta: -12, label: 'בוקר יום חול: -12' };
    return { delta: 0, label: 'ללא התאמת שעה/יום' };
  }

  function reportMatchesStreet(report, streetIdx, areaKey) {
    if (Number.isInteger(streetIdx)) return report.streetIdx === streetIdx;
    return Boolean(areaKey) && report.areaKey === areaKey;
  }

  // Product contract: only reports created with a 3–7 minute TTL are valid.
  function validReports(reports, streetIdx, areaKey, nowMs) {
    return (reports || []).filter((report) => {
      const createdAt = Number(report.createdAt);
      const expiresAt = Number(report.expiresAt);
      const ttl = expiresAt - createdAt;
      const confidence = Number(report.confidence);
      const count = Number(report.count ?? 1);

      return (
        report.source === 'user' &&
        reportMatchesStreet(report, streetIdx, areaKey) &&
        Number.isFinite(createdAt) &&
        Number.isFinite(expiresAt) &&
        Number.isFinite(confidence) &&
        Number.isFinite(count) &&
        expiresAt > nowMs &&
        ttl >= MIN_TTL_MS &&
        ttl <= MAX_TTL_MS &&
        confidence >= 0 &&
        confidence <= 1 &&
        count >= 1 &&
        count <= 3
      );
    });
  }

  function calculate({ baseline, streetIdx, areaKey = 'default-area', reports = [], now = new Date() }) {
    const nowMs = now instanceof Date ? now.getTime() : Number(now);
    const date = now instanceof Date ? now : new Date(nowMs);
    const baselineScore = Number.isFinite(Number(baseline)) ? Number(baseline) : 0;
    const time = timeAdjustment(date);
    const modelClock = modelLocalDayHour(date);
    const activeReports = validReports(reports, streetIdx, areaKey, nowMs);
    const reportBoostRaw = activeReports.reduce((sum, report) => {
      const weight = Number(report.count ?? 1) * Number(report.confidence);
      return sum + weight * 8;
    }, 0);
    const reportBoost = Math.round(clamp(reportBoostRaw, 0, 18));
    const score = Math.round(clamp(baselineScore + time.delta + reportBoost, 0, 100));

    let confidence = BASE_CONFIDENCE;
    if (activeReports.length > 0) {
      const confidenceBoost = Math.min(0.45, activeReports.reduce((sum, report) => sum + Number(report.confidence) * 0.12, 0));
      confidence = Number(clamp(BASE_CONFIDENCE + confidenceBoost, BASE_CONFIDENCE, MAX_CONFIDENCE).toFixed(2));
    }

    return {
      score,
      confidence,
      validReportCount: activeReports.length,
      modelVersion: MODEL_VERSION,
      factors: [
        { type: 'baseline', label: 'קו בסיס רחוב/אזור', delta: Math.round(baselineScore), value: Math.round(baselineScore) },
        { type: 'time', label: time.label, delta: time.delta, day: modelClock.day, hour: modelClock.hour },
        {
          type: 'user_reports',
          label: activeReports.length ? `דיווחי משתמש תקפים: +${reportBoost}` : 'אין דיווח משתמש תקף',
          delta: reportBoost,
          reportsUsed: activeReports.length,
        },
      ],
    };
  }

  return {
    MODEL_VERSION,
    MIN_TTL_MS,
    MAX_TTL_MS,
    BASE_CONFIDENCE,
    MAX_CONFIDENCE,
    calculate,
    timeAdjustment,
    modelLocalDayHour,
    validReports,
  };
});
