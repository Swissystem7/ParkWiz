// The driver agent is the one that interrupts a human being, so these tests
// pin when it is allowed to: never without a waiting driver, never for a stall
// outside the walk limit, never twice for a marginal improvement — and it must
// always let go of the hold it took (#265 row 4).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  createDriverAgent, scoreSpot, wazeLink, needsCharger,
  EV_LOW_PCT, SWITCH_MARGIN, DEFAULT_HOLD_SECONDS, DEFAULT_MAX_WALK_M,
} = require('../src/agents/driver');

const T0 = 1_700_000_000_000;
const freed = (over) => Object.assign({ type: 'spot-freed', at: T0, spotId: 'A-07', distanceM: 100, lotName: 'חניון פארק עתידים' }, over);
const waiting = (over) => Object.assign({ type: 'driver-waiting', at: T0, driverId: 'd1' }, over);

function alertsOf(actions) {
  return (actions || []).filter((a) => a.type === 'driver-alert');
}

test('a freed stall with no waiting driver produces no alert', () => {
  const agent = createDriverAgent();
  assert.equal(agent.onEvent(freed()), null);
  assert.equal(agent.report().alerts, 0);
  assert.equal(agent.report().textHe, 'אין נהג ממתין');
});

test('a waiting driver is alerted on the next freed stall, with a Waze link and a hold', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  const [alert] = alertsOf(agent.onEvent(freed()));
  assert.ok(alert, 'expected a driver-alert');
  assert.equal(alert.spotId, 'A-07');
  assert.equal(alert.driverId, 'd1');
  assert.equal(alert.holdSeconds, DEFAULT_HOLD_SECONDS);
  assert.equal(alert.holdUntil, T0 + DEFAULT_HOLD_SECONDS * 1000);
  assert.match(alert.wazeUrl, /^https:\/\/waze\.com\/ul\?q=/);
  assert.match(alert.textHe, /^התפנה תא A-07/);
  assert.match(alert.textHe, /100 מ׳ הליכה/);
  assert.equal(agent.report().heldSpotId, 'A-07');
});

test('a stall beyond the walk limit is never offered', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting({ maxWalkM: 150 }));
  assert.equal(agent.onEvent(freed({ distanceM: 400 })), null);
  assert.equal(agent.report().heldSpotId, null);
  assert.equal(agent.report().textHe, 'נהג ממתין — אין תא מתאים כרגע');
});

test('the default walk limit applies when the driver did not state one', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  assert.equal(agent.onEvent(freed({ distanceM: DEFAULT_MAX_WALK_M + 1 })), null);
  assert.equal(alertsOf(agent.onEvent(freed({ distanceM: DEFAULT_MAX_WALK_M }))).length, 1);
});

test('an accessible need is a hard filter, not a weight', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting({ spotType: 'accessible' }));
  // Right next to the entrance, but the wrong kind of stall.
  assert.equal(agent.onEvent(freed({ distanceM: 5, spotType: 'standard' })), null);
  const [alert] = alertsOf(agent.onEvent(freed({ spotId: 'A-01', distanceM: 300, spotType: 'accessible' })));
  assert.equal(alert.spotId, 'A-01');
  assert.match(alert.textHe, /סוג תא מתאים/);
});

test('a closer stall wins: scoring costs a point per 50 m', () => {
  const near = scoreSpot({ spotId: 'A-01', distanceM: 50 }, {});
  const far = scoreSpot({ spotId: 'A-02', distanceM: 300 }, {});
  assert.ok(near.score > far.score);
  assert.equal(Number((near.score - far.score).toFixed(3)), 5);
});

test('scoring is deterministic and the source carries no randomness', () => {
  const spot = { spotId: 'A-07', distanceM: 123, evCharger: true };
  assert.deepEqual(scoreSpot(spot, { needsEv: true }), scoreSpot(spot, { needsEv: true }));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'driver.js'), 'utf8');
  const code = src.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.ok(!code.includes('Math.random'), 'Math.random appeared in the driver agent');
});

// #267: the EV rule. A low battery changes the answer even when the driver
// never asked for a charger.
test('a low battery makes a charger stall beat a much closer plain one', () => {
  for (const profile of [{ needsEv: true }, { batteryPct: EV_LOW_PCT }, { batteryPct: 5 }]) {
    assert.equal(needsCharger(profile), true, JSON.stringify(profile));
    const charger = scoreSpot({ spotId: 'EV-1', distanceM: 250, evCharger: true }, profile);
    const plain = scoreSpot({ spotId: 'A-01', distanceM: 60, evCharger: false }, profile);
    assert.ok(charger.score > plain.score, 'charger should win for ' + JSON.stringify(profile));
    assert.ok(charger.reasons.includes('עמדת טעינה'));
    assert.ok(plain.reasons.includes('ללא עמדת טעינה'));
  }
});

test('a healthy battery leaves the charger bonus out of the score entirely', () => {
  const profile = { batteryPct: EV_LOW_PCT + 1 };
  assert.equal(needsCharger(profile), false);
  const charger = scoreSpot({ spotId: 'EV-1', distanceM: 250, evCharger: true }, profile);
  const plain = scoreSpot({ spotId: 'A-01', distanceM: 60 }, profile);
  assert.ok(plain.score > charger.score);
  assert.deepEqual(charger.reasons, ['250 מ׳ הליכה']);
});

test('an unknown battery level is treated as healthy, not as low', () => {
  for (const batteryPct of [undefined, null, 'low', NaN]) {
    assert.equal(needsCharger({ batteryPct }), false, String(batteryPct));
  }
});

test('a marginally better stall does not re-alert, a clearly better one does', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  alertsOf(agent.onEvent(freed({ spotId: 'A-07', distanceM: 200 })));

  // SWITCH_MARGIN is 1.5 points == 75 m, so 50 m closer is not worth a ping.
  assert.equal(agent.onEvent(freed({ spotId: 'A-05', distanceM: 150, at: T0 + 1000 })), null);
  assert.equal(agent.report().heldSpotId, 'A-07');

  const actions = agent.onEvent(freed({ spotId: 'A-01', distanceM: 20, at: T0 + 2000 }));
  assert.deepEqual(actions.map((a) => a.type), ['hold-release', 'driver-alert']);
  assert.equal(actions[0].spotId, 'A-07');
  assert.equal(actions[0].reason, 'upgraded');
  assert.equal(agent.report().heldSpotId, 'A-01');
});

test('the switch margin is what blocks the marginal re-alert', () => {
  const held = scoreSpot({ spotId: 'A-07', distanceM: 200 }, {});
  const marginal = scoreSpot({ spotId: 'A-05', distanceM: 150 }, {});
  assert.ok(marginal.score - held.score <= SWITCH_MARGIN);
});

test('tick releases the hold once the window closes, and only once', () => {
  const agent = createDriverAgent({ holdSeconds: 30 });
  agent.onEvent(waiting());
  agent.onEvent(freed());
  assert.equal(agent.tick(T0 + 29_000), null);
  const [release] = agent.tick(T0 + 30_000);
  assert.equal(release.type, 'hold-release');
  assert.equal(release.spotId, 'A-07');
  assert.equal(release.reason, 'expired');
  assert.match(release.textHe, /חלון השמירה הסתיים/);
  assert.equal(agent.tick(T0 + 60_000), null);
  assert.equal(agent.report().heldSpotId, null);
  assert.equal(agent.report().releases, 1);
});

test('after the hold expires the next freed stall is offered without a stale release', () => {
  const agent = createDriverAgent({ holdSeconds: 30 });
  agent.onEvent(waiting());
  agent.onEvent(freed());
  agent.tick(T0 + 30_000);
  const actions = agent.onEvent(freed({ spotId: 'B-02', distanceM: 390, at: T0 + 31_000 }));
  assert.deepEqual(actions.map((a) => a.type), ['driver-alert']);
});

test('a stall taken by someone else releases our hold', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  agent.onEvent(freed());
  assert.equal(agent.onEvent({ type: 'spot-taken', spotId: 'B-99', at: T0 + 1 }), null);
  const [release] = agent.onEvent({ type: 'spot-taken', spotId: 'A-07', at: T0 + 2 });
  assert.equal(release.reason, 'taken');
  assert.match(release.textHe, /התא נתפס/);
  assert.equal(agent.report().heldSpotId, null);
});

test('a driver who finished searching releases the hold and stops being alerted', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  agent.onEvent(freed());
  const [release] = agent.onEvent({ type: 'driver-done', at: T0 + 5 });
  assert.equal(release.reason, 'driver-done');
  assert.equal(agent.onEvent(freed({ at: T0 + 10 })), null);
  assert.equal(agent.report().waiting, false);
});

test('driver-done with nothing held is a no-op, not a phantom release', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  assert.deepEqual(agent.onEvent({ type: 'driver-done', at: T0 }), []);
});

test('the Waze link uses coordinates when known and a name search otherwise', () => {
  assert.equal(wazeLink({ lat: 32.1, lon: 34.84 }), 'https://waze.com/ul?ll=32.1%2C34.84&navigate=yes');
  assert.equal(wazeLink({ lotName: 'חניון פארק עתידים' }),
    'https://waze.com/ul?q=' + encodeURIComponent('חניון פארק עתידים') + '&navigate=yes');
  // A half-known position must not become a pin at 0,0 in the Gulf of Guinea.
  assert.match(wazeLink({ lat: 32.1, lotName: 'עתידים' }), /\?q=/);
  assert.match(wazeLink({ lat: 'x', lon: 'y', spotId: 'A-07' }), /\?q=A-07/);
});

test('a malformed spot-freed event is ignored rather than alerted on', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  assert.equal(agent.onEvent({ type: 'spot-freed', at: T0 }), null);
  assert.equal(scoreSpot(null, {}), null);
  assert.equal(scoreSpot({ distanceM: 10 }, {}), null);
});

test('a stall with no known distance ranks last, not first', () => {
  const unknown = scoreSpot({ spotId: 'A-09' }, {});
  const measured = scoreSpot({ spotId: 'A-01', distanceM: 20 }, {});
  assert.ok(unknown.score < measured.score, 'an unmeasured stall must not beat a close one');
  assert.deepEqual(unknown, scoreSpot({ spotId: 'A-09', distanceM: DEFAULT_MAX_WALK_M }, {}));
  // Still offered — just never preferred.
  assert.ok(unknown.score !== null);
});

test('an unrelated event type never moves the agent', () => {
  const agent = createDriverAgent();
  agent.onEvent(waiting());
  assert.equal(agent.onEvent({ type: 'occupancy-sample', hour: 9, rate: 0.9, at: T0 }), null);
  assert.equal(agent.report().alerts, 0);
});

test('the agent exposes the shared agent interface', () => {
  const agent = createDriverAgent();
  assert.equal(agent.name, 'driver');
  assert.equal(typeof agent.labelHe, 'string');
  for (const fn of ['onEvent', 'tick', 'report']) assert.equal(typeof agent[fn], 'function');
});
