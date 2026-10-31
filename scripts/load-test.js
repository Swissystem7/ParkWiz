// ParkWiz — smoke + load test: 20 concurrent users on the shared backend (#337).
//
//   node scripts/load-test.js                       starts its own server
//   BASE_URL=http://host:8787 node scripts/load-test.js   hits a running one
//
// 2 managers flip spots, 18 drivers poll and race to claim. Exit 1 on any 5xx,
// a burst without exactly one winner, a double claim, or viewers that disagree.
'use strict';
const { startServer } = require('../server/node');

const MANAGERS = 2;
const DRIVERS = 18;
const SPOTS = 10;
const DURATION_MS = Number(process.env.LOAD_MS) || 4000;
const latencies = [];
const failures = [];

function makeClient(base) {
  return async function call(method, path, body, token) {
    const t0 = performance.now();
    const res = await fetch(base + path, {
      method,
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: `Bearer ${token}` } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    latencies.push(performance.now() - t0);
    const data = await res.json().catch(() => null);
    if (res.status >= 500) failures.push(`${method} ${path} -> ${res.status}`);
    return { status: res.status, data };
  };
}

async function main() {
  const own = process.env.BASE_URL ? null : await startServer({ port: 0 });
  const base = process.env.BASE_URL || own.url;
  const call = makeClient(base);

  const health = await call('GET', '/health');
  if (health.status !== 200 || !health.data.ok) failures.push('health check failed');

  const session = async (name, role) => (await call('POST', '/api/session', { name, role })).data.token;
  const managers = await Promise.all(Array.from({ length: MANAGERS }, (_, i) => session(`מנהל ${i + 1}`, 'manager')));
  const drivers = await Promise.all(Array.from({ length: DRIVERS }, (_, i) => session(`נהג ${i + 1}`, 'driver')));
  const lots = await Promise.all(managers.map(async (token, i) => {
    const spots = Array.from({ length: SPOTS }, (_, n) => ({ id: `S${n + 1}`, occupied: true }));
    return (await call('POST', '/api/lots', { name: `חניון בדיקה ${i + 1}`, spots }, token)).data.id;
  }));
  const lotOf = (i) => lots[i % lots.length];

  // Burst: free one spot, then every driver of that lot claims it at once.
  for (let round = 0; round < 5; round++) {
    const lot = lotOf(round);
    const spot = `S${round + 1}`;
    await call('POST', `/api/lots/${lot}/spots/${spot}`, { occupied: false }, managers[round % MANAGERS]);
    const racers = drivers.filter((_, i) => lotOf(i) === lot);
    const results = await Promise.all(racers.map((t) => call('POST', `/api/lots/${lot}/spots/${spot}/claim`, undefined, t)));
    const winners = results.filter((r) => r.status === 200).length;
    const losers = results.filter((r) => r.status === 409).length;
    if (winners !== 1 || losers !== racers.length - 1) {
      failures.push(`burst ${round}: ${winners} winners, ${losers} conflicts of ${racers.length}`);
    }
  }

  // Mixed traffic for DURATION_MS: managers flip, drivers poll + claim.
  const stopAt = Date.now() + DURATION_MS;
  const manager = async (token, i) => {
    while (Date.now() < stopAt) {
      const spot = `S${1 + Math.floor(Math.random() * SPOTS)}`;
      await call('POST', `/api/lots/${lots[i]}/spots/${spot}`, { occupied: Math.random() < 0.5 }, token);
    }
  };
  const driver = async (token, i) => {
    let since = -1;
    while (Date.now() < stopAt) {
      const view = (await call('GET', `/api/lots/${lotOf(i)}?since=${since}`, undefined, token)).data;
      if (!view || !Array.isArray(view.spots)) continue;
      since = view.version;
      const target = view.spots.find((s) => !s.occupied && !s.claim);
      if (target) await call('POST', `/api/lots/${lotOf(i)}/spots/${target.id}/claim`, undefined, token);
    }
  };
  await Promise.all([...managers.map(manager), ...drivers.map(driver)]);

  // Invariant: no spot is held by two drivers.
  const holders = {};
  for (const token of drivers) {
    const me = (await call('GET', '/api/me', undefined, token)).data;
    for (const c of me.claims) {
      const key = `${c.lot}/${c.spotId}`;
      if (holders[key]) failures.push(`spot ${key} claimed by two drivers`);
      holders[key] = true;
    }
    if (me.claims.length > 1) failures.push(`driver ${me.user.name} holds ${me.claims.length} claims`);
  }

  // Invariant: once writes stop, every viewer sees the same lot.
  for (const lot of lots) {
    const views = await Promise.all(drivers.map((t) => call('GET', `/api/lots/${lot}?since=999999`, undefined, t)));
    const shapes = new Set(views.map((v) => `${v.data.version}|${v.data.spots.map((s) => +s.occupied + (s.claim ? 'c' : '')).join('')}`));
    if (shapes.size !== 1) failures.push(`lot ${lot}: viewers disagree (${shapes.size} different views)`);
  }

  latencies.sort((a, b) => a - b);
  const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))].toFixed(1);
  console.log(`[load] ${MANAGERS + DRIVERS} users, ${latencies.length} requests, p50 ${p(0.5)}ms, p95 ${p(0.95)}ms, max ${p(1)}ms`);
  if (own) await own.close();
  if (failures.length) throw new Error('FAIL\n  ' + failures.slice(0, 20).join('\n  '));
  console.log('[load] OK — no 5xx, one winner per burst, no double claims, viewers consistent');
}

main().catch((err) => {
  console.error('[load]', err.message || err);
  process.exit(1);
});
