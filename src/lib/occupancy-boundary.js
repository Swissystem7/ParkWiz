// ParkWiz — trustworthy occupancy boundary (memory-only, no media).
//
// The only shape that may leave a detection path: per cell { id, status, ts }
// where status is free | occupied | unknown. Fail-closed by construction:
// output objects are built field-by-field from an allowlist, so plates,
// frames, images, geometry, scores or any not-yet-invented field name can
// never pass through — unrecognized input is dropped, never forwarded.
//
// A cell is only free/occupied when its reading is fresh (age <= 60s),
// not future-dated, and confident. Stale, uncertain, low-confidence,
// missing-confidence, bad-state or bad-timestamp readings are `unknown`:
// the system must not guess free/occupied on unreliable information.
//
// Limits: this is a freshness/uncertainty/redaction contract, not a vision
// pipeline. It judges readings it is handed; it does not detect vehicles.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizOccupancyBoundary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STALE_MS = 60000;
  const DEFAULT_MIN_CONFIDENCE = 0.5;
  const STATUSES = Object.freeze(['free', 'occupied', 'unknown']);

  function parseTime(v) {
    if (v instanceof Date) { const t = v.getTime(); return Number.isFinite(t) ? t : null; }
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim()) {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    return null;
  }

  function resolveNow(opts) {
    const t = parseTime(opts && opts.now != null ? opts.now : Date.now());
    return t == null ? Date.now() : t;
  }

  function rawStatus(cell) {
    const s = cell.status != null ? cell.status : cell.state;
    if (typeof s === 'string') {
      const v = s.trim().toLowerCase();
      return STATUSES.includes(v) ? v : null;
    }
    if (cell.occupied === true) return 'occupied';
    if (cell.occupied === false) return 'free';
    return null;
  }

  function judge(cell, nowMs, minConfidence) {
    const status = rawStatus(cell);
    if (!status || status === 'unknown') return 'unknown';
    const ts = parseTime(cell.ts != null ? cell.ts : (cell.timestamp != null ? cell.timestamp : cell.observedAt));
    if (ts == null || ts > nowMs || nowMs - ts > STALE_MS) return 'unknown';
    if (cell.uncertain) return 'unknown';
    const conf = cell.confidence;
    if (typeof conf !== 'number' || !Number.isFinite(conf) || conf < minConfidence) return 'unknown';
    return status;
  }

  // One cell -> { id, status, ts } or null when it has no usable id.
  function serializeCell(cell, opts) {
    if (!cell || typeof cell !== 'object') return null;
    const id = cell.id != null ? String(cell.id).trim() : '';
    if (!id) return null;
    const nowMs = resolveNow(opts);
    const min = opts && opts.minConfidence != null ? Number(opts.minConfidence) : DEFAULT_MIN_CONFIDENCE;
    const ts = parseTime(cell.ts != null ? cell.ts : (cell.timestamp != null ? cell.timestamp : cell.observedAt));
    return { id, status: judge(cell, nowMs, min), ts: ts == null ? null : new Date(ts).toISOString() };
  }

  // Array of cells, or { cells|spots, ts|timestamp } -> { ts, cells } only.
  // Per-cell ts falls back to the snapshot ts; both are re-emitted as ISO.
  function serializeSnapshot(input, opts) {
    const nowMs = resolveNow(opts);
    const src = Array.isArray(input) ? { cells: input } : (input || {});
    const snapTs = parseTime(src.ts != null ? src.ts : src.timestamp);
    const list = Array.isArray(src.cells) ? src.cells : (Array.isArray(src.spots) ? src.spots : []);
    const cells = [];
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      const merged = { ...c };
      if (merged.ts == null && merged.timestamp == null && merged.observedAt == null && snapTs != null) {
        merged.ts = snapTs;
      }
      const out = serializeCell(merged, { ...(opts || {}), now: nowMs });
      if (out) cells.push(out);
    }
    return { ts: new Date(snapTs != null ? snapTs : nowMs).toISOString(), cells };
  }

  // Adapter for src/lib/vision-occupancy.js tracker snapshots. Confidence is
  // derived from the tracker's overlap score (geometry claim strength for an
  // occupied cell, strength-of-absence for a free one) — a heuristic score,
  // not a detector probability. A cell with fewer observations than the
  // debounce window has not earned a state yet and stays unknown.
  function fromVisionSnapshot(state, opts) {
    const o = opts || {};
    const debounce = Math.max(1, Math.round(o.debounceFrames != null ? o.debounceFrames : 3));
    const s = state || {};
    const cells = (Array.isArray(s.spots) ? s.spots : []).map((sp) => {
      const score = typeof sp.score === 'number' && Number.isFinite(sp.score) ? sp.score : 0;
      const observed = typeof sp.observations === 'number' && sp.observations >= debounce;
      return {
        id: sp.id,
        status: sp.occupied ? 'occupied' : 'free',
        ts: s.ts,
        confidence: observed ? (sp.occupied ? score : 1 - score) : 0,
      };
    });
    return serializeSnapshot({ ts: s.ts, cells }, o);
  }

  // Connector-ready aggregate over an already-serialized public snapshot.
  // Unknown cells count in total but in neither occupied nor free.
  function toCityZoneSnapshot(publicSnapshot) {
    const cells = publicSnapshot && Array.isArray(publicSnapshot.cells) ? publicSnapshot.cells : [];
    return {
      total: cells.length,
      occupied: cells.filter((c) => c.status === 'occupied').length,
      free: cells.filter((c) => c.status === 'free').length,
      timestamp: publicSnapshot && publicSnapshot.ts ? publicSnapshot.ts : undefined,
      spots: cells.map((c) => ({ id: c.id, state: c.status, ts: c.ts })),
    };
  }

  return { STALE_MS, DEFAULT_MIN_CONFIDENCE, STATUSES, serializeCell, serializeSnapshot, fromVisionSnapshot, toCityZoneSnapshot };
});
