'use strict';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

function assertIntegerInRange(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${name} must be an integer from ${min} to ${max}`);
  }
}

function areaSeed(area) {
  if (typeof area !== 'string' || !area.trim()) {
    throw new TypeError('area is required');
  }
  let seed = 0;
  for (const character of area.trim().toLowerCase()) {
    seed = (seed * 31 + character.codePointAt(0)) >>> 0;
  }
  return seed;
}

function estimateScore(area, hour, weekday) {
  const seed = areaSeed(area);
  const busyHourPenalty = hour >= 7 && hour <= 9
    ? 18
    : hour >= 16 && hour <= 19
      ? 22
      : 0;
  const weekendAdjustment = weekday === 5 || weekday === 6 ? 8 : 0;
  return Math.max(
    5,
    Math.min(95, 38 + (seed % 43) - busyHourPenalty + weekendAdjustment)
  );
}

function scoreAvailability({
  area,
  hour,
  weekday,
  reports = [],
  nowMs = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  assertIntegerInRange(hour, 0, 23, 'hour');
  assertIntegerInRange(weekday, 0, 6, 'weekday');
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be finite');
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new TypeError('ttlMs must be positive');
  }

  areaSeed(area);
  const normalizedArea = area.trim().toLowerCase();
  const estimate = estimateScore(normalizedArea, hour, weekday);
  const activeReports = Array.isArray(reports)
    ? reports.filter((report) => (
      report
      && report.source === 'user'
      && typeof report.area === 'string'
      && report.area.trim().toLowerCase() === normalizedArea
      && typeof report.available === 'boolean'
      && Number.isFinite(report.reportedAt)
      && report.reportedAt <= nowMs
      && nowMs - report.reportedAt < ttlMs
    ))
    : [];

  if (activeReports.length === 0) {
    return Object.freeze({
      area: normalizedArea,
      hour,
      weekday,
      score: estimate,
      kind: 'demo-estimate',
      label: 'Demo estimate — not live availability',
    });
  }

  const availableCount = activeReports.filter((report) => report.available).length;
  const reportScore = Math.round((availableCount / activeReports.length) * 100);
  const newestReportedAt = Math.max(...activeReports.map((report) => report.reportedAt));
  const expiresAt = newestReportedAt + ttlMs;

  return Object.freeze({
    area: normalizedArea,
    hour,
    weekday,
    score: Math.round((estimate + reportScore * activeReports.length) / (activeReports.length + 1)),
    kind: 'user-report',
    label: 'Based on recent user reports',
    confidence: Math.min(95, 40 + activeReports.length * 15),
    expiresAt,
    ttlRemainingMs: expiresAt - nowMs,
    reportCount: activeReports.length,
  });
}

const api = { DEFAULT_TTL_MS, estimateScore, scoreAvailability };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ParkWizAvailability = api;
