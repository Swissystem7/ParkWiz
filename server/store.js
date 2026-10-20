// ParkWiz — shared server-side state for several users at once (#337).
//
// One store holds users, lots, spots and the occupancy event log. Every
// mutation is a synchronous function, so on a single-threaded runtime (one
// Node process, or one Cloudflare Durable Object per deployment) no two
// requests can interleave inside it. That is the whole concurrency story:
//   * every change bumps the lot's `version`; viewers poll `?since=<version>`
//     and all of them converge on the same snapshot;
//   * a manager may pass `ifVersion` to refuse a write based on a stale view;
//   * "spot freed -> driver alerted" is a compare-and-set claim: the first
//     driver gets the spot, every other one gets 409 CLAIMED.
// Privacy as in src/lib/spot-freed.js: events are {lot, spotId, at, kind}, and
// a viewer only learns whether a spot is claimed by *them* or by someone else.
'use strict';
const crypto = require('node:crypto');

const ROLES = ['driver', 'manager'];
const EVENT_LIMIT = 200;
const ERROR_LIMIT = 50;
const CLAIM_TTL_MS = 10 * 60 * 1000;
const MAX_SPOTS = 500;

class StoreError extends Error {
  constructor(status, code, message) {
    super(message || code);
    Object.assign(this, { status, code });
  }
}

const fail = (status, code, message) => { throw new StoreError(status, code, message); };

function cleanText(value, max) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function createStore(options) {
  const opts = options || {};
  const now = typeof opts.now === 'function' ? opts.now : Date.now;
  const newId = typeof opts.newId === 'function' ? opts.newId : () => crypto.randomUUID();
  const state = { users: {}, sessions: {}, lots: {}, seq: 0 };
  const errors = [];
  const startedAt = now();
  let onChange = null;
  const changed = () => onChange && onChange();

  function createSession(name, role) {
    const r = String(role || '');
    if (!ROLES.includes(r)) fail(400, 'BAD_ROLE', 'role must be driver or manager');
    const n = cleanText(name, 40);
    if (!n) fail(400, 'BAD_NAME', 'name is required');
    const user = { id: newId(), name: n, role: r, createdAt: now() };
    const token = newId() + newId().replace(/-/g, '');
    state.users[user.id] = user;
    state.sessions[token] = user.id;
    changed();
    return { token, user: Object.assign({}, user) };
  }

  function userForToken(token) {
    const id = token ? state.sessions[token] : undefined;
    const user = id ? state.users[id] : undefined;
    if (!user) fail(401, 'NO_SESSION', 'missing or unknown session token');
    return user;
  }

  const lotOrFail = (lotId) => state.lots[lotId] || fail(404, 'NO_LOT', 'unknown lot');

  function pushEvent(lot, kind, spotId) {
    lot.version += 1;
    state.seq += 1;
    lot.events.push({ v: lot.version, kind, lot: lot.id, spotId, at: now() });
    if (lot.events.length > EVENT_LIMIT) lot.events.splice(0, lot.events.length - EVENT_LIMIT);
  }

  // A claim lapses when its driver never arrives, so a no-show does not hide
  // a free bay from everyone else forever.
  function expireClaims(lot) {
    const t = now();
    for (const spot of Object.values(lot.spots)) {
      if (spot.claim && spot.claim.until <= t) {
        spot.claim = null;
        pushEvent(lot, 'claim-expired', spot.id);
        changed();
      }
    }
  }

  function createLot(user, input) {
    if (user.role !== 'manager') fail(403, 'NOT_MANAGER', 'only a lot manager can create a lot');
    const body = input || {};
    const name = cleanText(body.name, 80);
    if (!name) fail(400, 'BAD_NAME', 'lot name is required');
    const list = Array.isArray(body.spots) ? body.spots : [];
    if (list.length === 0 || list.length > MAX_SPOTS) fail(400, 'BAD_SPOTS', `1..${MAX_SPOTS} spots required`);
    const spots = {};
    for (const raw of list) {
      const id = cleanText(raw && typeof raw === 'object' ? raw.id : raw, 20);
      if (!id || spots[id]) fail(400, 'BAD_SPOTS', 'spot ids must be unique and non-empty');
      const type = cleanText(raw && raw.type, 20) || 'visitor';
      spots[id] = { id, type, occupied: Boolean(raw && raw.occupied), claim: null };
    }
    const lot = { id: newId(), name, ownerId: user.id, version: 0, spots, events: [] };
    state.lots[lot.id] = lot;
    pushEvent(lot, 'created', null);
    changed();
    return viewLot(user, lot.id);
  }

  function listLots() {
    return Object.values(state.lots).map((lot) => {
      const spots = Object.values(lot.spots);
      return { id: lot.id, name: lot.name, version: lot.version, total: spots.length,
        free: spots.filter((s) => !s.occupied).length };
    });
  }

  function viewSpot(user, spot) {
    let claim = null;
    if (spot.claim) claim = spot.claim.userId === user.id ? 'me' : 'other';
    return { id: spot.id, type: spot.type, occupied: spot.occupied, claim };
  }

  // `since` lets a poller ask only for what it missed. The spot list is always
  // complete, so a client that fell behind the bounded log still converges.
  function viewLot(user, lotId, since) {
    const lot = lotOrFail(lotId);
    expireClaims(lot);
    const after = Number.isFinite(Number(since)) ? Number(since) : -1;
    return { id: lot.id, name: lot.name, version: lot.version, mine: lot.ownerId === user.id,
      spots: Object.values(lot.spots).map((s) => viewSpot(user, s)),
      events: lot.events.filter((e) => e.v > after) };
  }

  function setOccupied(user, lotId, spotId, input) {
    const lot = lotOrFail(lotId);
    if (lot.ownerId !== user.id) fail(403, 'NOT_OWNER', 'only this lot\'s manager can report occupancy');
    const body = input || {};
    if (body.ifVersion !== undefined && Number(body.ifVersion) !== lot.version) {
      fail(409, 'STALE_VERSION', `lot is at version ${lot.version}`);
    }
    const spot = lot.spots[spotId];
    if (!spot) fail(404, 'NO_SPOT', 'unknown spot');
    const occupied = Boolean(body.occupied);
    if (spot.occupied === occupied) return viewLot(user, lotId);
    spot.occupied = occupied;
    // Somebody parked: whoever was heading there loses the claim, and their
    // next poll shows the spot as occupied rather than "yours".
    if (occupied) spot.claim = null;
    pushEvent(lot, occupied ? 'occupied' : 'freed', spot.id);
    changed();
    return viewLot(user, lotId);
  }

  function claimSpot(user, lotId, spotId) {
    if (user.role !== 'driver') fail(403, 'NOT_DRIVER', 'only a driver can claim a spot');
    const lot = lotOrFail(lotId);
    expireClaims(lot);
    const spot = lot.spots[spotId];
    if (!spot) fail(404, 'NO_SPOT', 'unknown spot');
    if (spot.occupied) fail(409, 'OCCUPIED', 'spot is occupied');
    if (spot.claim && spot.claim.userId !== user.id) fail(409, 'CLAIMED', 'another driver is on the way');
    for (const other of Object.values(lot.spots)) {
      if (other !== spot && other.claim && other.claim.userId === user.id) {
        other.claim = null;
        pushEvent(lot, 'released', other.id);
      }
    }
    spot.claim = { userId: user.id, until: now() + CLAIM_TTL_MS };
    pushEvent(lot, 'claimed', spot.id);
    changed();
    return { lot: lot.id, spotId: spot.id, until: spot.claim.until };
  }

  // Per-user data: a driver sees only their own claims, never anyone else's.
  function myClaims(user) {
    const out = [];
    for (const lot of Object.values(state.lots)) {
      expireClaims(lot);
      for (const spot of Object.values(lot.spots)) {
        if (spot.claim && spot.claim.userId === user.id) {
          out.push({ lot: lot.id, lotName: lot.name, spotId: spot.id, until: spot.claim.until });
        }
      }
    }
    return out;
  }

  // The ring /health shows; console logging is the runtime adapter's job.
  function recordError(err, where) {
    errors.push({ at: now(), where: String(where || ''), message: String((err && err.message) || err) });
    if (errors.length > ERROR_LIMIT) errors.splice(0, errors.length - ERROR_LIMIT);
  }

  function health() {
    const lots = Object.values(state.lots);
    return { ok: true, uptimeMs: now() - startedAt, users: Object.keys(state.users).length, lots: lots.length,
      spots: lots.reduce((n, l) => n + Object.keys(l.spots).length, 0), events: state.seq,
      recentErrors: errors.slice(-10) };
  }

  const toJSON = () => JSON.parse(JSON.stringify(state));

  function load(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const key of ['users', 'sessions', 'lots']) if (saved[key] && typeof saved[key] === 'object') state[key] = saved[key];
    state.seq = Number(saved.seq) || 0;
  }

  return {
    createSession, userForToken, createLot, listLots, viewLot, setOccupied, claimSpot,
    myClaims, recordError, health, toJSON, load,
    onChange: (fn) => { onChange = typeof fn === 'function' ? fn : null; },
  };
}

module.exports = { createStore, StoreError, ROLES, CLAIM_TTL_MS, EVENT_LIMIT };
