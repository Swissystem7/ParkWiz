'use strict';

// Vercel Node.js serverless function: POST /api/assign
//
// State lives in this module's service, so it survives across warm invocations
// of the same instance and nowhere else. No database, no environment secrets.
// GitHub Pages does not run this file; it only serves the static site.

const { createService } = require('../src/lib/occupancy-assign/assign');
const { parseBody } = require('../src/lib/occupancy-assign/adapter');
const { AssignError } = require('../src/lib/occupancy-assign/errors');

const MAX_BODY = 512 * 1024;

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});

function createHandler(service) {
  const occupancy = service || createService();

  return async function handler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      writeJson(res, 204, null);
      return;
    }
    if (method !== 'POST') {
      writeJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'use POST' });
      return;
    }
    try {
      const { updates, driver } = parseBody(await readJson(req));
      writeJson(res, 200, occupancy.ingestAndAssign(updates, driver));
    } catch (err) {
      if (err instanceof AssignError) {
        writeJson(res, err.status, { error: err.code, message: err.message });
        return;
      }
      if (err instanceof SyntaxError) {
        writeJson(res, 400, { error: 'BAD_JSON', message: 'body is not valid JSON' });
        return;
      }
      console.error('[parkwiz] assign failed');
      writeJson(res, 500, { error: 'INTERNAL', message: 'internal error' });
    }
  };
}

function writeJson(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  if (status === 405) res.setHeader('allow', 'POST, OPTIONS');
  if (body == null) {
    res.end();
    return;
  }
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const body = req.body;
  if (Buffer.isBuffer(body)) return parseText(body.toString('utf8'));
  if (typeof body === 'string') return parseText(body);
  if (body != null && typeof body === 'object') return body;
  if (body != null) throw new AssignError(400, 'BAD_JSON', 'body is not valid JSON');
  return parseText(await readRaw(req));
}

function parseText(text) {
  if (text.length > MAX_BODY) throw new AssignError(413, 'TOO_LARGE', 'body too large');
  if (!text) throw new AssignError(400, 'BAD_JSON', 'body is not valid JSON');
  return JSON.parse(text);
}

function readRaw(req) {
  if (typeof req.on !== 'function') return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += buf.length;
      if (size > MAX_BODY) {
        fail(new AssignError(413, 'TOO_LARGE', 'body too large'));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', fail);
  });
}

const handler = createHandler();
handler.createHandler = createHandler;
module.exports = handler;
