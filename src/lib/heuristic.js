// ParkWiz — occupancy heuristic (the kit algorithm).
//
// Pure functions over luma stats and optional aligned samples. Not computer
// vision, not a neural net, not a live camera. Every result is heuristic.
//
// v2 adds lighting classification, robust stats (median/MAD), gain-matched
// background subtraction, and a lighting-aware absolute fallback. The v1
// brightness score is still available as estimateOccupiedLegacy so a
// municipality can compare the two on the same patches.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizHeuristic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LUMA_R = 0.2126;
  const LUMA_G = 0.7152;
  const LUMA_B = 0.0722;
  // Sample every 4th pixel (RGBA stride 16) — same as the original kit loop.
  const SAMPLE_STRIDE = 16;

  const DAY_LUMA_MIN = 70;
  const DUSK_LUMA_MIN = 35;

  const EMPTY_SCORE_CUTOFF = 14;
  const EMPTY_MEAN_WEIGHT = 0.65;
  const EMPTY_STD_WEIGHT = 0.35;
  const ABS_MEAN_CUTOFF = 95;
  const ABS_VAR_CUTOFF = 900;

  // Night asphalt is dark. A day mean-cutoff would mark every empty bay occupied.
  const NIGHT_ABS_VAR_CUTOFF = 380;
  const NIGHT_ABS_MAD_CUTOFF = 11;
  const DUSK_ABS_MEAN_CUTOFF = 55;
  const DUSK_ABS_VAR_CUTOFF = 700;

  // After gain-matching current luma to the empty reference, occupancy shows
  // up as leftover contrast (std / MAD / percentile range), not as a mean shift.
  const NORM_SCORE_CUTOFF = 9.5;
  const NORM_STD_WEIGHT = 0.4;
  const NORM_MAD_WEIGHT = 0.35;
  const NORM_RANGE_WEIGHT = 0.25;
  const NIGHT_NORM_SCORE_CUTOFF = 7.5;

  // Pixel residual after applying the same gain. Fraction of samples that moved.
  const BG_PIXEL_DELTA = 22;
  const BG_PIXEL_DELTA_NIGHT = 16;
  const BG_FRACTION_DAY = 0.18;
  const BG_FRACTION_DUSK = 0.2;
  const BG_FRACTION_NIGHT = 0.22;

  const CONF_BG_SUBTRACT = 0.58;
  const CONF_VS_EMPTY_NORM = 0.52;
  const CONF_VS_EMPTY = 0.45;
  const CONF_ABSOLUTE = 0.25;
  const CONF_ABSOLUTE_NIGHT = 0.16;

  function luma(r, g, b) {
    return LUMA_R * Number(r) + LUMA_G * Number(g) + LUMA_B * Number(b);
  }

  function emptyStats() {
    return { mean: 0, variance: 0, n: 0, median: 0, mad: 0, p10: 0, p90: 0 };
  }

  function classifyLighting(meanLuma) {
    const y = Number(meanLuma);
    if (!Number.isFinite(y)) return 'day';
    if (y < DUSK_LUMA_MIN) return 'night';
    if (y < DAY_LUMA_MIN) return 'dusk';
    return 'day';
  }

  function percentile(sorted, p) {
    if (!sorted || !sorted.length) return 0;
    if (sorted.length === 1) return sorted[0];
    const t = Math.max(0, Math.min(1, Number(p)));
    const idx = (sorted.length - 1) * t;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const f = idx - lo;
    return sorted[lo] * (1 - f) + sorted[hi] * f;
  }

  function lumaSamples(data, stride) {
    const step = Number(stride);
    const use = Number.isFinite(step) && step >= 4 ? Math.floor(step) : SAMPLE_STRIDE;
    const out = [];
    if (!data || typeof data.length !== 'number' || data.length < 4) return out;
    for (let i = 0; i + 2 < data.length; i += use) {
      const y = luma(data[i], data[i + 1], data[i + 2]);
      if (Number.isFinite(y)) out.push(y);
    }
    return out;
  }

  function statsFromSamples(samples) {
    const list = Array.isArray(samples) ? samples : [];
    if (!list.length) return emptyStats();
    let sum = 0;
    let sum2 = 0;
    for (let i = 0; i < list.length; i++) {
      sum += list[i];
      sum2 += list[i] * list[i];
    }
    const n = list.length;
    const mean = sum / n;
    const variance = Math.max(0, sum2 / n - mean * mean);
    const sorted = list.slice().sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const dev = list.map((y) => Math.abs(y - median)).sort((a, b) => a - b);
    return {
      mean,
      variance,
      n,
      median,
      mad: percentile(dev, 0.5),
      p10: percentile(sorted, 0.1),
      p90: percentile(sorted, 0.9),
    };
  }

  function statsFromRgba(data, stride) {
    return statsFromSamples(lumaSamples(data, stride));
  }

  function lightingGain(curMean, refMean) {
    const cur = Number(curMean);
    const ref = Number(refMean);
    if (!Number.isFinite(cur) || !Number.isFinite(ref) || cur <= 1) return 1;
    return ref / cur;
  }

  function stdOf(stats) {
    return Math.sqrt(Math.max(0, stats && Number.isFinite(stats.variance) ? stats.variance : 0));
  }

  function madOf(stats) {
    if (stats && Number.isFinite(stats.mad)) return stats.mad;
    return stdOf(stats) * 0.8;
  }

  function rangeOf(stats) {
    if (stats && Number.isFinite(stats.p90) && Number.isFinite(stats.p10)) {
      return Math.max(0, stats.p90 - stats.p10);
    }
    return 2 * stdOf(stats);
  }

  function legacyVsEmptyScore(cur, emp) {
    const dMean = Math.abs(cur.mean - emp.mean);
    const dStd = Math.abs(stdOf(cur) - stdOf(emp));
    return dMean * EMPTY_MEAN_WEIGHT + dStd * EMPTY_STD_WEIGHT;
  }

  function normalizedContrastScore(cur, emp) {
    const gain = lightingGain(cur.mean, emp.mean);
    const dStd = Math.abs(stdOf(cur) * gain - stdOf(emp));
    const dMad = Math.abs(madOf(cur) * gain - madOf(emp));
    const dRange = Math.abs(rangeOf(cur) * gain - rangeOf(emp));
    const score = dStd * NORM_STD_WEIGHT + dMad * NORM_MAD_WEIGHT + dRange * NORM_RANGE_WEIGHT;
    return { score, gain, dStd, dMad, dRange };
  }

  function bgFractionCutoff(lighting) {
    if (lighting === 'night') return BG_FRACTION_NIGHT;
    if (lighting === 'dusk') return BG_FRACTION_DUSK;
    return BG_FRACTION_DAY;
  }

  function backgroundSubtract(curSamples, emptySamples, lighting) {
    const cur = Array.isArray(curSamples) ? curSamples : [];
    const emp = Array.isArray(emptySamples) ? emptySamples : [];
    const n = Math.min(cur.length, emp.length);
    if (n < 8) return null;
    let curSum = 0;
    let empSum = 0;
    for (let i = 0; i < n; i++) {
      curSum += cur[i];
      empSum += emp[i];
    }
    const gain = lightingGain(curSum / n, empSum / n);
    const delta = lighting === 'night' ? BG_PIXEL_DELTA_NIGHT : BG_PIXEL_DELTA;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(cur[i] * gain - emp[i]) >= delta) changed += 1;
    }
    const fraction = changed / n;
    return {
      n,
      changed,
      fraction,
      gain,
      delta,
      cutoff: bgFractionCutoff(lighting),
      occupied: fraction >= bgFractionCutoff(lighting),
    };
  }

  function pickEmptyRef(emp, opts, lighting) {
    const night = opts && opts.emptyNight;
    if (lighting === 'night' && night && Number.isFinite(night.mean) && Number.isFinite(night.variance)) {
      return night;
    }
    if (emp && Number.isFinite(emp.mean) && Number.isFinite(emp.variance)) return emp;
    return null;
  }

  function absoluteEstimate(cur, lighting) {
    if (lighting === 'night') {
      const occupied = cur.variance > NIGHT_ABS_VAR_CUTOFF || madOf(cur) > NIGHT_ABS_MAD_CUTOFF;
      return {
        occupied,
        score: Math.sqrt(Math.max(0, cur.variance)) / 4 + madOf(cur),
        method: 'absolute-threshold',
        confidence: CONF_ABSOLUTE_NIGHT,
        lighting,
        heuristic: true,
      };
    }
    if (lighting === 'dusk') {
      const occupied = cur.mean < DUSK_ABS_MEAN_CUTOFF || cur.variance > DUSK_ABS_VAR_CUTOFF;
      return {
        occupied,
        score: (DUSK_ABS_MEAN_CUTOFF - cur.mean) + stdOf(cur) / 4,
        method: 'absolute-threshold',
        confidence: CONF_ABSOLUTE,
        lighting,
        heuristic: true,
      };
    }
    return {
      occupied: cur.mean < ABS_MEAN_CUTOFF || cur.variance > ABS_VAR_CUTOFF,
      score: (ABS_MEAN_CUTOFF - cur.mean) + stdOf(cur) / 4,
      method: 'absolute-threshold',
      confidence: CONF_ABSOLUTE,
      lighting,
      heuristic: true,
    };
  }

  function estimateOccupiedLegacy(cur, emp) {
    if (!cur || !Number.isFinite(cur.mean) || !Number.isFinite(cur.variance)) {
      return null;
    }
    if (emp && Number.isFinite(emp.mean) && Number.isFinite(emp.variance)) {
      const score = legacyVsEmptyScore(cur, emp);
      return {
        occupied: score >= EMPTY_SCORE_CUTOFF,
        score,
        method: 'vs-empty-frame',
        confidence: CONF_VS_EMPTY,
        heuristic: true,
      };
    }
    return {
      occupied: cur.mean < ABS_MEAN_CUTOFF || cur.variance > ABS_VAR_CUTOFF,
      score: (ABS_MEAN_CUTOFF - cur.mean) + stdOf(cur) / 4,
      method: 'absolute-threshold',
      confidence: CONF_ABSOLUTE,
      heuristic: true,
    };
  }

  function estimateOccupied(cur, emp, opts) {
    if (!cur || !Number.isFinite(cur.mean) || !Number.isFinite(cur.variance)) {
      return null;
    }
    const o = opts || {};
    const lighting = o.lighting || classifyLighting(cur.mean);
    const curSamples = o.curSamples;
    const emptySamples = o.emptyNightSamples && lighting === 'night'
      ? o.emptyNightSamples
      : o.emptySamples;

    if (curSamples && emptySamples) {
      const bg = backgroundSubtract(curSamples, emptySamples, lighting);
      if (bg) {
        return {
          occupied: bg.occupied,
          score: +(bg.fraction * 100).toFixed(2),
          method: 'bg-subtract-normalized',
          confidence: CONF_BG_SUBTRACT,
          lighting,
          heuristic: true,
          detail: bg,
        };
      }
    }

    const ref = pickEmptyRef(emp, o, lighting);
    if (ref) {
      const n = normalizedContrastScore(cur, ref);
      const cutoff = lighting === 'night' ? NIGHT_NORM_SCORE_CUTOFF : NORM_SCORE_CUTOFF;
      return {
        occupied: n.score >= cutoff,
        score: n.score,
        method: 'vs-empty-normalized',
        confidence: CONF_VS_EMPTY_NORM,
        lighting,
        heuristic: true,
        detail: n,
      };
    }

    return absoluteEstimate(cur, lighting);
  }

  function estimateLot(items, opts) {
    const list = Array.isArray(items) ? items : [];
    const o = opts || {};
    const means = [];
    list.forEach((it) => {
      if (it && it.cur && Number.isFinite(it.cur.mean)) means.push(it.cur.mean);
    });
    const globalMean = means.length
      ? means.slice().sort((a, b) => a - b)[Math.floor(means.length / 2)]
      : (o.globalMean != null ? o.globalMean : 120);
    const lighting = o.lighting || classifyLighting(globalMean);
    const estimates = list.map((it) => {
      if (!it) return { occupied: false, method: 'unknown', confidence: 0, heuristic: true, lighting };
      const r = estimateOccupied(it.cur, it.empty, {
        lighting,
        curSamples: it.curSamples,
        emptySamples: it.emptySamples,
        emptyNight: it.emptyNight,
        emptyNightSamples: it.emptyNightSamples,
      });
      if (!r) {
        return {
          id: it.id,
          occupied: false,
          score: 0,
          method: 'unknown',
          confidence: 0,
          lighting,
          heuristic: true,
        };
      }
      return { id: it.id, ...r };
    });
    const occupied = estimates.filter((e) => e && e.occupied).length;
    let csum = 0;
    estimates.forEach((e) => { csum += Number(e.confidence) || 0; });
    return {
      lighting,
      estimates,
      total: estimates.length,
      occupied,
      source: 'heuristic-occupancy',
      confidence: estimates.length ? csum / estimates.length : 0,
      heuristic: true,
    };
  }

  function methodConfidence(method) {
    if (method === 'bg-subtract-normalized') return CONF_BG_SUBTRACT;
    if (method === 'vs-empty-normalized') return CONF_VS_EMPTY_NORM;
    if (method === 'vs-empty-frame') return CONF_VS_EMPTY;
    if (method === 'absolute-threshold') return CONF_ABSOLUTE;
    return 0;
  }

  function methodLabelHe(method) {
    if (method === 'bg-subtract-normalized') return 'חיסור רקע מנורמל-תאורה';
    if (method === 'vs-empty-normalized') return 'השוואה לפריים ריק אחרי נרמול תאורה';
    if (method === 'vs-empty-frame') return 'השוואת בהירות לפריים ריק (v1)';
    if (method === 'absolute-threshold') return 'סף מוחלט לפי תאורה';
    return 'לא ידוע';
  }

  return {
    luma,
    lumaSamples,
    statsFromSamples,
    statsFromRgba,
    classifyLighting,
    percentile,
    lightingGain,
    normalizedContrastScore,
    backgroundSubtract,
    estimateOccupied,
    estimateOccupiedLegacy,
    estimateLot,
    methodConfidence,
    methodLabelHe,
    SAMPLE_STRIDE,
    DAY_LUMA_MIN,
    DUSK_LUMA_MIN,
    EMPTY_SCORE_CUTOFF,
    ABS_MEAN_CUTOFF,
    ABS_VAR_CUTOFF,
    NIGHT_ABS_VAR_CUTOFF,
    NIGHT_ABS_MAD_CUTOFF,
    NORM_SCORE_CUTOFF,
    NIGHT_NORM_SCORE_CUTOFF,
    BG_PIXEL_DELTA,
    BG_PIXEL_DELTA_NIGHT,
    BG_FRACTION_DAY,
    BG_FRACTION_NIGHT,
    CONF_BG_SUBTRACT,
    CONF_VS_EMPTY_NORM,
    CONF_VS_EMPTY,
    CONF_ABSOLUTE,
    CONF_ABSOLUTE_NIGHT,
  };
});
