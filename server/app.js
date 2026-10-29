// ParkWiz — HTTP API over the shared store (#337).
//
// Written against the standard Fetch API (Request -> Response) so the same
// handler runs under Node 18+ (server/node.js) and, later, inside a Cloudflare
// Worker / Durable Object without a rewrite. No framework, no dependencies.
//
//   GET  /health                               liveness + counters + last errors
//   POST /api/session        {name, role}      -> {token, user}
//   GET  /api/me                               -> {user, claims}
//   GET  /api/lots                             -> [{id, name, version, total, free}]
//   POST /api/lots           {name, spots}     manager only
//   GET  /api/lots/:id?since=<version>         snapshot + events after version
//   POST /api/lots/:id/spots/:spot  {occupied, ifVersion?}   owning manager only
//   POST /api/lots/:id/spots/:spot/claim       driver only, first claim wins
'use strict';
const { StoreError } = require('./store');

const MAX_BODY = 64 * 1024;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new StoreError(413, 'TOO_LARGE', 'body too large');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new StoreError(400, 'BAD_JSON', 'body is not valid JSON');
  }
}

function tokenOf(request) {
  const auth = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  return m ? m[1] : '';
}

function createApp(store) {
  async function route(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (method === 'GET' && url.pathname === '/health') return json(200, store.health());
    if (parts[0] !== 'api') return null;

    if (method === 'POST' && parts.length === 2 && parts[1] === 'session') {
      const body = await readBody(request);
      return json(201, store.createSession(body.name, body.role));
    }

    const user = store.userForToken(tokenOf(request));
    if (method === 'GET' && parts.length === 2 && parts[1] === 'me') {
      return json(200, { user, claims: store.myClaims(user) });
    }
    if (parts[1] !== 'lots') return json(404, { error: 'NOT_FOUND' });
    if (parts.length === 2) {
      if (method === 'GET') return json(200, store.listLots());
      if (method === 'POST') return json(201, store.createLot(user, await readBody(request)));
    }
    if (parts.length === 3 && method === 'GET') {
      return json(200, store.viewLot(user, parts[2], url.searchParams.get('since')));
    }
    if (parts.length === 5 && parts[3] === 'spots' && method === 'POST') {
      return json(200, store.setOccupied(user, parts[2], parts[4], await readBody(request)));
    }
    if (parts.length === 6 && parts[3] === 'spots' && parts[5] === 'claim' && method === 'POST') {
      return json(200, store.claimSpot(user, parts[2], parts[4]));
    }
    return json(404, { error: 'NOT_FOUND' });
  }

  // Expected refusals (bad input, conflict, no session) are answers, not
  // errors. Anything else is a bug: log it, keep it for /health, return 500
  // without leaking the stack to the client.
  async function handle(request) {
    try {
      return await route(request);
    } catch (err) {
      if (err instanceof StoreError) return json(err.status, { error: err.code, message: err.message });
      store.recordError(err, `${request.method} ${new URL(request.url).pathname}`);
      console.error('[parkwiz] unhandled', err);
      return json(500, { error: 'INTERNAL' });
    }
  }

  return { handle };
}

module.exports = { createApp };
