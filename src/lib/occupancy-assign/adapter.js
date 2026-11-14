'use strict';

// The only parser for POST /api/assign. Two inputs collapse to the same
// internal list of { spotId, status, ts } plus an optional driver preference:
//
//   1. Simple observations: { spot_id, status: 'free'|'occupied', ts } with ts
//      an ISO-8601 timestamp. A bare array, or { spots, driver? }.
//   2. Lenovo pipeline.py frames (pipeline_out.json): an array of per-frame
//      records, or one record, or { frames, driver? }. Time is taken from the
//      image filename (YYYY-MM-DD_HH_MM_SS.jpg) and read as UTC. occupied/free
//      are arrays of spot-id strings. assignment, unassigned, and ms are
//      ignored — this service decides the spot, it does not replay theirs.
//
// When pipeline.py changes field names, change this file only.

const { AssignError } = require('./errors');

const MAX_UPDATES = 10000;
const SPOT_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;
const ISO_TS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const FRAME_NAME = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})(\.[A-Za-z0-9]+)?$/;

function fail(code, message) {
  throw new AssignError(400, code, message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function wallClockIsReal(year, month, day, hour, minute, second) {
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return dt.getUTCFullYear() === year
    && dt.getUTCMonth() === month - 1
    && dt.getUTCDate() === day
    && dt.getUTCHours() === hour
    && dt.getUTCMinutes() === minute
    && dt.getUTCSeconds() === second;
}

function parseIsoTs(value, where) {
  if (typeof value !== 'string') fail('BAD_TS', `${where} must be an ISO-8601 timestamp`);
  const match = ISO_TS.exec(value);
  if (!match) fail('BAD_TS', `${where} must be an ISO-8601 timestamp`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (!wallClockIsReal(year, month, day, hour, minute, second)) {
    fail('BAD_TS', `${where} is not a real timestamp`);
  }
  if (match[8] !== 'Z') {
    const offHour = Number(match[8].slice(1, 3));
    const offMin = Number(match[8].slice(4, 6));
    if (offHour > 23 || offMin > 59) fail('BAD_TS', `${where} has an invalid offset`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail('BAD_TS', `${where} is not a real timestamp`);
  return ms;
}

// Filename clock → UTC milliseconds. 2012-12-20_10_00_04.jpg → 2012-12-20T10:00:04.000Z.
function tsFromFrameName(name, where) {
  if (typeof name !== 'string') fail('BAD_FRAME', `${where}.frame must be a filename`);
  const match = FRAME_NAME.exec(name);
  if (!match) fail('BAD_FRAME', `${where}.frame must be YYYY-MM-DD_HH_MM_SS.jpg`);
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`;
  try {
    return parseIsoTs(iso, `${where}.frame`);
  } catch (err) {
    if (err instanceof AssignError) fail('BAD_FRAME', `${where}.frame is not a real timestamp`);
    throw err;
  }
}

function spotIdOf(value, where) {
  if (typeof value !== 'string' || !SPOT_ID.test(value)) {
    fail('BAD_SPOT', `${where} must be a spot id string`);
  }
  return value;
}

function parseDriver(raw) {
  if (raw == null) return { entry: null, zone: null };
  if (!isObject(raw)) fail('BAD_DRIVER', 'driver must be an object');
  const driver = { entry: null, zone: null };
  for (const key of ['entry', 'zone']) {
    if (raw[key] == null || raw[key] === '') continue;
    if (typeof raw[key] !== 'string' || !raw[key].trim() || raw[key].trim().length > 64) {
      fail('BAD_DRIVER', `driver.${key} must be a short string`);
    }
    driver[key] = raw[key].trim();
  }
  return driver;
}

function looksLikePipeline(item) {
  return isObject(item)
    && typeof item.frame === 'string'
    && (Array.isArray(item.occupied) || Array.isArray(item.free));
}

function looksLikeSimple(item) {
  return isObject(item) && typeof item.spot_id === 'string' && typeof item.status === 'string';
}

function parseSimpleSpot(item, where) {
  if (!isObject(item)) fail('BAD_SPOT', `${where} must be an object`);
  const spotId = spotIdOf(item.spot_id, `${where}.spot_id`);
  if (item.status !== 'free' && item.status !== 'occupied') {
    fail('BAD_STATUS', `${where}.status must be "free" or "occupied"`);
  }
  return { spotId, status: item.status, ts: parseIsoTs(item.ts, `${where}.ts`) };
}

function parseIdList(list, where) {
  if (!Array.isArray(list)) fail('BAD_SPOT', `${where} must be an array of spot id strings`);
  return list.map((id, index) => spotIdOf(id, `${where}[${index}]`));
}

function parsePipelineFrame(item, where) {
  if (!isObject(item)) fail('BAD_FRAME', `${where} must be a pipeline frame`);
  const ts = tsFromFrameName(item.frame, where);
  const occupied = parseIdList(item.occupied, `${where}.occupied`);
  const free = parseIdList(item.free, `${where}.free`);
  const seen = new Set();
  const updates = [];
  for (const id of occupied.concat(free)) {
    if (seen.has(id)) fail('BAD_SPOT', `${where} lists spot "${id}" more than once`);
    seen.add(id);
  }
  for (const id of occupied) updates.push({ spotId: id, status: 'occupied', ts });
  for (const id of free) updates.push({ spotId: id, status: 'free', ts });
  return updates;
}

function framesToUpdates(frames, where) {
  if (frames.length > MAX_UPDATES) fail('BAD_BODY', 'too many frames');
  const updates = [];
  frames.forEach((frame, index) => {
    if (!looksLikePipeline(frame)) fail('BAD_BODY', `${where}[${index}] must be a pipeline frame`);
    updates.push(...parsePipelineFrame(frame, `${where}[${index}]`));
  });
  return updates;
}

function parseSimpleList(list, where) {
  return list.map((item, index) => {
    if (looksLikePipeline(item)) fail('BAD_BODY', `${where} mixes pipeline frames with spot records`);
    return parseSimpleSpot(item, `${where}[${index}]`);
  });
}

function finish(updates, driver) {
  if (updates.length > MAX_UPDATES) fail('BAD_BODY', 'too many spot updates');
  return { updates, driver };
}

function parseList(list, where) {
  const driver = { entry: null, zone: null };
  if (list.length === 0) return finish([], driver);
  if (looksLikePipeline(list[0])) return finish(framesToUpdates(list, where), driver);
  if (looksLikeSimple(list[0])) return finish(parseSimpleList(list, where), driver);
  fail('BAD_BODY', `${where}[0] must be a pipeline frame or a {spot_id,status,ts} record`);
}

// body is an already-parsed JSON value (object or array).
function parseBody(body) {
  if (Array.isArray(body)) return parseList(body, 'body');
  if (!isObject(body)) fail('BAD_BODY', 'body must be a JSON object or array');

  const hasSpots = Object.prototype.hasOwnProperty.call(body, 'spots');
  const hasFrames = Object.prototype.hasOwnProperty.call(body, 'frames');
  const driver = parseDriver(body.driver);
  if (hasSpots && hasFrames) fail('BAD_BODY', 'send spots or frames, not both');
  if (hasSpots) {
    if (!Array.isArray(body.spots)) fail('BAD_BODY', 'spots must be an array');
    return finish(parseSimpleList(body.spots, 'spots'), driver);
  }
  if (hasFrames) {
    if (!Array.isArray(body.frames)) fail('BAD_BODY', 'frames must be an array');
    return finish(framesToUpdates(body.frames, 'frames'), driver);
  }
  if (looksLikePipeline(body)) return finish(parsePipelineFrame(body, 'body'), driver);
  fail('BAD_BODY', 'body needs spots, frames, or a pipeline frame');
}

module.exports = { parseBody };
