'use strict';

// In-memory occupancy and a single-driver assignment.
//
// Zone: the spot id's letter prefix (A-12, A12, B3-07, north/4). Bare numeric
// ids from pipeline.py ("1".."20") share zone "main" — one camera, one zone.
//
// ETA (integer seconds), a walk/drive heuristic, not a measured route:
//   40 + min(stallNumber, 40) * 2 + hops * 35
//   stallNumber is the trailing integer in the spot id (0 if there is none).
//   hops is 0 when driver.entry is omitted, equals the zone, or the zone is
//   "main" (the pipeline lot sits at the gate). Cardinal entries north / east /
//   south / west prefer rows A / B / C / D and add one hop per row step.
//   Any other entry that is not this zone adds one hop.
// A driver.zone, when set, is a hard filter (case-insensitive). No match → 409.
// Among candidates, the lowest ETA wins; equal ETA breaks by spot id.
//
// A successful assignment claims the stall (occupied) at max(now, observed+1ms)
// so the same camera timestamp cannot immediately free it. A later timestamp can.
// Status updates with ts older than the stored ts are ignored, not rejected.

const { AssignError } = require('./errors');

const ETA_BASE_SEC = 40;
const ETA_STALL_SEC = 2;
const ETA_STALL_CAP = 40;
const ETA_HOP_SEC = 35;

const ROW_ORDER = Object.freeze({
  north: Object.freeze(['a', 'b', 'c', 'd']),
  east: Object.freeze(['b', 'c', 'd', 'a']),
  south: Object.freeze(['c', 'd', 'a', 'b']),
  west: Object.freeze(['d', 'a', 'b', 'c']),
});

function zoneOf(spotId) {
  const sep = spotId.search(/[-_/.]/);
  if (sep > 0) {
    const prefix = spotId.slice(0, sep);
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(prefix)) return prefix;
  }
  const letters = /^([A-Za-z]+)\d+$/.exec(spotId);
  if (letters) return letters[1];
  return 'main';
}

function stallOf(spotId) {
  const match = /(\d+)$/.exec(spotId);
  return match ? Number(match[1]) : 0;
}

function entryHop(entry, zone) {
  if (!entry) return 0;
  const gate = entry.toLowerCase();
  const row = zone.toLowerCase();
  if (gate === row || row === 'main') return 0;
  const order = ROW_ORDER[gate];
  if (!order) return 1;
  const index = order.indexOf(row[0]);
  return index === -1 ? order.length : index;
}

function etaSeconds(spotId, zone, driver) {
  const stall = Math.min(stallOf(spotId), ETA_STALL_CAP);
  const hops = entryHop(driver && driver.entry, zone);
  return ETA_BASE_SEC + stall * ETA_STALL_SEC + hops * ETA_HOP_SEC;
}

function createService(options) {
  const now = (options && options.now) || (() => Date.now());
  const spots = new Map();

  function apply(updates) {
    const ordered = updates.map((update, index) => ({ update, index }));
    ordered.sort((a, b) => a.update.ts - b.update.ts || a.index - b.index);
    let ignored = 0;
    for (const item of ordered) {
      const update = item.update;
      const prev = spots.get(update.spotId);
      if (prev && update.ts < prev.ts) {
        ignored += 1;
        continue;
      }
      spots.set(update.spotId, {
        status: update.status,
        ts: update.ts,
        zone: zoneOf(update.spotId),
      });
    }
    return ignored;
  }

  function assign(driver) {
    const pref = driver && driver.zone ? driver.zone.toLowerCase() : null;
    const candidates = [];
    for (const [spotId, rec] of spots) {
      if (rec.status !== 'free') continue;
      if (pref && rec.zone.toLowerCase() !== pref) continue;
      candidates.push({
        spotId,
        zone: rec.zone,
        eta: etaSeconds(spotId, rec.zone, driver),
      });
    }
    if (candidates.length === 0) {
      const message = pref ? `no free spot in zone ${driver.zone}` : 'no free spot';
      throw new AssignError(409, 'NO_FREE_SPOT', message);
    }
    candidates.sort((a, b) => a.eta - b.eta || (a.spotId < b.spotId ? -1 : 1));
    const chosen = candidates[0];
    const prev = spots.get(chosen.spotId);
    spots.set(chosen.spotId, {
      status: 'occupied',
      ts: Math.max(now(), prev.ts + 1),
      zone: prev.zone,
    });
    return { zone: chosen.zone, spot: chosen.spotId, eta: chosen.eta };
  }

  function ingestAndAssign(updates, driver) {
    apply(updates);
    return assign(driver);
  }

  function snapshot() {
    const out = {};
    for (const [id, rec] of spots) {
      out[id] = { status: rec.status, ts: rec.ts, zone: rec.zone };
    }
    return out;
  }

  return { apply, assign, ingestAndAssign, snapshot };
}

module.exports = {
  createService,
  zoneOf,
  etaSeconds,
  ETA_BASE_SEC,
  ETA_STALL_SEC,
  ETA_STALL_CAP,
  ETA_HOP_SEC,
};
