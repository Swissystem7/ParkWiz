// #267: the EV rule. A low battery changes the answer even when the driver
// never asked for a charger. Split out of test/agents-driver.test.js (PR #271,
// slice 5) so the rule has a named file of its own.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreSpot, needsCharger, EV_LOW_PCT } = require('../src/agents/driver');

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
