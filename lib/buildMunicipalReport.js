function buildMunicipalReport(history, opts) {
  if (!Array.isArray(history)) throw new TypeError('history must be an array');
  if (!opts || !Number.isFinite(opts.periodStart) || !Number.isFinite(opts.periodEnd)) throw new TypeError('missing period');
  const { periodStart, periodEnd } = opts;
  if (periodEnd <= periodStart || history.length === 0) return { zones: {}, headline: [], generatedAt: periodEnd };
  const peak = opts.peakHours || [9, 11], illegal = new Set(opts.illegalDeliveryZones || []);
  const states = new Map(), totals = new Map();
  const add = (state, end) => {
    const start = Math.max(state.ts, periodStart), stop = Math.min(end, periodEnd);
    if (stop <= start) return;
    const z = totals.get(state.zone) || { occupied: 0, delivery: 0, illegal: 0, peakOccupied: 0, peakTotal: 0, total: 0 };
    z.total += stop - start;
    if (state.occupied) {
      z.occupied += stop - start;
      if (state.vehicleType === 'delivery') {
        z.delivery += stop - start;
        if (illegal.has(state.zone)) z.illegal += stop - start;
      }
    }
    for (let day = Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), new Date(start).getUTCDate()); day < stop; day += 86400000) {
      const a = Math.max(start, day + peak[0] * 3600000), b = Math.min(stop, day + peak[1] * 3600000);
      if (b > a) { z.peakTotal += b - a; if (state.occupied) z.peakOccupied += b - a; }
    }
    totals.set(state.zone, z);
  };
  const sorted = history.map((r, i) => ({ ...r, i })).sort((a, b) => a.ts - b.ts || a.i - b.i);
  for (const r of sorted) {
    if (!Number.isFinite(r.ts) || typeof r.spotId !== 'string' || typeof r.zone !== 'string' || typeof r.occupied !== 'boolean') continue;
    const previous = states.get(r.spotId);
    if (previous) add(previous, r.ts);
    states.set(r.spotId, { ...r, ts: Math.max(r.ts, periodStart) });
  }
  for (const state of states.values()) add(state, periodEnd);
  const round = n => Math.round(n * 1000) / 1000, zones = {}, headline = [];
  for (const [zone, z] of totals) {
    const peakOccupancyRate = z.peakTotal ? round(z.peakOccupied / z.peakTotal) : 0;
    zones[zone] = { avgOccupancyRate: z.total ? round(z.occupied / z.total) : 0, peakOccupancyRate, deliveryShare: z.occupied ? round(z.delivery / z.occupied) : 0, illegalDeliveryMinutes: Math.round(z.illegal / 60000) };
    if (peakOccupancyRate > 0) headline.push(`בין ${peak[0]}:00-${peak[1]}:00, ${Math.round(peakOccupancyRate * 100)}% מהחניה באזור ${zone} הייתה תפוסה`);
  }
  return { zones, headline: headline.slice(0, 3), generatedAt: periodEnd };
}
module.exports = { buildMunicipalReport };
