// Buyer view (the default since 2d2ed99) hides sign-up, XP and Premium. But the
// bottom-nav "אני עוזב!" tab still ran the sign-up gate, so a city employee who
// tapped it got a "צור חשבון חינם כדי להמשיך" wall asking for name, email and
// password, with XP copy. The gate belongs to the driver demo only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('the "אני עוזב" sign-up gate runs only inside the driver demo', () => {
  const i = html.indexOf('startLeaving = function()');
  assert.ok(i > 0, 'the gate wrapper exists');
  const body = html.slice(i, html.indexOf('};', i));
  assert.match(body, /consumer-demo-on/, 'the gate checks the driver-demo switch');
  const gateLine = body.split('\n').find((l) => l.includes("pwOpenAuth('signup'"));
  assert.ok(gateLine, 'the driver demo still asks for the demo sign-up');
  assert.match(gateLine, /consumer-demo-on/, 'sign-up opens only when the driver demo is on');
});

test('in buyer view a report earns no XP and the toast says it stayed in this browser', () => {
  const i = html.indexOf('function doReportLeaving(');
  const body = html.slice(i, html.indexOf('\n}\n', i));
  assert.match(body, /if \(driverDemo\) creditXp\(xpGain\)/);
  assert.match(body, /הדיווח נרשם בדפדפן הזה בלבד/);
});
