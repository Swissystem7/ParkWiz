// The spine of the unified pilot flow (#268): one bus, one settings shape, one
// path from a decoded camera frame to a driver alert with a hold.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FLOW = require('../src/lib/pilot-flow');
const LOT = require('../src/lib/atidim-lot');

const root = path.join(__dirname, '..');
const clip = JSON.parse(fs.readFileSync(path.join(root, 'pilot', 'sample-clip.json'), 'utf8'));

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
  };
}

test('the nav is one Hebrew list of four surfaces, driver first', () => {
  assert.deepEqual(FLOW.SURFACES.map((s) => s.labelHe), ['נהג', 'מנהל חניון', 'שלט כניסה', 'הגדרות']);
  assert.deepEqual(FLOW.SURFACES.map((s) => s.id), ['driver', 'manager', 'sign', 'settings']);
  // An unknown or empty hash must land on the driver, not on a blank page.
  assert.equal(FLOW.surfaceFromHash('#sign').id, 'sign');
  assert.equal(FLOW.surfaceFromHash('settings').id, 'settings');
  assert.equal(FLOW.surfaceFromHash('#nope').id, 'driver');
  assert.equal(FLOW.surfaceFromHash(undefined).id, 'driver');
});

test('every camera source the settings surface offers is declared once', () => {
  assert.deepEqual(FLOW.SOURCES.map((s) => s.id), ['sample', 'browser', 'frigate']);
  assert.equal(FLOW.source('frigate').needs, 'url');
  assert.equal(FLOW.source('browser').needs, 'permission');
  // Unknown ids resolve to the offline sample clip rather than to no camera.
  assert.equal(FLOW.source('rtsp-typo').id, 'sample');
  for (const src of FLOW.SOURCES) assert.ok(src.labelHe && src.noteHe, src.id + ' needs Hebrew copy');
});

test('settings normalize: unknown source, out-of-range hold, untrimmed url', () => {
  const s = FLOW.normalizeSettings({ sourceId: 'ftp', holdSeconds: 99999, frigateUrl: '  http://nvr:5000 ', evOnly: 1 });
  assert.equal(s.sourceId, 'sample');
  assert.equal(s.holdSeconds, FLOW.MAX_HOLD_SECONDS);
  assert.equal(s.frigateUrl, 'http://nvr:5000');
  assert.equal(s.evOnly, true);
  assert.equal(FLOW.normalizeSettings({ holdSeconds: 1 }).holdSeconds, FLOW.MIN_HOLD_SECONDS);
  assert.equal(FLOW.normalizeSettings({ holdSeconds: 'abc' }).holdSeconds, FLOW.DEFAULT_SETTINGS.holdSeconds);
  assert.equal(FLOW.normalizeSettings(null).sourceId, 'sample');
});

test('settings round-trip through storage, and a throwing store still boots', () => {
  const store = memoryStorage();
  FLOW.saveSettings({ sourceId: 'frigate', frigateUrl: 'http://nvr:5000', holdSeconds: 180, evOnly: true }, store);
  const back = FLOW.loadSettings(store);
  assert.equal(back.sourceId, 'frigate');
  assert.equal(back.holdSeconds, 180);
  assert.equal(back.evOnly, true);
  // Safari private mode throws on localStorage; the flow must fall back to
  // defaults instead of leaving the page without settings at all.
  const hostile = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(FLOW.loadSettings(hostile).sourceId, 'sample');
  assert.equal(FLOW.saveSettings({ holdSeconds: 300 }, hostile).holdSeconds, 300);
});

test('the bus delivers, unsubscribes, and survives a throwing handler', () => {
  const bus = FLOW.createBus();
  const seen = [];
  const off = bus.on('x', (p) => seen.push(p));
  bus.on('x', () => { throw new Error('a broken surface'); });
  bus.on('x', (p) => seen.push(p * 10));
  bus.emit('x', 2);
  assert.deepEqual(seen, [2, 20], 'a handler that throws must not stop the others');
  off();
  bus.emit('x', 3);
  assert.deepEqual(seen, [2, 20, 30]);
  assert.equal(bus.history('x').length, 2);
});

test('the sample clip decodes to bays with stable ids and EV flags', () => {
  const frames = FLOW.expandClip(clip);
  assert.equal(frames.length, clip.frames.length);
  const bays = clip.cols * clip.rows;
  for (const frame of clip.frames) {
    assert.equal(frame.bays.length, bays, 'every frame must cover every bay');
    assert.match(frame.bays, /^[01]+$/);
  }
  assert.equal(frames[0].spots.length, bays);
  assert.equal(frames[0].spots[0].id, 'A-01');
  assert.equal(frames[0].spots[bays - 1].id, 'A-' + bays);
  // evBays is 1-based, like the bay ids the operator reads off the frame.
  assert.deepEqual(frames[0].spots.filter((s) => s.ev).map((s) => s.id), ['A-05', 'A-06']);
  assert.deepEqual(FLOW.expandClip(null), []);
});

test('only an occupied -> free transition counts as a freed bay', () => {
  const prev = [{ id: 'A-01', occupied: true }, { id: 'A-02', occupied: false }, { id: 'A-03', occupied: true }];
  const next = [{ id: 'A-01', occupied: false }, { id: 'A-02', occupied: false }, { id: 'A-03', occupied: true }];
  assert.deepEqual(FLOW.diffFreed(prev, next).map((s) => s.id), ['A-01']);
  // A bay the camera has never reported before is not a departure.
  assert.deepEqual(FLOW.diffFreed(prev, [{ id: 'B-09', occupied: false }]), []);
  assert.deepEqual(FLOW.diffFreed(null, next), []);
});

test('a cold start never alerts, and the occupancy comes from the lot model', () => {
  const flow = FLOW.createFlow({ lot: LOT });
  const frames = FLOW.expandClip(clip);
  const first = flow.ingest(frames[0], 1000);
  assert.deepEqual(first.freed, [], 'the first frame has nothing to diff against');
  assert.equal(flow.getAlert(), null);
  const direct = LOT.calculateOccupancy(frames[0].spots, LOT.ATIDIM_LOT.totalCapacity);
  assert.equal(first.summary.available, direct.available);
  assert.equal(first.summary.capacity, LOT.ATIDIM_LOT.totalCapacity);
  assert.equal(first.summary.evTotal, 2);
});

test('a departure raises a spot-freed event and one driver alert with a hold', () => {
  const flow = FLOW.createFlow({ lot: LOT, settings: { holdSeconds: 120 } });
  const freed = [];
  const alerts = [];
  flow.bus.on(FLOW.EVENTS.SPOT_FREED, (e) => freed.push(e));
  flow.bus.on(FLOW.EVENTS.ALERT, (a) => alerts.push(a));
  const frames = FLOW.expandClip(clip);
  const at = 1_700_000_000_000;
  frames.forEach((frame, i) => flow.ingest(frame, at + i * 2000));

  assert.ok(freed.length >= 2, 'the clip must contain more than one departure');
  assert.equal(freed[0].spotId, 'A-09');
  assert.equal(freed[0].sourceId, 'sample');
  assert.equal(alerts[0].spotId, 'A-09');
  assert.match(alerts[0].headlineHe, /^התפנה תא חניה A-09$/);
  assert.match(alerts[0].bodyHe, /חיזוי, לא הבטחה/, 'the hold may not read as a promise');
  assert.match(alerts[0].navUrl, /^https:\/\/waze\.com\/ul\?ll=32\.\d+,34\.\d+&navigate=yes$/);
  assert.equal(alerts[0].holdUntilMs - alerts[0].freedAtMs, 120000);
  // The EV bay that empties later is reported as a charger, not a plain bay.
  const evAlert = alerts.find((a) => a.ev);
  assert.ok(evAlert, 'the clip frees a charging bay too');
  assert.match(evAlert.headlineHe, /עמדת טעינה A-05/);
});

test('EV-only settings hold the alert back until a charging bay frees', () => {
  const flow = FLOW.createFlow({ lot: LOT, settings: { evOnly: true } });
  const freed = [];
  flow.bus.on(FLOW.EVENTS.SPOT_FREED, (e) => freed.push(e));
  FLOW.expandClip(clip).forEach((frame, i) => flow.ingest(frame, i * 2000));
  assert.ok(freed.length > 0, 'the clip frees a charging bay');
  assert.ok(freed.every((e) => e.ev), 'a connected EV must not be sent to a plain bay');
  assert.match(flow.getAlert().headlineHe, /עמדת טעינה/);
});

test('switching source resets the diff so no phantom departures are invented', () => {
  const flow = FLOW.createFlow({ lot: LOT });
  const frames = FLOW.expandClip(clip);
  flow.ingest(frames[0], 0);
  flow.setSettings({ sourceId: 'frigate', frigateUrl: 'http://nvr:5000' });
  flow.reset();
  assert.equal(flow.getAlert(), null);
  // frames[2] has a bay free that frames[0] had occupied; after a reset that is
  // a cold start, not a departure.
  assert.deepEqual(flow.ingest(frames[2], 4000).freed, []);
  assert.equal(flow.getSettings().sourceId, 'frigate');
});

test('the hold counts down, expires, and can be released early', () => {
  const flow = FLOW.createFlow({ lot: LOT, settings: { holdSeconds: 60 } });
  const frames = FLOW.expandClip(clip);
  flow.ingest(frames[0], 0);
  flow.ingest(frames[2], 0);
  const alert = flow.getAlert();
  assert.ok(alert);
  const live = FLOW.holdState(alert, 15_000);
  assert.equal(live.live, true);
  assert.equal(live.remaining, 45);
  assert.equal(live.labelHe, 'מוחזק עבורך עוד 00:45');
  const gone = FLOW.holdState(alert, 90_000);
  assert.equal(gone.live, false);
  assert.match(gone.labelHe, /ההחזקה פגה/);
  assert.equal(FLOW.holdState(null).live, false);
  flow.releaseHold();
  assert.equal(flow.getAlert(), null);
});

// The flow is the thing we demo in the room, so the two documents a reviewer
// opens first have to name it and its four surfaces, and the whole flow has to
// be in the offline shell — a meeting with no reception is the normal case.
test('README and docs/pilot-atidim.md describe the one flow', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const doc = fs.readFileSync(path.join(root, 'docs', 'pilot-atidim.md'), 'utf8');
  for (const text of [readme, doc]) {
    assert.match(text, /demo\/pilot\.html/);
    assert.match(text, /pilot-flow\.js/);
    assert.match(text, /sample-clip\.json/);
  }
  assert.match(readme, /docs\/pilot-atidim\.md/);
  for (const surface of FLOW.SURFACES) {
    assert.ok(doc.includes(surface.labelHe), 'the runbook must list the ' + surface.id + ' surface');
  }
  for (const src of FLOW.SOURCES) {
    assert.ok(doc.includes(src.id), 'the runbook must document the ' + src.id + ' source');
  }
  assert.match(doc, /חיזוי, לא הבטחה/, 'the hold may not be documented as a promise');
});

test('the whole flow is in the offline shell', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const asset of ['./demo/pilot.html', './src/lib/pilot-flow.js', './pilot/sample-clip.json']) {
    assert.ok(sw.includes("'" + asset + "'"), asset + ' must be precached for the meeting');
  }
});

test('the entrance sign shows one number, and says full instead of zero', () => {
  assert.deepEqual(FLOW.signPanel({ available: 42, status: 'available' }),
    { number: '42', wordHe: 'מקומות פנויים', tone: 'free' });
  assert.equal(FLOW.signPanel({ available: 1, status: 'busy' }).wordHe, 'מקום פנוי');
  assert.equal(FLOW.signPanel({ available: 1, status: 'busy' }).tone, 'busy');
  assert.equal(FLOW.signPanel({ available: 0, status: 'full' }).number, 'מלא');
  assert.equal(FLOW.signPanel(null).tone, 'idle');
});
