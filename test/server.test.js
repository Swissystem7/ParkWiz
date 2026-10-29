const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, CLAIM_TTL_MS } = require('../server/store');

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
