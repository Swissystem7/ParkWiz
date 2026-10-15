// Buyer view (the default since 2d2ed99) credits no XP for an "אני עוזב"
// report (#113). But the 3-2-1 countdown card still ended with
// "תודה! +N XP לדיווח מפורט" for everyone, one second before the toast told the
// same city employee the report stayed in this browser (דמו). The card must
// follow the same driver-demo rule as doReportLeaving.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function fnBody(name) {
  const i = html.indexOf(`function ${name}(`);
  assert.ok(i > 0, `${name} exists`);
  return html.slice(i, html.indexOf('\n}\n', i));
}

test('the countdown card promises XP only inside the driver demo', () => {
  const body = fnBody('leavingSubmit');
  const xpLine = body.split('\n').find((l) => l.includes('XP לדיווח מפורט'));
  assert.ok(xpLine, 'the driver demo still celebrates the XP');
  assert.doesNotMatch(xpLine, /^\s*labelEl\.textContent = `/, 'the XP line is not assigned unconditionally');
  assert.match(body, /const driverDemo = document\.body\.classList\.contains\('consumer-demo-on'\)/);
  assert.match(body, /driverDemo\s*\?\s*`תודה! \+\$\{xpGain\} XP/, 'XP copy is behind the driver-demo switch');
  assert.match(body, /הדיווח נרשם בדפדפן הזה בלבד \(דמו\)/, 'buyer view gets the same "this browser only" wording as the toast');
});

test('the countdown card and the toast tell the buyer the same story', () => {
  const card = fnBody('leavingSubmit');
  const toast = fnBody('doReportLeaving');
  const wording = 'הדיווח נרשם בדפדפן הזה בלבד';
  assert.ok(card.includes(wording) && toast.includes(wording));
});
