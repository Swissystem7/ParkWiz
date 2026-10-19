// The spot-freed event is the one thing every feature in EPIC #265 reads, so
// its rules are pinned here rather than inside any single page: no alert on the
// first frame, no alert from a flicker, yellow instead of a wrong green, no
// alert for a bay the driver may not use, and nothing but {lot,spotId,freedAt}
// on the wire.
const test = require('node:test');
const assert = require('node:assert/strict');

const sf = require('../src/lib/spot-freed');

function spots(map, confidence) {
  return Object.keys(map).map((id) => ({
    id,
    occupied: map[id],
    confidence: confidence === undefined ? 1 : confidence,
  }));
}

test('the first observation is a baseline and alerts nobody', () => {
  const t = sf.createFreedTracker({ lot: 'atidim' });
  const { events, states } = t.observe(spots({ 'A-01': false, 'A-02': true }), 1000);
  assert.deepEqual(events, []);
  assert.equal(states['A-01'], sf.FREE);
  assert.equal(states['A-02'], sf.OCCUPIED);
});

test('a confirmed occupied -> free transition emits one freed event', () => {
  const t = sf.createFreedTracker({ lot: 'atidim', confirmFrames: 1 });
  t.observe(spots({ 'A-01': true }), 1000);
  const { events } = t.observe(spots({ 'A-01': false }), 5000);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'freed');
  assert.equal(events[0].spotId, 'A-01');
  assert.equal(events[0].lot, 'atidim');
  assert.equal(events[0].at, 5000);
  assert.equal(events[0].eligible, true);
});

test('a free -> occupied transition is a taken event, not a freed one', () => {
  const t = sf.createFreedTracker({ confirmFrames: 1 });
  t.observe(spots({ 'A-01': false }), 0);
  const { events } = t.observe(spots({ 'A-01': true }), 1000);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'taken');
  assert.deepEqual(sf.freedEvents(events), []);
});

test('the same state twice does not re-emit', () => {
  const t = sf.createFreedTracker({ confirmFrames: 1 });
  t.observe(spots({ 'A-01': true }), 0);
  assert.equal(t.observe(spots({ 'A-01': false }), 10).events.length, 1);
  assert.equal(t.observe(spots({ 'A-01': false }), 20).events.length, 0);
  assert.equal(t.observe(spots({ 'A-01': false }), 30).events.length, 0);
});

test('confirmFrames holds a single-frame flicker back and paints it yellow', () => {
  const t = sf.createFreedTracker({ confirmFrames: 2 });
  t.observe(spots({ 'A-01': true }), 0);
  const first = t.observe(spots({ 'A-01': false }), 1000);
  assert.deepEqual(first.events, [], 'one frame is not enough to alert');
  assert.equal(first.states['A-01'], sf.UNCERTAIN, 'mid-transition reads yellow, not green');
  const back = t.observe(spots({ 'A-01': true }), 2000);
  assert.deepEqual(back.events, [], 'the car never actually left');
  assert.equal(back.states['A-01'], sf.OCCUPIED);
  assert.equal(t.stateOf('A-01'), sf.OCCUPIED);
});

test('confirmFrames fires once the transition holds for the whole window', () => {
  const t = sf.createFreedTracker({ confirmFrames: 2 });
  t.observe(spots({ 'A-01': true }), 0);
  assert.deepEqual(t.observe(spots({ 'A-01': false }), 1000).events, []);
  const { events } = t.observe(spots({ 'A-01': false }), 2000);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'freed');
  assert.equal(events[0].at, 2000, 'the event is stamped when it was confirmed');
});

test('a low-confidence frame reports uncertain and never alerts', () => {
  const t = sf.createFreedTracker({ confirmFrames: 1, minConfidence: 0.6 });
  t.observe(spots({ 'A-01': true }), 0);
  const night = t.observe(spots({ 'A-01': false }, 0.3), 1000);
  assert.deepEqual(night.events, []);
  assert.equal(night.states['A-01'], sf.UNCERTAIN);
  assert.equal(t.stateOf('A-01'), sf.OCCUPIED, 'the committed state is unchanged');
});

test('an uncertain frame restarts the confirmation window', () => {
  const t = sf.createFreedTracker({ confirmFrames: 2, minConfidence: 0.6 });
  t.observe(spots({ 'A-01': true }), 0);
  t.observe(spots({ 'A-01': false }), 1000);
  t.observe(spots({ 'A-01': false }, 0.2), 2000);
  assert.deepEqual(t.observe(spots({ 'A-01': false }), 3000).events, [], 'count restarted at 1');
  assert.equal(t.observe(spots({ 'A-01': false }), 4000).events.length, 1);
});

test('reserved bays emit events but are not eligible for a visitor', () => {
  const t = sf.createFreedTracker({
    confirmFrames: 1,
    spotTypes: { 'A-01': 'visitor', 'A-02': 'disabled', 'A-03': 'ev' },
    allowedTypes: ['visitor'],
  });
  t.observe(spots({ 'A-01': true, 'A-02': true, 'A-03': true }), 0);
  const { events } = t.observe(spots({ 'A-01': false, 'A-02': false, 'A-03': false }), 1000);
  assert.equal(events.length, 3, 'the operator board still sees all three');
  assert.deepEqual(sf.freedEvents(events).map((e) => e.spotId), ['A-01']);
  assert.deepEqual(sf.freedEvents(events, { onlyEligible: false }).map((e) => e.spotId), ['A-01', 'A-02', 'A-03']);
});

test('an EV driver is alerted about the EV bay and the visitor bay', () => {
  const t = sf.createFreedTracker({
    confirmFrames: 1,
    spotTypes: { 'A-01': 'visitor', 'A-03': 'ev' },
    allowedTypes: ['visitor', 'ev'],
  });
  t.observe(spots({ 'A-01': true, 'A-03': true }), 0);
  const { events } = t.observe(spots({ 'A-01': false, 'A-03': false }), 1000);
  assert.deepEqual(sf.freedEvents(events).map((e) => e.spotId), ['A-01', 'A-03']);
});

test('an unknown type falls back to visitor rather than dropping the bay', () => {
  assert.equal(sf.normalizeType('motorbike'), 'visitor');
  assert.equal(sf.normalizeType(undefined), 'visitor');
  assert.equal(sf.typeHe('disabled'), 'נכים');
  assert.deepEqual(sf.normalizeAllowed([]), ['visitor']);
  assert.deepEqual(sf.normalizeAllowed(['EV', 'ev', 'nope']), ['ev', 'visitor']);
});

test('relayPayload carries exactly lot, spotId and freedAt — no frame, no driver', () => {
  const t = sf.createFreedTracker({ lot: 'atidim', confirmFrames: 1 });
  t.observe(spots({ 'B-04': true }), 0);
  const event = t.observe(spots({ 'B-04': false }), 7000).events[0];
  const payload = sf.relayPayload(event);
  assert.deepEqual(Object.keys(payload).sort(), ['freedAt', 'lot', 'spotId']);
  assert.deepEqual(payload, { lot: 'atidim', spotId: 'B-04', freedAt: 7000 });
  // Amendment 13: the relay is told a bay opened, never what the camera saw.
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const banned of ['image', 'frame', 'plate', 'photo', 'driver', 'confidence']) {
    assert.ok(!serialized.includes(banned), banned + ' must not reach the relay');
  }
});

test('relayPayload refuses anything that is not a freed event', () => {
  assert.equal(sf.relayPayload(null), null);
  assert.equal(sf.relayPayload({ kind: 'taken', lot: 'a', spotId: 'B-01', at: 1 }), null);
});

test('grid labels and demo types are stable across surfaces', () => {
  const ids = sf.labelGrid(6, 3);
  assert.equal(ids.length, 18);
  assert.equal(ids[0], 'A-01');
  assert.equal(ids[6], 'B-01');
  assert.equal(ids[17], 'C-06');
  const types = sf.demoSpotTypes(ids);
  assert.equal(types['A-06'], 'tenant');
  assert.equal(types['A-05'], 'ev');
  assert.equal(types['B-01'], 'disabled');
  assert.deepEqual(sf.demoSpotTypes(ids), types, 'the same bay is always the same type');
});

test('the Hebrew alert names the bay, its type, the floor and how fresh it is', () => {
  const event = { kind: 'freed', lot: 'atidim', spotId: 'B-03', spotType: 'ev', at: 1000 };
  const text = sf.alertTextHe(event, {
    nowMs: 1000,
    lotName: 'חניון פארק עתידים',
    floors: { B: 'מפלס -1' },
  });
  assert.match(text, /^התפנה מקום B-03 \(טעינה חשמלית\)/);
  assert.match(text, /חניון פארק עתידים · מפלס -1 · מקום B-03/);
  assert.match(text, /ממש עכשיו$/);
  assert.equal(sf.alertTextHe({ kind: 'taken' }, {}), '');
});

test('freshness reads as Hebrew, not as a raw duration', () => {
  assert.equal(sf.agoHe(0), 'ממש עכשיו');
  assert.equal(sf.agoHe(25000), 'לפני 25 שניות');
  assert.equal(sf.agoHe(60000), 'לפני דקה');
  assert.equal(sf.agoHe(5 * 60000), 'לפני 5 דקות');
  assert.equal(sf.agoHe(3600000), 'לפני שעה');
  assert.equal(sf.agoHe(3 * 3600000), 'לפני 3 שעות');
  assert.equal(sf.agoHe(-5), 'ממש עכשיו', 'a clock skew must not print a negative');
});

test('navigation links point both apps at the lot entrance', () => {
  const links = sf.navigationLinks();
  assert.equal(links.label, sf.ATIDIM_ENTRANCE.name);
  assert.match(links.waze, /^https:\/\/waze\.com\/ul\?ll=32\.1136%2C34\.8395&navigate=yes$/);
  assert.match(links.google, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=32\.1136%2C34\.8395$/);
  assert.equal(sf.navigationLinks({ lat: 'x', lon: 5 }), null);
});

test('spots without an id are skipped instead of colliding under "undefined"', () => {
  const t = sf.createFreedTracker({ confirmFrames: 1 });
  const { states } = t.observe([{ occupied: true }, null, { id: 'A-01', occupied: true }], 0);
  assert.deepEqual(Object.keys(states), ['A-01']);
});
