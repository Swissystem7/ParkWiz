function occupancyHeatmap(reports, opts) {
  if (!Array.isArray(reports)) throw new TypeError("reports must be an array");
  if (!opts || !Number.isFinite(opts.now)) throw new TypeError("opts.now is required");
  const cellSizeDeg = (opts.cellSizeDeg && opts.cellSizeDeg > 0) ? opts.cellSizeDeg : 0.001;
  const halfLifeMin = (opts.halfLifeMin && opts.halfLifeMin > 0) ? opts.halfLifeMin : 60;
  const now = opts.now;
  const halfLifeMs = halfLifeMin * 60000;
  const cells = {};
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    if (typeof r.lat !== 'number' || !isFinite(r.lat) || typeof r.lng !== 'number' || !isFinite(r.lng)) continue;
    if (!Number.isFinite(r.ts) || r.ts > now || !['free', 'taken'].includes(r.status)) continue;
    const latIdx = Math.floor(r.lat / cellSizeDeg);
    const lngIdx = Math.floor(r.lng / cellSizeDeg);
    const key = latIdx + ':' + lngIdx;
    const weight = Math.pow(0.5, (now - r.ts) / halfLifeMs);
    if (!cells[key]) cells[key] = { free: 0, taken: 0, samples: 0 };
    if (r.status === 'free') cells[key].free += weight;
    else if (r.status === 'taken') cells[key].taken += weight;
    cells[key].samples++;
  }
  const resultCells = {};
  for (const key in cells) {
    const c = cells[key];
    const total = c.free + c.taken;
    if (total < 0.05) {
      resultCells[key] = { score: null, samples: c.samples };
    } else {
      resultCells[key] = { score: c.free / total, samples: c.samples };
    }
  }
  return { cells: resultCells, generatedAt: now };
}
module.exports = { occupancyHeatmap };
