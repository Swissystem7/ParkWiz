function debounceOccupancy(readings, opts = {}) {
  if (!Array.isArray(readings)) throw new TypeError("readings must be an array");
  const holdMs = opts.holdMs !== undefined ? opts.holdMs : 30000;
  if (typeof holdMs !== "number" || holdMs <= 0) throw new TypeError("holdMs must be a positive number");
  const sorted = readings.map((r, i) => ({ ...r, i })).sort((a, b) => a.ts - b.ts || a.i - b.i);
  const byKey = new Map();
  for (const r of sorted) byKey.set(`${r.spotId}\0${r.ts}`, r);
  const deduped = [...byKey.values()].sort((a, b) => a.ts - b.ts || a.i - b.i);
  const stable = {};
  const transitions = [];
  let discardedFlickers = 0;
  const pending = {};
  for (const r of deduped) {
    const { spotId, occupied, ts } = r;
    if (!stable[spotId]) {
      stable[spotId] = { occupied, since: ts };
      transitions.push({ spotId, occupied, at: ts });
      continue;
    }
    const cur = stable[spotId];
    if (occupied === cur.occupied) {
      if (pending[spotId]) {
        delete pending[spotId];
      }
      continue;
    }
    if (!pending[spotId]) {
      pending[spotId] = { occupied, ts, startTs: ts };
    } else {
      const p = pending[spotId];
      if (occupied === p.occupied) {
        if (ts - p.startTs >= holdMs) {
          stable[spotId] = { occupied, since: p.startTs };
          transitions.push({ spotId, occupied, at: p.startTs });
          delete pending[spotId];
        }
      } else {
        discardedFlickers++;
        delete pending[spotId];
      }
    }
  }
  for (const spotId in pending) {
    discardedFlickers++;
  }
  return { stable, transitions, discardedFlickers };
}
module.exports = { debounceOccupancy };
