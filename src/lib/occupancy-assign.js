'use strict';

// Defensive front door for the occupancy-assign service: validates loosely
// shaped input (missing lot id, empty stalls, non-numeric values) and returns
// a result object instead of throwing.

const { parseBody } = require('./occupancy-assign/adapter');
const { createService } = require('./occupancy-assign/assign');

function fail(status, code, message) {
  return { ok: false, status, error: code, message };
}

function normalizeLotId(lotId) {
  if (typeof lotId === 'number' && Number.isFinite(lotId)) return String(lotId);
  if (typeof lotId !== 'string') return null;
  const trimmed = lotId.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeEta(value) {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

function safeAssign(service, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail(400, 'BAD_BODY', 'body must be an object');
  }
  const lotId = normalizeLotId(input.lotId);
  if (lotId === null) return fail(400, 'MISSING_LOT_ID', 'lotId is required');
  if (!Array.isArray(input.stalls) || input.stalls.length === 0) {
    return fail(400, 'EMPTY_STALLS', 'stalls must be a non-empty array');
  }
  for (const stall of input.stalls) {
    if (!stall || typeof stall !== 'object' || normalizeEta(Date.parse(stall.ts)) === null) {
      return fail(400, 'BAD_STALL', 'each stall needs spot_id, status and a valid ts');
    }
  }
  try {
    const parsed = parseBody({ spots: input.stalls, driver: input.driver });
    const svc = service || createService();
    return { ok: true, lotId, result: svc.ingestAndAssign(parsed.updates, parsed.driver) };
  } catch (err) {
    if (err && typeof err.status === 'number' && typeof err.code === 'string') {
      return fail(err.status, err.code, err.message);
    }
    return fail(500, 'INTERNAL', 'unexpected failure');
  }
}

module.exports = { safeAssign, normalizeLotId, normalizeEta };
