// The agents panel on demo/atidim.html is what an operator actually sees, so
// these tests guard the acceptance run of #269 end to end: a freed stall must
// produce a driver alert with a Waze link, the manager must show a Hebrew
// summary, a switched-off agent must go quiet, and nothing may throw on the way
// (the acceptance wording is "no console errors").
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const lotModel = require('../src/lib/atidim-lot');
const { createBus } = require('../src/agents/bus');
const { createRuntime } = require('../src/agents/runtime');
const { createDriverAgent } = require('../src/agents/driver');
const { createManagerAgent } = require('../src/agents/manager');

// ---- markup / wiring -------------------------------------------------------

test('the page ships the agents panel with per-agent toggles and an action log', () => {
  assert.match(html, /aria-label="סוכנים מובנים"/);
  assert.match(html, /id="agentToggles"[^>]*role="group"/);
  assert.match(html, /id="agentDriverSummary"[^>]*role="status"/);
  assert.match(html, /id="agentManagerSummary"[^>]*role="status"/);
  assert.match(html, /<ol class="agent-log" id="agentLog" aria-label="יומן פעולות הסוכנים">/);
  assert.match(html, /id="agentLogEmpty"/);
  assert.match(html, /id="btnDriverWaiting"[^>]*aria-pressed="false"/);
});

test('the panel states the agents are rule-based and run in the browser only', () => {
  assert.match(html, /מבוססי חוקים/);
  assert.match(html, /ללא שרת/);
  assert.match(html, /ללא מודל שפה בתשלום/);
});

test('the page loads every agent module and registers both agents', () => {
  for (const file of ['bus', 'runtime', 'driver', 'manager']) {
    assert.match(html, new RegExp('<script src="\\.\\./src/agents/' + file + '\\.js"></script>'));
  }
  assert.match(html, /createRuntime\(\{ bus: agentBus \}\)/);
  assert.match(html, /ParkWizDriverAgent\.createDriverAgent\(\)/);
  assert.match(html, /ParkWizManagerAgent\.createManagerAgent\(\{ lotName: model\.ATIDIM_LOT\.name \}\)/);
});

test('toggles and the waiting-driver button keep aria-pressed in sync', () => {
  assert.match(html, /btn\.setAttribute\('aria-pressed', String\(on\)\)/);
  assert.match(html, /this\.setAttribute\('aria-pressed', String\(!waiting\)\)/);
});

test('every stall flip in the frame is published, but a frame swap is not', () => {
  // Arrivals, departures, the auto flow and a manual click all go through
  // applySpots, which is the only place that emits spot-freed / spot-taken.
  assert.equal((html.match(/applySpots\(/g) || []).length, 5);
  assert.doesNotMatch(html, /spots = model\.transitionSpot/);
  // Initial load, reset and camera switch replace the frame wholesale and must
  // stay direct assignments rather than being diffed into 24 phantom events.
  assert.equal((html.match(/spots = model\.createCameraSpots/g) || []).length, 3);
  assert.match(html, /before\[i\]\.id !== next\[i\]\.id/);
});

test('the runtime is ticked from the page clock so a hold can expire', () => {
  assert.match(html, /runtime\.tick\(Date\.now\(\)\); renderAgents\(\);/);
});

test('agent text reaches the DOM as text, never as innerHTML', () => {
  const panel = html.slice(html.indexOf('function renderSummary'), html.indexOf('function refresh()'));
  assert.doesNotMatch(panel, /innerHTML/);
  assert.match(panel, /el\.textContent = ''/);
  assert.match(panel, /list\.textContent = ''/);
  assert.match(panel, /link\.rel = 'noopener'/);
});

test('the agent modules are in the offline shell behind a cache bump', () => {
  for (const file of ['bus', 'runtime', 'driver', 'manager']) {
    assert.ok(sw.includes("'./src/agents/" + file + ".js'"), 'sw.js is missing ' + file);
  }
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 19, 'adding the agents panel needs a cache bump');
});

test('the page still makes no network call of its own', () => {
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(html, /https?:\/\/(unpkg|cdnjs|cdn|fonts\.googleapis|ajax\.googleapis)/i);
});

// ---- the acceptance run, with the page's own wiring ------------------------

// Mirrors spotFacts() and applySpots() in the page: same geometry constants,
// same "only a same-frame flip is an event" rule. If the page changes one of
// these, the assertion on the constants below fails rather than drifting.
const FRAME_SPAN_M = 60;
const EV_EVERY = 6;

test('the page and this test agree on the demo geometry constants', () => {
  assert.match(html, new RegExp('const FRAME_SPAN_M = ' + FRAME_SPAN_M + ';'));
  assert.match(html, new RegExp('const EV_EVERY = ' + EV_EVERY + ';'));
});

function spotFacts(spot, index) {
  const dx = (spot.x + spot.w / 2) - 0.5;
  const dy = 0.98 - (spot.y + spot.h / 2);
  return {
    spotId: spot.id,
    distanceM: Math.round(Math.sqrt(dx * dx + dy * dy) * FRAME_SPAN_M),
    evCharger: index % EV_EVERY === 0,
    spotType: 'standard',
    cameraId: 'cam-01',
    lotName: lotModel.ATIDIM_LOT.name,
  };
}

function harness() {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  runtime.register(createDriverAgent());
  runtime.register(createManagerAgent({ lotName: lotModel.ATIDIM_LOT.name }));
  // 09:00 — the morning peak, so most of the frame is occupied and freeing a
  // stall is the interesting event.
  let spots = lotModel.createCameraSpots('cam-01', 9);
  const at = () => 1_700_000_000_000;

  function applySpots(next, now) {
    const before = spots;
    spots = next;
    if (before.length !== next.length) return;
    for (let i = 0; i < next.length; i++) {
      if (before[i].occupied === next[i].occupied) continue;
      bus.emit(next[i].occupied ? 'spot-taken' : 'spot-freed', spotFacts(next[i], i), now);
    }
  }

  function sample(now) {
    const occ = lotModel.calculateOccupancy(spots, lotModel.ATIDIM_LOT.totalCapacity);
    bus.emit('occupancy-sample', { hour: 9, rate: occ.rate, available: occ.available }, now);
  }

  function freeStall(index, now) {
    const next = spots.map((s, i) => (i === index ? Object.assign({}, s, { occupied: false }) : s));
    applySpots(next, now);
    sample(now);
  }

  return { bus, runtime, at, spots: () => spots, freeStall, sample, applySpots };
}

test('acceptance: freeing a stall for a waiting driver alerts with a Waze link and a hold', () => {
  const h = harness();
  const t = h.at();
  h.bus.emit('driver-waiting', { driverId: 'demo-driver', batteryPct: 15, maxWalkM: 400 }, t);

  const occupied = h.spots().findIndex((s) => s.occupied);
  assert.ok(occupied >= 0, 'the 09:00 frame should have an occupied stall to free');
  h.freeStall(occupied, t + 1000);

  const driver = h.runtime.reports().find((r) => r.name === 'driver').report;
  assert.ok(driver.heldSpotId, 'the driver agent should be holding a stall');
  assert.match(driver.wazeUrl, /^https:\/\/waze\.com\/ul\?/);
  assert.match(driver.textHe, /^שמור כרגע: תא /);
  assert.equal(driver.alerts, 1);

  const logged = h.runtime.log().filter((e) => e.type === 'driver-alert');
  assert.equal(logged.length, 1);
  assert.equal(logged[0].agent, 'driver');
  assert.match(logged[0].textHe, /התפנה תא .+ · \d+ מ׳ הליכה/);
  assert.match(logged[0].textHe, /נשמר לך ל-90 שניות/);
  assert.equal(h.bus.errors().length, 0);
  assert.deepEqual(h.runtime.failures(), []);
});

test('acceptance: the manager agent shows a Hebrew summary that counts that alert', () => {
  const h = harness();
  const t = h.at();
  h.bus.emit('driver-waiting', { driverId: 'demo-driver', batteryPct: 15 }, t);
  h.freeStall(h.spots().findIndex((s) => s.occupied), t + 1000);

  const manager = h.runtime.reports().find((r) => r.name === 'manager').report;
  assert.match(manager.textHe, /^סיכום יומי — חניון פארק עתידים/);
  assert.match(manager.textHe, /שיא תפוסה \d+% ב-09:00/);
  assert.match(manager.textHe, /1 התראות נשלחו לנהגים/);
  assert.match(manager.textHe, /דק׳ חיפוש נחסכו/);
  assert.equal(manager.alerts, 1, 'the manager should count the driver alert off the bus');
});

test('a low battery sends the driver to a charger bay, not to the nearest stall', () => {
  const h = harness();
  const t = h.at();
  h.bus.emit('driver-waiting', { driverId: 'demo-driver', batteryPct: 15 }, t);
  const charger = h.spots().findIndex((s, i) => s.occupied && i % EV_EVERY === 0);
  assert.ok(charger >= 0, 'the frame should contain an occupied charger bay');
  h.freeStall(charger, t + 1000);
  const alert = h.runtime.log().find((e) => e.type === 'driver-alert');
  assert.match(alert.textHe, /עמדת טעינה/);
});

test('no waiting driver means no alert, however many stalls free up', () => {
  const h = harness();
  const t = h.at();
  h.spots().forEach((spot, i) => { if (spot.occupied) h.freeStall(i, t + i * 10); });
  assert.deepEqual(h.runtime.log().filter((e) => e.type === 'driver-alert'), []);
  assert.equal(h.bus.errors().length, 0);
});

test('switching the driver agent off stops its alerts and leaves the manager running', () => {
  const h = harness();
  const t = h.at();
  h.bus.emit('driver-waiting', { driverId: 'demo-driver', batteryPct: 15 }, t);
  h.runtime.setEnabled('driver', false);
  h.freeStall(h.spots().findIndex((s) => s.occupied), t + 1000);

  assert.deepEqual(h.runtime.log().filter((e) => e.type === 'driver-alert'), []);
  const reports = h.runtime.reports();
  assert.equal(reports.find((r) => r.name === 'driver').enabled, false);
  assert.equal(reports.find((r) => r.name === 'manager').report.samples, 1);
});

test('the hold the agent took is released on the page clock without anyone asking', () => {
  const h = harness();
  const t = h.at();
  h.bus.emit('driver-waiting', { driverId: 'demo-driver', batteryPct: 15 }, t);
  h.freeStall(h.spots().findIndex((s) => s.occupied), t + 1000);
  const held = h.runtime.reports().find((r) => r.name === 'driver').report.heldSpotId;

  h.runtime.tick(t + 1000 + 89_000);
  assert.equal(h.runtime.reports().find((r) => r.name === 'driver').report.heldSpotId, held);
  h.runtime.tick(t + 1000 + 90_000);

  const driver = h.runtime.reports().find((r) => r.name === 'driver').report;
  assert.equal(driver.heldSpotId, null);
  assert.equal(driver.wazeUrl, null, 'the Waze link must disappear with the hold');
  const release = h.runtime.log().filter((e) => e.type === 'hold-release');
  assert.equal(release.length, 1);
  assert.match(release[0].textHe, /חלון השמירה הסתיים/);
});

test('an ordinary demo session produces no bus errors and no agent failures', () => {
  const h = harness();
  const t = h.at();
  h.bus.emit('driver-waiting', { driverId: 'demo-driver', batteryPct: 15 }, t);
  for (let i = 0; i < 30; i++) {
    const idx = i % h.spots().length;
    h.freeStall(idx, t + i * 2000);
    h.runtime.tick(t + i * 2000);
  }
  h.bus.emit('driver-done', { driverId: 'demo-driver' }, t + 70_000);
  assert.deepEqual(h.bus.errors(), []);
  assert.deepEqual(h.runtime.failures(), []);
});
