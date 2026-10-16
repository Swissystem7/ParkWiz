// ParkWiz — Waze-style arrival margins around a predicted free spot (#201).
//
// A single predicted number invites the driver to race it: "4 free at 10:00"
// reads as a promise, so a driver who arrives at 10:07 to a full lot concludes
// the app lied. A margin is the honest shape of the same prediction — a window
// of arrival times (ETA ± buffer) and the *range* of free bays across it, wide
// for two separate reasons: the curve moves inside the window (which is what
// makes arriving late expensive, or free), and a guess about 40 minutes from
// now is a weaker claim than a 2-minute one (SLACK_PER_MIN).
//
// Pure, zero-dependency, UMD like the rest of src/lib: the hourly free-bay curve
// is passed in (freeByHourFromSeries converts an hourlySeries), so this file
// knows no particular lot. No label here may promise a spot — the band is always
// a range, and the tone stays "חיזוי, לא הבטחה".
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizMargin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MINUTES_PER_DAY = 24 * 60;
  const DEFAULT_ETA_MIN = 8;
  const DEFAULT_BUFFER_MIN = 5;
  const MAX_ETA_MIN = 45;
  const MAX_BUFFER_MIN = 30;
  // One extra bay of doubt per quarter-hour of lookahead (ETA + buffer).
  const SLACK_PER_MIN = 1 / 15;
  // A window has to move by half a bay before we call it filling or emptying —
  // below that it is curve noise, not advice.
  const TREND_EPSILON = 0.5;
  const TONE = 'חיזוי, לא הבטחה';

  // Number(null) is 0 and Number(true) is 1, so a plain Number() would turn a
  // missing ETA into a confident "arriving right now" rather than the default.
  function finiteOr(value, fallback) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value !== 'string' || value.trim() === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  // Minute-of-day, wrapping across midnight: a 10-minute margin at 23:58 has to
  // read the small hours of the curve rather than fall off the end of it.
  function wrapMinute(minute) {
    const m = Math.round(finiteOr(minute, 0));
    return ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  }

  function clockLabel(minute) {
    const m = wrapMinute(minute);
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  // 24 finite, non-negative free-bay counts — or null. A hole is rejected, not
  // coerced: Number(null) would read as a whole hour of zero free bays.
  function normalizeCurve(freeByHour) {
    if (!Array.isArray(freeByHour) || freeByHour.length !== 24) return null;
    const ok = freeByHour.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
    return ok ? freeByHour.slice() : null;
  }

  // hourlySeries rows ({ hour, total, occupied }) carry occupancy; the margin
  // reasons about free bays, so convert once here.
  function freeByHourFromSeries(series) {
    if (!Array.isArray(series)) return null;
    const out = new Array(24).fill(null);
    for (const row of series) {
      const hour = Number(row && row.hour);
      const free = Number(row && row.total) - Number(row && row.occupied);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isFinite(free)) continue;
      out[hour] = Math.max(0, free);
    }
    return normalizeCurve(out);
  }

  // Read between the hours: one point per hour means stepping at :00 would make
  // any sub-hour window flat — a point prediction wearing a range's clothes.
  function readCurve(curve, minute) {
    const m = wrapMinute(minute);
    const hour = Math.floor(m / 60);
    const next = (hour + 1) % 24;
    return curve[hour] + (curve[next] - curve[hour]) * ((m % 60) / 60);
  }

  function freeAtMinute(freeByHour, minute) {
    const curve = normalizeCurve(freeByHour);
    return curve ? readCurve(curve, minute) : null;
  }

  // What the far edge of the window costs the driver — the whole point of a
  // margin: a filling lot earns "leave earlier", an emptying one "no need to race".
  function trendOf(drift, bufferMinutes) {
    if (drift <= -TREND_EPSILON) return { trend: 'filling', trendLabel: 'מתמלא', advice: 'החניון מתמלא בחלון הזה — כדאי להקדים בכמה דקות במקום לכוון לדקה אחת.' };
    if (drift >= TREND_EPSILON) return { trend: 'emptying', trendLabel: 'מתפנה', advice: 'החניון מתפנה בחלון הזה — גם הגעה בסוף החלון סבירה.' };
    return {
      trend: 'stable', trendLabel: 'יציב',
      advice: bufferMinutes > 0
        ? 'התפוסה יציבה בחלון הזה — אין צורך לרוץ אחרי דקה מדויקת.'
        : 'התפוסה יציבה סביב זמן ההגעה — שווה להשאיר שולי ביטחון בכל זאת.',
    };
  }

  const baysLabel = (n) => (n === 1 ? 'מקום פנוי אחד' : n + ' מקומות פנויים');

  // Never one bare number: zero stays sayable ("ייתכן גם אפס") and a one-bay
  // band still reads as an estimate ("כ־").
  function rangeLabel(low, high) {
    if (high <= 0) return 'החיזוי לא מראה מקום פנוי בחלון הזה';
    if (low <= 0) return 'עד ' + baysLabel(high) + ' — ייתכן גם אפס';
    if (low === high) return low === 1 ? 'מקום פנוי אחד בלבד' : 'כ־' + baysLabel(low);
    return low + '–' + high + ' מקומות פנויים';
  }

  function arrivalMargin(opts) {
    const o = opts || {};
    const curve = normalizeCurve(o.freeByHour);
    if (!curve) return null;

    const etaMinutes = Math.round(clamp(finiteOr(o.etaMinutes, DEFAULT_ETA_MIN), 0, MAX_ETA_MIN));
    const bufferMinutes = Math.round(clamp(finiteOr(o.bufferMinutes, DEFAULT_BUFFER_MIN), 0, MAX_BUFFER_MIN));
    const nowMinutes = wrapMinute(o.nowMinutes);
    const arrival = nowMinutes + etaMinutes;
    const from = arrival - bufferMinutes;
    const to = arrival + bufferMinutes;
    // Cap the band at the lot's capacity when we know it; without it, the best
    // hour of the curve, rather than inventing bays.
    const capacity = Math.max(0, Math.round(finiteOr(o.total, Math.max.apply(null, curve))));

    let lowest = Infinity;
    let highest = -Infinity;
    for (let m = from; m <= to; m++) {
      const free = readCurve(curve, m);
      if (free < lowest) lowest = free;
      if (free > highest) highest = free;
    }
    const slack = Math.ceil((etaMinutes + bufferMinutes) * SLACK_PER_MIN);
    const low = Math.max(0, Math.floor(lowest) - slack);
    const high = clamp(Math.ceil(highest) + slack, low, capacity);
    const drift = readCurve(curve, to) - readCurve(curve, from);
    const trend = trendOf(drift, bufferMinutes);
    const windowLabel = clockLabel(from) + '–' + clockLabel(to);
    const range = rangeLabel(low, high);

    return {
      etaMinutes, bufferMinutes, slack, nowMinutes, low, high, capacity, windowLabel,
      arrivalMinutes: wrapMinute(arrival), fromMinutes: wrapMinute(from), toMinutes: wrapMinute(to),
      arrivalLabel: clockLabel(arrival), rangeLabel: range, drift: Number(drift.toFixed(2)),
      expected: clamp(Math.round(readCurve(curve, arrival)), 0, capacity),
      trend: trend.trend, trendLabel: trend.trendLabel, advice: trend.advice,
      headline: 'חלון הגעה ' + windowLabel + ' · ' + range,
      tone: TONE,
    };
  }

  return {
    DEFAULT_ETA_MIN, DEFAULT_BUFFER_MIN, MAX_ETA_MIN, MAX_BUFFER_MIN, SLACK_PER_MIN,
    TREND_EPSILON, TONE, clockLabel, wrapMinute, normalizeCurve,
    freeByHourFromSeries, freeAtMinute, rangeLabel, arrivalMargin,
  };
});
