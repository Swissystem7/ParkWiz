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

  // The one place that decides what z a caller gets. Only a positive finite
  // number is a confidence multiplier: z = 0 collapses the interval onto the
  // point estimate (lo = hi = 0.875 for 35/40, an interval that claims no
  // uncertainty at all) and a negative z turns it inside out (lo
  // 0.9183068613844062 above hi 0.8134004556887645 for the same counts), so
  // both fall back to Z95 instead.
  //
  // This rule used to be copied into wilsonInterval, pooledAgreement and
  // accuracyWilson. Three copies made the outer two untestable: dropping
  // "zz > 0" from pooledAgreement alone changed nothing measurable, because
  // wilsonInterval sanitised the same z again downstream. One copy can be
  // pinned by one test, and is, in test/occupancy-accuracy.test.js.
  function resolveZ(z) {
    const zz = Number(z);
    return Number.isFinite(zz) && zz > 0 ? zz : Z95;
  }

  function wilsonInterval(successes, n, z) {
    const N = Number(n);
    const S = Number(successes);
    const Z = resolveZ(z);
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

  function pooledAgreement(pairs, z) {
    const Z = resolveZ(z);
    const list = Array.isArray(pairs) ? pairs.filter((p) => p && Number.isFinite(p.total) && p.total > 0) : [];
    let trials = 0;
    let agree = 0;
    let signed = 0;
    list.forEach((p) => {
      const t = p.total;
      const sys = Number(p.systemOccupied);
      const man = Number(p.manualOccupied);
      if (!Number.isFinite(sys) || !Number.isFinite(man)) return;
      trials += t;
      agree += t - Math.abs(sys - man);
      signed += sys - man;
    });
    if (!trials) {
      return { trials: 0, agree: 0, rate: null, meanSignedError: null, wilson: null };
    }
    return {
      trials,
      agree,
      rate: agree / trials,
      meanSignedError: signed / list.length,
      wilson: wilsonInterval(agree, trials, Z),
    };
  }

  // accuracyWilson — the two accuracy numbers the municipality actually needs
  // from a series of system-vs-inspector counts, with their uncertainty.
  //
  //   meanAgreement   — mean of the per-pair accuracies (each pair weighs the
  //                     same, whatever its lot size). This is what a reader
  //                     means by "the average day was 88% right".
  //   pooledAgreement — agreeing spot comparisons over all spot comparisons.
  //                     Large lots pull it more. This is the quantity the
  //                     binomial interval below is actually about.
  //
  // The interval is the two-sided Wilson score interval on the pooled count.
  // Derivation: the score statistic for a binomial proportion is
  //     (phat - p) / sqrt(p*(1 - p)/n)
  // and the interval is the set of p for which its absolute value is <= z.
  // Squaring and collecting terms gives the quadratic
  //     p^2*(n + z^2) - p*(2*n*phat + z^2) + n*phat^2 = 0
  // whose roots, divided through by n, are
  //     p = [ phat + z^2/(2n) +- z*sqrt( phat*(1 - phat)/n + z^2/(4n^2) ) ]
  //         / (1 + z^2/n)
  // which is exactly what wilsonInterval() above evaluates. Unlike the normal
  // approximation it never leaves [0, 1] and it stays sane at phat = 0 or 1.
  //
  // Pure: no Date, no Math.random, no localStorage. z defaults to Z95.
  function accuracyWilson(pairs, z) {
    const Z = resolveZ(z);
    const summary = compare.summarizePairs(pairs);
    const pooled = pooledAgreement(pairs, Z);
    return {
      count: summary.count,
      meanAgreement: summary.meanAccuracy,
      minAgreement: summary.minAccuracy,
      maxAgreement: summary.maxAccuracy,
      trials: pooled.trials,
      agree: pooled.agree,
      pooledAgreement: pooled.rate,
      meanSignedError: pooled.meanSignedError,
      wilson: pooled.wilson,
      z: Z,
      sampleOnly: summary.sampleOnly,
    };
  }

  function dayMs(isoDay) {
    const m = String(isoDay || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
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
    if (!Number.isFinite(day) || day < 1 || day > PILOT_DAYS) return null;
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
    const start = String(startDate || '').match(/^\d{4}-\d{2}-\d{2}/) ? String(startDate).slice(0, 10) : '';
    const out = [];
    for (let i = 0; i < len; i++) {
      out.push(emptyDay(i + 1, start ? addDays(start, i) : ''));
    }
    return out;
  }

  function mergeLog(calendar, incoming) {
    const base = (Array.isArray(calendar) && calendar.length)
      ? calendar.map((d, i) => normalizeDay(d) || emptyDay(i + 1, d && d.date))
      : buildCalendar('', PILOT_DAYS);
    const byDay = new Map(base.map((d) => [d.day, d]));
    (Array.isArray(incoming) ? incoming : []).forEach((raw) => {
      const d = normalizeDay(raw);
      if (!d) return;
      const prev = byDay.get(d.day) || emptyDay(d.day, d.date);
      byDay.set(d.day, {
        ...prev,
        ...d,
        date: d.date || prev.date,
      });
    });
    return Array.from(byDay.values()).sort((a, b) => a.day - b.day);
  }

  function parseLog(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    let list = [];
    try {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) list = a;
      else if (a && Array.isArray(a.days)) list = a.days;
    } catch (e) {
      return [];
    }
    return list.map(normalizeDay).filter(Boolean).sort((a, b) => a.day - b.day);
  }

  function filledDays(log) {
    return (Array.isArray(log) ? log : []).filter((d) => (
      d && d.total != null && d.systemOccupied != null && d.manualOccupied != null
    ));
  }

  function dayToPair(day, street) {
    if (!day || day.total == null || day.systemOccupied == null || day.manualOccupied == null) return null;
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
    return filledDays(log).map((d) => dayToPair(d, street)).filter(Boolean);
  }

  function daysSince(isoDay, now) {
    const a = dayMs(isoDay);
    if (!Number.isFinite(a)) return null;
    const t = now instanceof Date ? now.getTime() : Date.parse(now);
    if (!Number.isFinite(t)) return null;
    return Math.floor((t - a) / 86400000);
  }

  function decidePilot(input) {
    const pairs = (input && Array.isArray(input.pairs)) ? input.pairs : [];
    const summary = compare.summarizePairs(pairs);
    const pooled = pooledAgreement(pairs);
    const hasCalibrationPlan = !!(input && input.hasCalibrationPlan);
    const cameraAccess = !!(input && input.cameraAccess);
    const integratorAsk = !!(input && input.integratorAsk);
    const outreachSentAt = input && input.outreachSentAt ? String(input.outreachSentAt) : '';
    const now = (input && input.now) || new Date();
    const elapsed = outreachSentAt ? daysSince(outreachSentAt, now) : null;
    const camlytics = VENDOR_CLAIMS[0].rate;

    const reasons = [];
    let code = 'INSUFFICIENT';
    let label = 'אין עדיין מספיק תצפיות לפסק דין.';

    if (summary.sampleOnly && summary.count) {
      code = 'SAMPLE_ONLY';
      label = 'סדרת דוגמה — אין פסק דין שטח.';
      reasons.push('כל הזוגות מסומנים sample. כלל העצירה חל רק על ספירת פקח אמיתית.');
    } else if (summary.count < MIN_PAIRS || pooled.trials < MIN_SPOT_TRIALS) {
      code = 'INSUFFICIENT';
      label = 'מדגם קטן מדי — ממשיכים לאסוף.';
      reasons.push(
        'צריך לפחות ' + MIN_PAIRS + ' זוגות ו־' + MIN_SPOT_TRIALS +
        ' השוואות מקום (יש ' + summary.count + ' זוגות, ' + pooled.trials + ' מקומות).'
      );
    } else if (pooled.rate != null && pooled.rate < camlytics && !hasCalibrationPlan) {
      code = 'PARK_ACCURACY';
      label = 'PARK — הדיוק מתחת להצהרת יצרן ואין תוכנית כיול.';
      reasons.push(
        'הסכם מול פקח הוא ' + occ.pct(pooled.rate) +
        ', מתחת ל־96% ש־Camlytics מצהירה (הצהרת יצרן, לא רף מדעי).'
      );
      reasons.push('בלי תוכנית כיול פר־מצלמה כלל העצירה ב־RESEARCH.md אומר PARK מיד.');
    } else if (elapsed != null && elapsed >= PILOT_DAYS && !cameraAccess && !integratorAsk) {
      code = 'PARK_NO_ACCESS';
      label = 'PARK — 30 יום מהפנייה בלי גישת מצלמה ובלי בקשת דמו.';
      reasons.push('חלפו ' + elapsed + ' ימים מאז תאריך הפנייה שסומן, בלי גישת snapshot ובלי פנייה מאינטגרטור.');
    } else {
      code = 'CONTINUE';
      label = 'ממשיכים את הפיילוט.';
      if (pooled.rate != null && pooled.rate >= camlytics) {
        reasons.push('הסכם מול פקח על הסדרה הזו הוא ' + occ.pct(pooled.rate) + ' — מעל הצהרת Camlytics, עדיין לא מדידת מצלמה חיה.');
      } else if (hasCalibrationPlan && pooled.rate != null && pooled.rate < camlytics) {
        reasons.push('הדיוק מתחת להצהרת יצרן, אבל סומנה תוכנית כיול פר־מצלמה — ממשיכים למדוד, לא PARK אוטומטי.');
      } else {
        reasons.push('יש מספיק זוגות שדה ואין תנאי עצירה שמתקיים.');
      }
    }

    reasons.push('אין בפסק הדין הזה המלצת אכיפה או זיהוי לוחיות.');

    return {
      code,
      label,
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
    accuracyWilson,
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
