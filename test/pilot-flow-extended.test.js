// Edge cases of src/lib/pilot-flow.js that the main suite does not reach:
// broken storage (Safari private mode), bad handlers on the bus, and the
// hold / entrance-sign states a driver sees when there is nothing to show.
const test = require('node:test');
const assert = require('node:assert/strict');
const flow = require('../src/lib/pilot-flow');

test('mmss clamps junk and negatives to 00:00 and pads', () => {
  assert.equal(flow.mmss(undefined), '00:00');
  assert.equal(flow.mmss('abc'), '00:00');
  assert.equal(flow.mmss(-30), '00:00');
  assert.equal(flow.mmss(65), '01:05');
  assert.equal(flow.mmss(600), '10:00');
});

test('unknown source id and unknown hash fall back to the first entry', () => {
  assert.equal(flow.source('no-such-source'), flow.SOURCES[0]);
  assert.equal(flow.source(undefined), flow.SOURCES[0]);
  assert.equal(flow.surfaceFromHash('#nope'), flow.SURFACES[0]);
  assert.equal(flow.surfaceFromHash(null), flow.SURFACES[0]);
  const second = flow.SURFACES[1];
  assert.equal(flow.surfaceFromHash('#' + second.id.toUpperCase() + ' '), second);
});

test('bus ignores non-function handlers and off() removes only that handler', () => {
  const bus = flow.createBus();
  const noop = bus.on('x', 'not a function');
  assert.equal(typeof noop, 'function');
  noop();
  let a = 0;
  let b = 0;
  const offA = bus.on('x', () => { a += 1; });
  bus.on('x', () => { b += 1; });
  offA();
  offA(); // second call is harmless
  if (typeof bus.emit === 'function') {
    bus.emit('x', {});
    assert.equal(a, 0);
    assert.equal(b, 1);
  }
});

test('loadSettings survives a storage that throws and returns defaults', () => {
  const throwing = { getItem() { throw new Error('private mode'); } };
  assert.deepEqual(flow.loadSettings(throwing), flow.normalizeSettings(null));
  const garbage = { getItem() { return '{not json'; } };
  assert.deepEqual(flow.loadSettings(garbage), flow.normalizeSettings(null));
});

test('saveSettings keeps the in-memory copy when storage throws', () => {
  const throwing = { setItem() { throw new Error('quota'); } };
  const out = flow.saveSettings({}, throwing);
  assert.deepEqual(out, flow.normalizeSettings({}));
  const saved = {};
  const ok = { setItem(k, v) { saved[k] = v; } };
  flow.saveSettings({}, ok);
  assert.ok(saved[flow.SETTINGS_KEY]);
  assert.deepEqual(JSON.parse(saved[flow.SETTINGS_KEY]), flow.normalizeSettings({}));
});

test('holdState: no alert, expired hold, live hold', () => {
  const none = flow.holdState(null, 0);
  assert.equal(none.live, false);
  assert.match(none.labelHe, /אין התראה פעילה/);
  const expired = flow.holdState({ holdUntilMs: 1000 }, 5000);
  assert.equal(expired.live, false);
  assert.equal(expired.remaining, 0);
  assert.match(expired.labelHe, /פגה/);
  const live = flow.holdState({ holdUntilMs: 95000 }, 0);
  assert.equal(live.live, true);
  assert.equal(live.remaining, 95);
  assert.match(live.labelHe, /01:35/);
});

test('signPanel: waiting, full, one spot, busy and free tones', () => {
  assert.equal(flow.signPanel(null).tone, 'idle');
  const full = flow.signPanel({ available: 0 });
  assert.equal(full.tone, 'full');
  assert.equal(full.number, 'מלא');
  const one = flow.signPanel({ available: 1, status: 'ok' });
  assert.equal(one.number, '1');
  assert.equal(one.wordHe, 'מקום פנוי');
  assert.equal(one.tone, 'free');
  const busy = flow.signPanel({ available: 3.4, status: 'busy' });
  assert.equal(busy.number, '3');
  assert.equal(busy.wordHe, 'מקומות פנויים');
  assert.equal(busy.tone, 'busy');
  assert.equal(flow.signPanel({ available: -2 }).tone, 'full');
});

test('diffFreed tolerates junk input and reports only real departures', () => {
  assert.deepEqual(flow.diffFreed(null, null), []);
  const before = [{ id: 'A1', occupied: true }, { id: 'A2', occupied: false }];
  const after = [{ id: 'A1', occupied: false }, { id: 'A2', occupied: false }, null];
  assert.deepEqual(flow.diffFreed(before, after).map((s) => s.id), ['A1']);
});
