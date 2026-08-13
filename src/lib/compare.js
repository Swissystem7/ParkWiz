// ParkWiz — paired heuristic vs inspector counts (the 30-day pilot metric).
//
// One pair is one timestamped observation: system/heuristic occupied count
// versus a human inspector count of the same marked spots. Accuracy is
// 1 − |sys − man| / total — the same formula as occupancy.inspectorAccuracy.
// A single last-row score is not a pilot result; a series of pairs is.
(function (root, factory) {
  const occ = (typeof module === 'object' && module.exports)
    ? require('./occupancy')
    : root.ParkWizOccupancy;
  const api = factory(occ);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizCompare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (occ) {
  function pairObservation(input) {
    if (!input || typeof input !== 'object') return null;
    const total = Number(input.total);
    const sys = Number(input.systemOccupied != null ? input.systemOccupied : input.occupied);
    const man = Number(input.manualOccupied);
    const accuracy = occ.inspectorAccuracy(sys, man, total);
    if (accuracy == null) return null;
    const t = total;
    return {
      ts: input.ts != null ? String(input.ts) : '',
      street: input.street != null ? String(input.street) : '—',
      total: t,
      systemOccupied: Math.max(0, Math.min(t, sys)),
      manualOccupied: Math.max(0, Math.min(t, man)),
      accuracy,
      note: input.note != null ? String(input.note) : '',
      source: input.source != null ? String(input.source) : 'paired',
    };
  }

  function pairFromOccupancy(record, manualOccupied, note) {
    if (!record) return null;
    return pairObservation({
      ts: record.ts,
      street: record.street,
      total: record.total,
      systemOccupied: record.occupied,
      manualOccupied,
      note,
      source: record.source || 'paired',
    });
  }

  function parsePairs(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    let list = [];
    if (raw[0] === '[') {
      try {
        const a = JSON.parse(raw);
        if (Array.isArray(a)) list = a;
      } catch (e) { return []; }
    } else {
      for (const line of raw.split(/\r?\n/)) {
        const s = line.trim();
        if (!s) continue;
        try { list.push(JSON.parse(s)); } catch (e) { /* skip */ }
      }
    }
    return list.map(pairObservation).filter(Boolean)
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  }

  function summarizePairs(pairs) {
    const list = Array.isArray(pairs) ? pairs.filter((p) => p && Number.isFinite(p.accuracy)) : [];
    if (!list.length) {
      return {
        count: 0,
        meanAccuracy: null,
        minAccuracy: null,
        maxAccuracy: null,
        meanAbsError: null,
        perfect: 0,
        sampleOnly: false,
      };
    }
    let sum = 0;
    let err = 0;
    let min = 1;
    let max = 0;
    let perfect = 0;
    let sample = 0;
    list.forEach((p) => {
      sum += p.accuracy;
      err += Math.abs(p.systemOccupied - p.manualOccupied);
      if (p.accuracy < min) min = p.accuracy;
      if (p.accuracy > max) max = p.accuracy;
      if (p.accuracy === 1) perfect += 1;
      if (p.source === 'sample') sample += 1;
    });
    return {
      count: list.length,
      meanAccuracy: sum / list.length,
      minAccuracy: min,
      maxAccuracy: max,
      meanAbsError: err / list.length,
      perfect,
      sampleOnly: sample === list.length,
    };
  }

  function loadStoredPairs() {
    try {
      const raw = localStorage.getItem(occ.LS.pairs);
      return raw ? parsePairs(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function savePairs(list) {
    try {
      localStorage.setItem(occ.LS.pairs, JSON.stringify(list || []));
    } catch (e) { /* quota / private mode */ }
  }

  return {
    pairObservation,
    pairFromOccupancy,
    parsePairs,
    summarizePairs,
    loadStoredPairs,
    savePairs,
  };
});
