// The edge bridge is the only thing standing between a park's camera network
// and an operator's screen, so these tests pin the three ways it could lose
// the pilot's trust: a bay that lies about being free, an image or a password
// escaping the site, and a dead or frozen stream shown as live green.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EB = require('../src/lib/edge-bridge');

const CONFIG = {
  lot: 'atidim',
  holdMs: 700,
  cameras: [
    {
      name: 'lot_cam',
      zones: { atidim_a01: 'A-01', atidim_a02: 'A-02', atidim_a03: 'A-03' },
    },
  ],
};

const T0 = Date.parse('2026-10-19T09:00:00.000Z');

function bridge(extra) {
  return EB.createBridge(Object.assign({}, CONFIG, extra));
}

// Settle a bay into `occupied` and return the bridge, ready for the test's
// own transition. Every helper here uses explicit timestamps: the hold is a
// clock rule and a test that leaned on Date.now() would only flake.
function seed(b, zone, count, at) {
  b.onMessage('frigate/' + zone + '/car', String(count), at);
  return b.tick(at + 1000);
}

test('a Frigate zone count becomes one ParkWiz spot message', () => {
  const b = bridge();
  assert.deepEqual(b.onMessage('frigate/atidim_a01/car', '1', T0), []);
  const out = b.tick(T0 + 700);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    type: 'spot', lot: 'atidim', spotId: 'A-01', camera: 'lot_cam',
    occupied: true, ts: '2026-10-19T09:00:00.700Z',
  });
});

test('occupied -> free also emits spot-freed, once', () => {
  const b = bridge();
  seed(b, 'atidim_a02', 1, T0);
  b.onMessage('frigate/atidim_a02/car', '0', T0 + 2000);
  const out = b.tick(T0 + 2700);
  assert.deepEqual(out.map((m) => m.type), ['spot', 'spot-freed']);
  assert.equal(out[1].spotId, 'A-02');
  assert.equal(out[0].occupied, false);
  // The same payload again is not a second freeing.
  b.onMessage('frigate/atidim_a02/car', '0', T0 + 4000);
  assert.deepEqual(b.tick(T0 + 5000), []);
});

test('a one-frame flicker inside the hold never reaches a client', () => {
  const b = bridge();
  seed(b, 'atidim_a01', 1, T0);
  // Detector drops the parked car for 300ms, then sees it again.
  b.onMessage('frigate/atidim_a01/car', '0', T0 + 2000);
  b.onMessage('frigate/atidim_a01/car', '1', T0 + 2300);
  assert.deepEqual(b.tick(T0 + 3000), []);
});

test('the hold is clamped under the ~2s acceptance budget', () => {
  assert.equal(EB.createBridge({ holdMs: 99999 }).maxLatencyMs(), EB.MAX_HOLD_MS);
  assert.ok(EB.MAX_HOLD_MS < EB.MAX_PUBLISH_LATENCY_MS);
  assert.equal(EB.normalizeConfig({ holdMs: 'nonsense' }).holdMs, EB.DEFAULT_HOLD_MS);
  // holdMs: 0 is a legitimate lab setting and publishes on the message itself.
  const now = EB.createBridge(Object.assign({}, CONFIG, { holdMs: 0 }));
  assert.equal(now.onMessage('frigate/atidim_a01/car', '1', T0).length, 1);
});

test('a zone count under one frees the bay, a count over one still occupies', () => {
  const b = bridge({ holdMs: 0 });
  assert.equal(b.onMessage('frigate/atidim_a03/car', '2', T0)[0].occupied, true);
  assert.equal(b.onMessage('frigate/atidim_a03/car', '0', T0 + 1)[0].occupied, false);
  // A non-numeric payload is Frigate noise, not an empty bay.
  seed(b, 'atidim_a03', 1, T0 + 2);
  assert.deepEqual(b.onMessage('frigate/atidim_a03/car', 'ON', T0 + 3), []);
});

test('image topics are refused, not forwarded', () => {
  const b = bridge({ holdMs: 0 });
  for (const topic of [
    'frigate/lot_cam/car/snapshot',
    'frigate/lot_cam/car/clip',
    'frigate/lot_cam/car/thumbnail',
  ]) {
    assert.equal(EB.parseTopic(topic).kind, 'image');
    assert.deepEqual(b.onMessage(topic, Buffer.from([0xff, 0xd8]), T0), []);
  }
  assert.equal(b.refusedImages(), 3);
});

test('topics that are not zone occupancy do not move a bay', () => {
  const b = bridge({ holdMs: 0 });
  assert.equal(EB.parseTopic('frigate/stats').kind, 'stats');
  assert.equal(EB.parseTopic('frigate/available').kind, 'available');
  assert.equal(EB.parseTopic('frigate/events').kind, 'events');
  assert.equal(EB.parseTopic('frigate/lot_cam/motion').kind, 'motion');
  assert.equal(EB.parseTopic('mosquitto/health').kind, 'unknown');
  // A camera-level count covers many bays, so it cannot be an occupancy.
  assert.deepEqual(b.onMessage('frigate/lot_cam/car', '3', T0), []);
  // `/active` excludes stationary cars — exactly wrong for parking.
  assert.deepEqual(b.onMessage('frigate/atidim_a01/car/active', '1', T0), []);
  // A person in the aisle is not a parked vehicle.
  assert.deepEqual(b.onMessage('frigate/atidim_a01/person', '1', T0), []);
  assert.deepEqual(b.snapshot(T0).spots.filter((s) => s.occupied), []);
});

test('a camera reporting no frames goes offline with a Hebrew warning', () => {
  const b = bridge();
  const stats = JSON.stringify({ cameras: { lot_cam: { camera_fps: 0, detection_fps: 0 } } });
  const out = b.onMessage('frigate/stats', stats, T0);
  assert.equal(out.length, 1);
  assert.equal(out[0].type, 'health');
  assert.equal(out[0].state, 'offline');
  assert.equal(out[0].ok, false);
  assert.match(out[0].warningHe, /לא מדווחת/);
  assert.match(out[0].warningHe, /lot_cam/);
  // Reported once, not on every stats message.
  assert.deepEqual(b.onMessage('frigate/stats', stats, T0 + 5000), []);
  const back = JSON.stringify({ cameras: { lot_cam: { camera_fps: 5 } } });
  const recovered = b.onMessage('frigate/stats', back, T0 + 10000);
  assert.equal(recovered[0].state, 'ok');
  assert.equal(recovered[0].warningHe, '');
});

test('silence from Frigate ages a camera to offline', () => {
  const b = bridge();
  b.onMessage('frigate/stats', { cameras: { lot_cam: { camera_fps: 5 } } }, T0);
  assert.deepEqual(b.tick(T0 + 10000), []);
  const out = b.tick(T0 + 20000);
  assert.equal(out[0].state, 'offline');
});

test('frames without any change raise a frozen-stream warning', () => {
  const b = bridge({ frozenAfterMs: 60000 });
  b.onMessage('frigate/stats', { cameras: { lot_cam: { camera_fps: 5 } } }, T0);
  b.onMessage('frigate/atidim_a01/car', '1', T0);
  b.tick(T0 + 1000); // the bay fills; after this nothing in the picture moves
  b.onMessage('frigate/stats', { cameras: { lot_cam: { camera_fps: 5 } } }, T0 + 70000);
  const out = b.tick(T0 + 70001);
  assert.equal(out.length, 1);
  assert.equal(out[0].state, 'frozen');
  assert.match(out[0].warningHe, /קפואה/);
  // Motion is proof the picture is moving again.
  b.onMessage('frigate/lot_cam/motion', 'ON', T0 + 70002);
  assert.equal(b.tick(T0 + 70003)[0].state, 'ok');
});

test('frigate/available offline marks every camera down', () => {
  const b = bridge();
  const out = b.onMessage('frigate/available', 'offline', T0);
  assert.deepEqual(out.map((m) => m.state), ['offline']);
  assert.equal(b.snapshot(T0).health[0].ok, false);
  assert.equal(b.onMessage('frigate/available', 'online', T0 + 1000)[0].state, 'ok');
});

test('a snapshot carries the whole lot and no camera internals', () => {
  const b = bridge({ holdMs: 0 });
  b.onMessage('frigate/atidim_a02/car', '1', T0);
  const snap = b.snapshot(T0 + 1);
  assert.equal(snap.type, 'snapshot');
  assert.equal(snap.lot, 'atidim');
  assert.equal(snap.spots.length, 3);
  assert.deepEqual(snap.spots.filter((s) => s.occupied).map((s) => s.spotId), ['A-02']);
  assert.deepEqual(Object.keys(snap.health[0]).sort(), ['camera', 'ok', 'state', 'warningHe']);
});

test('nothing outside the message whitelist can be published', () => {
  const dirty = EB.sanitizeMessage({
    type: 'spot', lot: 'atidim', spotId: 'A-01', occupied: true,
    snapshot: 'data:image/jpeg;base64,/9j/', plate: '12-345-67',
    rtsp: 'rtsp://parkwiz:s3cret@10.0.0.11/Streaming/Channels/101',
  });
  assert.deepEqual(Object.keys(dirty).sort(), ['lot', 'occupied', 'spotId', 'type']);
  for (const key of ['snapshot', 'plate', 'rtsp', 'image', 'clip', 'thumbnail']) {
    assert.equal(EB.MESSAGE_KEYS.indexOf(key), -1);
  }
});

test('the config is the single zone -> bay map, and survives junk', () => {
  const cfg = EB.normalizeConfig({
    cameras: [
      { name: ' lot_cam ', zones: { ' atidim_a01 ': ' A-01 ', bad: '', '': 'A-09' } },
      { name: '', zones: { x: 'A-10' } },
      null,
    ],
  });
  assert.equal(cfg.lot, 'atidim');
  assert.deepEqual(cfg.cameras.map((c) => c.name), ['lot_cam']);
  assert.deepEqual(cfg.zones.atidim_a01, { camera: 'lot_cam', spotId: 'A-01' });
  assert.equal(Object.keys(cfg.zones).length, 1);
  assert.deepEqual(EB.normalizeConfig(null).cameras, []);
});

test('the page parses only known messages and coerces their types', () => {
  assert.equal(EB.parseFeedMessage('not json'), null);
  assert.equal(EB.parseFeedMessage('{"type":"stats"}'), null);
  assert.equal(EB.parseFeedMessage({ type: 'spot' }), null);
  const m = EB.parseFeedMessage('{"type":"spot","lot":"atidim","spotId":"A-01","occupied":"true","plate":"x"}');
  assert.deepEqual(m, { type: 'spot', lot: 'atidim', spotId: 'A-01', occupied: true });
});

test('messages fold into page state, freed bays included', () => {
  let s = EB.applyMessage(null, { type: 'snapshot', lot: 'atidim', spots: [
    { spotId: 'A-01', occupied: true }, { spotId: 'A-02', occupied: false },
  ] }, T0);
  assert.equal(s.lot, 'atidim');
  assert.equal(s.spots['A-01'].occupied, true);
  s = EB.applyMessage(s, { type: 'spot', spotId: 'A-02', occupied: true }, T0 + 1000);
  assert.equal(s.spots['A-02'].occupied, true);
  assert.deepEqual(s.freed, []);
  s = EB.applyMessage(s, { type: 'spot-freed', spotId: 'A-01', ts: '2026-10-19T09:00:02.000Z' }, T0 + 2000);
  assert.deepEqual(s.freed, ['A-01']);
  assert.equal(s.spots['A-01'].occupied, false);
  assert.equal(s.lastMessageAt, T0 + 2000);
  // Garbage is not a heartbeat: the last real message still dates the state.
  const after = EB.applyMessage(s, 'garbage', T0 + 9000);
  assert.equal(after.lastMessageAt, T0 + 2000);
  assert.equal(after.spots['A-02'].occupied, true);
});

test('health messages become Hebrew warnings for the status region', () => {
  let s = EB.applyMessage(null, { type: 'health', camera: 'lot_cam', state: 'frozen', ok: false,
    warningHe: 'ייתכן שהתמונה ממצלמה lot_cam קפואה — אין שינוי זמן רב' }, T0);
  assert.deepEqual(EB.healthWarnings(s), ['ייתכן שהתמונה ממצלמה lot_cam קפואה — אין שינוי זמן רב']);
  s = EB.applyMessage(s, { type: 'health', camera: 'lot_cam', state: 'ok', ok: true, warningHe: '' }, T0 + 1);
  assert.deepEqual(EB.healthWarnings(s), []);
  assert.deepEqual(EB.healthWarnings(null), []);
});

test('no bridge, a dead bridge or a silent bridge all fall back to #264', () => {
  const url = 'http://edge.local:8787';
  assert.deepEqual(EB.shouldFallback({}), { fallback: true, reason: 'no-bridge' });
  assert.equal(EB.shouldFallback({ url, connected: false }).reason, 'disconnected');
  assert.equal(EB.shouldFallback({ url, connected: true }).reason, 'awaiting-first-message');
  assert.equal(EB.shouldFallback({ url, connected: true, lastMessageAt: T0, now: T0 + 1500 }).fallback, false);
  const stale = EB.shouldFallback({ url, connected: true, lastMessageAt: T0, now: T0 + 30000 });
  assert.deepEqual(stale, { fallback: true, reason: 'stale' });
  // The staleness window can never be tighter than the publish budget, or a
  // healthy bridge would be declared dead between two quiet bays.
  assert.equal(
    EB.shouldFallback({ url, connected: true, lastMessageAt: T0, now: T0 + 1900, staleAfterMs: 10 }).fallback,
    false
  );
});

test('a bridge URL is validated and may not carry a password', () => {
  const ok = EB.normalizeBridgeUrl(' http://edge.local:8787/ ');
  assert.deepEqual(ok, {
    ok: true,
    url: 'http://edge.local:8787',
    sseUrl: 'http://edge.local:8787/events',
    wsUrl: 'ws://edge.local:8787/ws',
  });
  assert.equal(EB.normalizeBridgeUrl('wss://edge.local/bridge').wsUrl, 'wss://edge.local/bridge/ws');
  for (const bad of ['', 'edge.local', 'rtsp://10.0.0.11/Streaming', 'file:///etc/passwd']) {
    assert.equal(EB.normalizeBridgeUrl(bad).ok, false);
  }
  const creds = EB.normalizeBridgeUrl('http://parkwiz:s3cret@edge.local:8787');
  assert.equal(creds.ok, false);
  assert.match(creds.error, /סיסמה/);
});
