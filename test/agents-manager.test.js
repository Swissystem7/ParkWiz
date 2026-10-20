// The manager agent writes the line an operator reads in the morning and the
// alert that pulls them out of a meeting, so these tests pin both: the Hebrew
// summary is built from what actually happened, and an anomaly fires once —
// an alert that repeats every sample is an alert nobody reads.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createManagerAgent, hourLabel,
  PEAK_RATE, FULL_RATE, EARLY_HOUR, DROP_DELTA, MINUTES_SAVED_PER_ALERT,
} = require('../src/agents/manager');

const T0 = 1_700_000_000_000;
const sample = (hour, rate, at) => ({ type: 'occupancy-sample', hour, rate, at: at === undefined ? T0 : at });

function feed(agent, pairs) {
  const actions = [];
  pairs.forEach(([hour, rate], i) => {
    const out = agent.onEvent(sample(hour, rate, T0 + i * 1000));
    if (out) actions.push(...out);
  });
  return actions;
}

test('an empty day reports honestly instead of claiming a 0% peak', () => {
  const report = createManagerAgent({ lotName: 'חניון פארק עתידים' }).report();
  assert.equal(report.samples, 0);
  assert.equal(report.busiestHour, null);
  assert.deepEqual(report.peakHours, []);
  assert.match(report.textHe, /אין נתוני תפוסה עדיין/);
  assert.match(report.textHe, /^סיכום יומי — חניון פארק עתידים/);
});

test('the summary names the busiest hour and every hour above the peak line', () => {
  const agent = createManagerAgent({ lotName: 'עתידים' });
  feed(agent, [[7, 0.42], [8, 0.76], [9, 0.89], [10, 0.92], [11, 0.9]]);
  const report = agent.report();
  assert.equal(report.busiestHour, 10);
  assert.deepEqual(report.peakHours, [9, 10, 11]);
  assert.equal(report.samples, 5);
  assert.match(report.textHe, /שיא תפוסה 92% ב-10:00/);
  assert.match(report.textHe, /שעות שיא: 09:00, 10:00, 11:00/);
  assert.match(report.textHe, /5 מדידות תפוסה/);
});

test('the peak line is the documented threshold, not a hard-coded 0.9', () => {
  const agent = createManagerAgent();
  feed(agent, [[8, PEAK_RATE], [9, PEAK_RATE - 0.01]]);
  assert.deepEqual(agent.report().peakHours, [8]);
});

test('the hour keeps its highest rate of the day, not its latest', () => {
  const agent = createManagerAgent();
  feed(agent, [[10, 0.92], [10, 0.6]]);
  assert.equal(agent.report().busiestHour, 10);
  assert.match(agent.report().textHe, /שיא תפוסה 92%/);
});

test('driver alerts are counted from the bus and converted to a stated assumption', () => {
  const agent = createManagerAgent();
  for (let i = 0; i < 3; i++) agent.onEvent({ type: 'driver-alert', spotId: 'A-0' + i, at: T0 });
  const report = agent.report();
  assert.equal(report.alerts, 3);
  assert.equal(report.minutesSaved, 3 * MINUTES_SAVED_PER_ALERT);
  assert.match(report.textHe, /3 התראות נשלחו לנהגים/);
  assert.match(report.textHe, new RegExp('~' + 3 * MINUTES_SAVED_PER_ALERT + ' דק׳ חיפוש נחסכו'));
  // The number must never be presented as measured.
  assert.match(report.textHe, /הנחת דמו/);
});

test('a lot full before the morning curve says so raises a full-early anomaly', () => {
  const agent = createManagerAgent();
  const actions = agent.onEvent(sample(7, 0.97));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'manager-anomaly');
  assert.equal(actions[0].kind, 'full-early');
  assert.equal(actions[0].hour, 7);
  assert.match(actions[0].textHe, /97%/);
  assert.match(actions[0].textHe, /כבר ב-07:00/);
  assert.match(actions[0].textHe, /מוקדם מהעקומה האופיינית/);
});

test('the same lot being full all morning alerts once per hour, not per sample', () => {
  const agent = createManagerAgent();
  assert.equal(feed(agent, [[7, 0.97], [7, 0.98], [7, 0.99]]).length, 1);
  assert.equal(feed(agent, [[8, 0.97]]).length, 1);
  assert.equal(agent.report().anomalies.length, 2);
});

test('a full lot at a genuinely busy hour is not an anomaly', () => {
  const agent = createManagerAgent();
  assert.deepEqual(feed(agent, [[EARLY_HOUR, FULL_RATE], [12, 0.99]]), []);
  assert.deepEqual(agent.report().anomalies, []);
});

test('a lot that is merely busy early is not an anomaly either', () => {
  const agent = createManagerAgent();
  assert.deepEqual(feed(agent, [[7, FULL_RATE - 0.01]]), []);
});

test('a sudden occupancy drop is flagged as a possible camera fault', () => {
  const agent = createManagerAgent();
  const actions = feed(agent, [[11, 0.9], [11, 0.9 - DROP_DELTA]]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'sudden-drop');
  assert.match(actions[0].textHe, /צניחה חדה בתפוסה מ-90% ל-65%/);
  assert.match(actions[0].textHe, /בדקו אם מצלמה ירדה או קפאה/);
});

test('an ordinary evening emptying out is not a sudden drop', () => {
  const agent = createManagerAgent();
  assert.deepEqual(feed(agent, [[17, 0.52], [18, 0.34], [19, 0.22], [20, 0.16]]), []);
});

test('a rise in occupancy is never read as a drop', () => {
  const agent = createManagerAgent();
  assert.deepEqual(feed(agent, [[7, 0.18], [8, 0.76]]), []);
});

test('past midnight the day rolls over and the closing summary is emitted first', () => {
  const agent = createManagerAgent({ lotName: 'עתידים' });
  feed(agent, [[22, 0.11], [23, 0.09]]);
  for (let i = 0; i < 2; i++) agent.onEvent({ type: 'driver-alert', at: T0 });
  const actions = agent.onEvent(sample(0, 0.08, T0 + 60_000));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'manager-summary');
  assert.match(actions[0].textHe, /2 התראות נשלחו לנהגים/);
  assert.match(actions[0].textHe, /שיא תפוסה 11% ב-22:00/);
  // The new day starts clean: yesterday's alerts are not carried forward.
  const report = agent.report();
  assert.equal(report.alerts, 0);
  assert.equal(report.samples, 1);
  assert.equal(report.busiestHour, 0);
});

test('a malformed or out-of-range sample is ignored rather than counted', () => {
  const agent = createManagerAgent();
  for (const hour of [undefined, null, -1, 24, 9.5, 'nine', NaN]) {
    assert.equal(agent.onEvent(sample(hour, 0.9)), null, 'hour ' + String(hour));
  }
  // null is the dangerous one: recorded as 0% it reads as "the lot emptied".
  for (const rate of [undefined, null, '', 'high', NaN, {}]) {
    assert.equal(agent.onEvent(sample(9, rate)), null, 'rate ' + String(rate));
  }
  assert.equal(agent.report().samples, 0);
});

test('a rate outside 0..1 is clamped instead of reported as 300%', () => {
  const agent = createManagerAgent();
  feed(agent, [[10, 3], [11, -2]]);
  assert.match(agent.report().textHe, /שיא תפוסה 100% ב-10:00/);
  assert.equal(agent.report().samples, 2);
});

test('hourLabel is a two-digit wall clock and wraps rather than printing 24:00', () => {
  assert.equal(hourLabel(0), '00:00');
  assert.equal(hourLabel(9), '09:00');
  assert.equal(hourLabel(23), '23:00');
  assert.equal(hourLabel(24), '00:00');
  assert.equal(hourLabel(-1), '23:00');
});

test('the anomaly list handed out is a copy, so the panel cannot edit the day', () => {
  const agent = createManagerAgent();
  agent.onEvent(sample(7, 0.97));
  agent.report().anomalies.push({ kind: 'forged' });
  assert.equal(agent.report().anomalies.length, 1);
});

test('the agent exposes the shared agent interface and needs no timer', () => {
  const agent = createManagerAgent();
  assert.equal(agent.name, 'manager');
  assert.equal(typeof agent.labelHe, 'string');
  for (const fn of ['onEvent', 'tick', 'report']) assert.equal(typeof agent[fn], 'function');
  assert.equal(agent.tick(T0), null);
});
