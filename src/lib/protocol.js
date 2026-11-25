// ParkWiz — 30-day field protocol and the RESEARCH.md stop rule.
//
// The verdict is executable, not a slogan. Sample-only series never produce
// a field PARK/CONTINUE. Vendor rates are manufacturer claims, not a lab bar.
(function (root, factory) {
  const occ = (typeof module === 'object' && module.exports)
    ? require('./occupancy')
    : root.ParkWizOccupancy;
  const compare = (typeof module === 'object' && module.exports)
    ? require('./compare')
    : root.ParkWizCompare;
  const api = factory(occ, compare);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (occ, compare) {
  const PILOT_DAYS = 30;
  const MIN_SPOT_TRIALS = 100;
  const MIN_PAIRS = 8;
  const Z95 = 1.96;
  const VENDOR_CLAIMS = Object.freeze([
    {
      id: 'camlytics',
      rate: 0.96,
      label: 'Camlytics',
      note: 'הצהרת יצרן (~96% בתאורה רגילה) — לא רף מדעי ולא חוזה נתניה.',
    },
    {
      id: 'parklio',
      rate: 0.99,
      label: 'Parklio Detect',
      note: 'הצהרת יצרן (99%) — לא נמדד כאן.',
    },
  ]);
  const LIGHTING = Object.freeze(['יום', 'דמדומים', 'לילה', 'גשם / רטוב']);

  function wilsonInterval(successes, n, z) {
    const N = Number(n);
    const S = Number(successes);
    const zz = Number(z);
    const Z = Number.isFinite(zz) && zz > 0 ? zz : Z95;
    if (!Number.isFinite(N) || N <= 0 || !Number.isFinite(S) || S < 0) return null;
    const p = Math.max(0, Math.min(1, S / N));
    const z2 = Z * Z;
    const den = 1 + z2 / N;
    const center = (p + z2 / (2 * N)) / den;
    const margin = Z * Math.sqrt((p * (1 - p) + z2 / (4 * N)) / N) / den;
    return {
      n: N,
      successes: S,
      p,
      lo: Math.max(0, center - margin),
      hi: Math.min(1, center + margin),
      z: Z,
    };
  }

  function processPairItem(p) {
    const t = p.total;
    const sys = Number(p.systemOccupied);
    const man = Number(p.manualOccupied);
    if (!Number.isFinite(sys) || !Number.isFinite(man)) return null;
    return {
      trials: t,
      agree: t - Math.abs(sys - man),
      signed: sys - man,
    };
  }

  function pooledAgreement(pairs) {
    if (!Array.isArray(pairs)) {
      return { trials: 0, agree: 0, rate: null, meanSignedError: null, wilson: null };
    }
    const list = pairs.filter((p) => p && Number.isFinite(p.total) && p.total > 0);
    let trials = 0;
    let agree = 0;
    let signed = 0;
    let counted = 0;
    list.forEach((p) => {
      const res = processPairItem(p);
      if (!res) return;
      trials += res.trials;
      agree += res.agree;
      signed += res.signed;
      counted += 1;
    });
    if (!trials) {
      return { trials: 0, agree: 0, rate: null, meanSignedError: null, wilson: null };
    }
    return {
      trials,
      agree,
      rate: agree / trials,
      meanSignedError: signed / counted,
      wilson: wilsonInterval(agree, trials, Z95),
    };
  }

  // A date that is not on the calendar (month 13, 31 February) is NaN, not a
  // silently rolled-over day: Date.UTC would otherwise turn 2026-02-31 into
  // 3 March and shift every pilot day and the outreach countdown with it.
  function dayMs(isoDay) {
    if (!isoDay || typeof isoDay !== 'string') return NaN;
    const m = isoDay.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return NaN;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12) return NaN;
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    if (back.getUTCDate() !== d) return NaN;
    return t;
  }

  function addDays(isoDay, n) {
    const t = dayMs(isoDay);
    if (!Number.isFinite(t)) return '';
    const d = new Date(t + n * 86400000);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + mo + '-' + da;
  }

  function emptyDay(day, date) {
    return {
      day,
      date: date || '',
      lighting: '',
      total: null,
      systemOccupied: null,
      manualOccupied: null,
      note: '',
      source: '',
    };
  }

  function normalizeDay(input) {
    if (!input || typeof input !== 'object') return null;
    const day = Number(input.day);
    if (!Number.isInteger(day) || day < 1 || day > PILOT_DAYS) return null;
    const numOrNull = (v) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const total = numOrNull(input.total);
    let sys = numOrNull(input.systemOccupied != null ? input.systemOccupied : input.occupied);
    let man = numOrNull(input.manualOccupied);
    if (total != null && total <= 0) return null;
    if (total != null) {
      if (sys != null) sys = Math.max(0, Math.min(total, sys));
      if (man != null) man = Math.max(0, Math.min(total, man));
    }
    return {
      day,
      date: input.date != null ? String(input.date) : '',
      lighting: input.lighting != null ? String(input.lighting) : '',
      total,
      systemOccupied: sys,
      manualOccupied: man,
      note: input.note != null ? String(input.note) : '',
      source: input.source != null ? String(input.source) : '',
    };
  }

  function buildCalendar(startDate, days) {
    const n = Number(days);
    const len = Number.isFinite(n) && n > 0 ? Math.min(PILOT_DAYS, Math.floor(n)) : PILOT_DAYS;
    const m = typeof startDate === 'string' ? startDate.match(/^(\d{4}-\d{2}-\d{2})/) : null;
    const valid = m && Number.isFinite(dayMs(m[1]));
    const out = [];
    for (let i = 0; i < len; i++) {
      out.push(emptyDay(i + 1, valid ? addDays(m[1], i) : ''));
    }
    return out;
  }

  function mergeLog(calendar, incoming) {
    const base = (Array.isArray(calendar) && calendar.length)
      ? calendar.map((d, i) => normalizeDay(d) || emptyDay(i + 1, d && d.date))
      : buildCalendar();
    const byDay = new Map(base.map((d) => [d.day, d]));
    if (Array.isArray(incoming)) {
      incoming.forEach((raw) => {
        const d = normalizeDay(raw);
        if (!d) return;
        const prev = byDay.get(d.day) || emptyDay(d.day, d.date);
        byDay.set(d.day, {
          ...prev,
          ...d,
          date: d.date || prev.date,
        });
      });
    }
    return Array.from(byDay.values()).sort((a, b) => a.day - b.day);
  }

  function parseLog(text) {
    let a = null;
    try {
      a = JSON.parse(text);
    } catch (e) {
      // invalid JSON: a remains null
    }
    const list = Array.isArray(a) ? a : (a && Array.isArray(a.days) ? a.days : null);
    if (!Array.isArray(list)) return [];
    return list.map(normalizeDay).filter(Boolean).sort((a, b) => a.day - b.day);
  }

  function filledDays(log) {
    if (!Array.isArray(log)) return [];
    return log.filter((d) => (
      d && d.total != null && d.systemOccupied != null && d.manualOccupied != null
    ));
  }

  function dayToPair(day, street) {
    if (!day) return null;
    return compare.pairObservation({
      ts: day.date ? (day.date + 'T12:00:00') : ('day-' + day.day),
      street: street || '—',
      total: day.total,
      systemOccupied: day.systemOccupied,
      manualOccupied: day.manualOccupied,
      note: [day.lighting, day.note].filter(Boolean).join(' · '),
      source: day.source || 'field',
    });
  }

  function logToPairs(log, street) {
    return filledDays(log).map((d) => dayToPair(d, street));
  }

  function daysSince(isoDay, now) {
    const a = dayMs(isoDay);
    if (!Number.isFinite(a)) return null;
    const t = now instanceof Date ? now.getTime()
      : (typeof now === 'number' ? now : Date.parse(now));
    if (!Number.isFinite(t)) return null;
    return Math.floor((t - a) / 86400000);
  }

  function isSampleOnlySummary(summary) {
    return !!(summary && summary.sampleOnly && summary.count);
  }

  function labelSampleOnly() {
    return 'סדרת דוגמה — אין פסק דין שטח.';
  }

  function reasonsSampleOnly() {
    return ['כל הזוגות מסומנים sample. כלל העצירה חל רק על ספירת פקח אמיתית.'];
  }

  function isInsufficientSample(summary, pooled) {
    if (!summary) return false;
    return summary.count < MIN_PAIRS || (pooled && pooled.trials < MIN_SPOT_TRIALS);
  }

  function labelInsufficientSample() {
    return 'מדגם קטן מדי — ממשיכים לאסוף.';
  }

  function reasonsInsufficientSample(summary, pooled) {
    return [
      'צריך לפחות ' + MIN_PAIRS + ' זוגות ו־' + MIN_SPOT_TRIALS +
      ' השוואות מקום (יש ' + (summary ? summary.count : '?') + ' זוגות, ' + (pooled ? pooled.trials : '?') + ' מקומות).'
    ];
  }

  function isParkAccuracy(pooled, camlytics, hasCalibrationPlan) {
    return !!(pooled && pooled.rate < camlytics && !hasCalibrationPlan);
  }

  function labelParkAccuracy() {
    return 'PARK — הדיוק מתחת להצהרת יצרן ואין תוכנית כיול.';
  }

  function reasonsParkAccuracy(pooled, camlytics) {
    return [
      'הסכם מול פקח הוא ' + occ.pct(pooled.rate) +
      ', מתחת ל־96% ש־Camlytics מצהירה (הצהרת יצרן, לא רף מדעי).',
      'בלי תוכנית כיול פר־מצלמה כלל העצירה ב־RESEARCH.md אומר PARK מיד.',
    ];
  }

  function isParkNoAccess(elapsed, cameraAccess, integratorAsk) {
    return !!(elapsed != null && elapsed >= PILOT_DAYS && !cameraAccess && !integratorAsk);
  }

  function labelParkNoAccess(elapsed) {
    return 'PARK — 30 יום מהפנייה בלי גישת מצלמה ובלי בקשת דמו.';
  }

  function reasonsParkNoAccess(elapsed) {
    return ['חלפו ' + elapsed + ' ימים מאז תאריך הפנייה שסומן, בלי גישת snapshot ובלי פנייה מאינטגרטור.'];
  }

  function labelContinue() {
    return 'ממשיכים את הפיילוט.';
  }

  function reasonsContinue(pooledRate, camlytics) {
    const reasons = [];
    if (pooledRate >= camlytics) {
      reasons.push('הסכם מול פקח על הסדרה הזו הוא ' + occ.pct(pooledRate) + ' — מעל הצהרת Camlytics, עדיין לא מדידת מצלמה חיה.');
    } else {
      reasons.push('הדיוק מתחת להצהרת יצרן, אבל סומנה תוכנית כיול פר־מצלמה — ממשיכים למדוד, לא PARK אוטומטי.');
    }
    return reasons;
  }

  function evaluatePilotOutcome({ summary, pooled, hasCalibrationPlan, elapsed, cameraAccess, integratorAsk, camlytics }) {
    const reasons = [];
    let code;
    let label;

    if (isSampleOnlySummary(summary)) {
      code = 'SAMPLE_ONLY';
      label = labelSampleOnly();
      reasons.push(...reasonsSampleOnly());
    } else if (isInsufficientSample(summary, pooled)) {
      code = 'INSUFFICIENT';
      label = labelInsufficientSample();
      reasons.push(...reasonsInsufficientSample(summary, pooled));
    } else if (isParkAccuracy(pooled, camlytics, hasCalibrationPlan)) {
      code = 'PARK_ACCURACY';
      label = labelParkAccuracy();
      reasons.push(...reasonsParkAccuracy(pooled, camlytics));
    } else if (isParkNoAccess(elapsed, cameraAccess, integratorAsk)) {
      code = 'PARK_NO_ACCESS';
      label = labelParkNoAccess(elapsed);
      reasons.push(...reasonsParkNoAccess(elapsed));
    } else {
      code = 'CONTINUE';
      label = labelContinue();
      reasons.push(...reasonsContinue(pooled.rate, camlytics));
    }
    return { code, label, reasons };
  }

  function decidePilot(input) {
    const all = (input && Array.isArray(input.pairs)) ? input.pairs : null;
    const allSummary = compare.summarizePairs(all);
    const pairs = allSummary.sampleOnly ? all : (all ? all.filter((p) => !p || p.source !== 'sample') : null);
    const sampleSkipped = all ? all.length - pairs.length : 0;
    const summary = allSummary.sampleOnly ? allSummary : compare.summarizePairs(pairs);
    const pooled = pooledAgreement(pairs);
    const hasCalibrationPlan = !!(input && input.hasCalibrationPlan);
    const cameraAccess = !!(input && input.cameraAccess);
    const integratorAsk = !!(input && input.integratorAsk);
    const outreachSentAt = input && input.outreachSentAt ? String(input.outreachSentAt) : '';
    const now = (input && input.now) || new Date();
    const elapsed = outreachSentAt ? daysSince(outreachSentAt, now) : null;
    const camlytics = VENDOR_CLAIMS[0].rate;

    const outcome = evaluatePilotOutcome({
      summary,
      pooled,
      hasCalibrationPlan,
      elapsed,
      cameraAccess,
      integratorAsk,
      camlytics,
    });
    const reasons = outcome.reasons;

    if (sampleSkipped > 0) {
      reasons.push(sampleSkipped + ' זוגות דוגמה (sample) לא נספרו — פסק הדין רק על ספירות שטח.');
    }
    reasons.push('אין בפסק הדין הזה המלצת אכיפה או זיהוי לוחיות.');

    return {
      code: outcome.code,
      label: outcome.label,
      reasons,
      summary,
      pooled,
      hasCalibrationPlan,
      cameraAccess,
      integratorAsk,
      outreachSentAt,
      daysSinceOutreach: elapsed,
      vendorClaims: VENDOR_CLAIMS,
      minSpotTrials: MIN_SPOT_TRIALS,
      minPairs: MIN_PAIRS,
    };
  }

  function loadStoredLog() {
    try {
      const raw = localStorage.getItem(occ.LS.log);
      return raw ? parseLog(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLog(list) {
    try {
      localStorage.setItem(occ.LS.log, JSON.stringify(list || []));
    } catch (e) { /* quota / private mode */ }
  }

  return {
    PILOT_DAYS,
    MIN_SPOT_TRIALS,
    MIN_PAIRS,
    Z95,
    VENDOR_CLAIMS,
    LIGHTING,
    wilsonInterval,
    pooledAgreement,
    dayMs,
    addDays,
    emptyDay,
    normalizeDay,
    buildCalendar,
    mergeLog,
    parseLog,
    filledDays,
    dayToPair,
    logToPairs,
    daysSince,
    decidePilot,
    loadStoredLog,
    saveLog,
  };
});
