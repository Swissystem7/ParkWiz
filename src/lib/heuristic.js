// ParkWiz — brightness/variance occupancy heuristic (the kit algorithm).
//
// Pure functions over luma stats. The kit page still reads pixels from a
// canvas; this module decides occupied/free and documents the thresholds.
// Not computer vision, not a neural net, not a live camera.
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
  const EMPTY_SCORE_CUTOFF = 14;
  const EMPTY_MEAN_WEIGHT = 0.65;
  const EMPTY_STD_WEIGHT = 0.35;
  const ABS_MEAN_CUTOFF = 95;
  const ABS_VAR_CUTOFF = 900;
  const CONF_VS_EMPTY = 0.45;
  const CONF_ABSOLUTE = 0.25;

  function luma(r, g, b) {
    return LUMA_R * Number(r) + LUMA_G * Number(g) + LUMA_B * Number(b);
  }

  function statsFromRgba(data, stride) {
    const step = Number(stride);
    const use = Number.isFinite(step) && step >= 4 ? Math.floor(step) : SAMPLE_STRIDE;
    if (!data || typeof data.length !== 'number' || data.length < 4) {
      return { mean: 0, variance: 0, n: 0 };
    }
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    for (let i = 0; i + 2 < data.length; i += use) {
      const y = luma(data[i], data[i + 1], data[i + 2]);
      if (!Number.isFinite(y)) continue;
      sum += y;
      sum2 += y * y;
      n += 1;
    }
    if (!n) return { mean: 0, variance: 0, n: 0 };
    const mean = sum / n;
    return { mean, variance: Math.max(0, sum2 / n - mean * mean), n };
  }

  function estimateOccupied(cur, emp) {
    if (!cur || !Number.isFinite(cur.mean) || !Number.isFinite(cur.variance)) {
      return null;
    }
    if (emp && Number.isFinite(emp.mean) && Number.isFinite(emp.variance)) {
      const dMean = Math.abs(cur.mean - emp.mean);
      const dStd = Math.abs(Math.sqrt(cur.variance) - Math.sqrt(emp.variance));
      const score = dMean * EMPTY_MEAN_WEIGHT + dStd * EMPTY_STD_WEIGHT;
      return {
        occupied: score >= EMPTY_SCORE_CUTOFF,
        score,
        method: 'vs-empty-frame',
        confidence: CONF_VS_EMPTY,
      };
    }
    return {
      occupied: cur.mean < ABS_MEAN_CUTOFF || cur.variance > ABS_VAR_CUTOFF,
      score: (ABS_MEAN_CUTOFF - cur.mean) + Math.sqrt(Math.max(0, cur.variance)) / 4,
      method: 'absolute-threshold',
      confidence: CONF_ABSOLUTE,
    };
  }

  function methodConfidence(method) {
    if (method === 'vs-empty-frame') return CONF_VS_EMPTY;
    if (method === 'absolute-threshold') return CONF_ABSOLUTE;
    return 0;
  }

  return {
    luma,
    statsFromRgba,
    estimateOccupied,
    methodConfidence,
    SAMPLE_STRIDE,
    EMPTY_SCORE_CUTOFF,
    ABS_MEAN_CUTOFF,
    ABS_VAR_CUTOFF,
    CONF_VS_EMPTY,
    CONF_ABSOLUTE,
  };
});
