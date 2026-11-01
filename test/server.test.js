const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, CLAIM_TTL_MS } = require('../server/store');
const { startServer } = require('../server/node');

function setup() {
  let t = 1000;
  const store = createStore({ now: () => t });
  const mgr = store.userForToken(store.createSession('מנהל', 'manager').token);
  const a = store.userForToken(store.createSession('נהג א', 'driver').token);
  const b = store.userForToken(store.createSession('נהג ב', 'driver').token);
  const lot = store.createLot(mgr, { name: 'חניון', spots: [{ id: 'A1', occupied: true }, { id: 'A2', occupied: true }] });
  return { store, mgr, a, b, lot, tick: (ms) => { t += ms; } };
}

test('roles: only managers create lots, only drivers claim, only the owner reports', () => {
  const { store, mgr, a, lot } = setup();
  assert.throws(() => store.createLot(a, { name: 'x', spots: ['1'] }), { code: 'NOT_MANAGER' });
  assert.throws(() => store.claimSpot(mgr, lot.id, 'A1'), { code: 'NOT_DRIVER' });
  const other = store.userForToken(store.createSession('מנהל אחר', 'manager').token);
  assert.throws(() => store.setOccupied(other, lot.id, 'A1', { occupied: false }), { code: 'NOT_OWNER' });
  assert.throws(() => store.createSession('x', 'admin'), { code: 'BAD_ROLE' });
});

test('freed spot: first claim wins, the second driver gets CLAIMED', () => {
  const { store, mgr, a, b, lot } = setup();
  assert.throws(() => store.claimSpot(a, lot.id, 'A1'), { code: 'OCCUPIED' });
  store.setOccupied(mgr, lot.id, 'A1', { occupied: false });
  store.claimSpot(a, lot.id, 'A1');
  assert.throws(() => store.claimSpot(b, lot.id, 'A1'), { code: 'CLAIMED' });
  assert.equal(store.viewLot(a, lot.id).spots[0].claim, 'me');
  assert.equal(store.viewLot(b, lot.id).spots[0].claim, 'other');
  assert.deepEqual(store.myClaims(b), []);
  assert.equal(store.myClaims(a).length, 1);
});

test('a driver holds one claim; parking or the TTL releases it', () => {
  const { store, mgr, a, b, lot, tick } = setup();
  store.setOccupied(mgr, lot.id, 'A1', { occupied: false });
  store.setOccupied(mgr, lot.id, 'A2', { occupied: false });
  store.claimSpot(a, lot.id, 'A1');
  store.claimSpot(a, lot.id, 'A2');
  assert.deepEqual(store.myClaims(a).map((c) => c.spotId), ['A2']);
  store.setOccupied(mgr, lot.id, 'A2', { occupied: true });
  assert.deepEqual(store.myClaims(a), []);
  store.claimSpot(b, lot.id, 'A1');
  tick(CLAIM_TTL_MS + 1);
  assert.deepEqual(store.myClaims(b), []);
  store.claimSpot(a, lot.id, 'A1');
});

test('versions: since returns only missed events, stale ifVersion is refused', () => {
  const { store, mgr, a, lot } = setup();
  const v0 = store.viewLot(a, lot.id).version;
  store.setOccupied(mgr, lot.id, 'A1', { occupied: false });
  const view = store.viewLot(a, lot.id, v0);
  assert.deepEqual(view.events.map((e) => [e.kind, e.spotId]), [['freed', 'A1']]);
  assert.equal(JSON.stringify(view.events).includes(a.id), false);
  assert.throws(() => store.setOccupied(mgr, lot.id, 'A2', { occupied: false, ifVersion: v0 }), { code: 'STALE_VERSION' });
});

test('HTTP: health, session, 401 without token, data survives a restart', async () => {
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parkwiz-')), 'data.json');
  const srv = await startServer({ port: 0, dataFile });
  assert.equal((await (await fetch(srv.url + '/health')).json()).ok, true);
  assert.equal((await fetch(srv.url + '/api/lots')).status, 401);
  const { token } = await (await fetch(srv.url + '/api/session', {
    method: 'POST', body: JSON.stringify({ name: 'מנהל', role: 'manager' }),
  })).json();
  const auth = { authorization: `Bearer ${token}` };
  const created = await fetch(srv.url + '/api/lots', { method: 'POST', headers: auth, body: JSON.stringify({ name: 'ח', spots: ['1', '2'] }) });
  assert.equal(created.status, 201);
  assert.equal((await fetch(srv.url + '/api/lots', { method: 'POST', headers: auth, body: '{' })).status, 400);
  assert.equal((await fetch(srv.url + '/index.html')).status, 200);
  assert.equal((await fetch(srv.url + '/server/store.js')).status, 404);
  await new Promise((r) => setTimeout(r, 300));
  await srv.close();
  const again = await startServer({ port: 0, dataFile });
  const lots = await (await fetch(again.url + '/api/lots', { headers: auth })).json();
  assert.deepEqual(lots.map((l) => [l.name, l.total]), [['ח', 2]]);
  await again.close();
});
