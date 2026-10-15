// The buyer pages promise a city "בלי לוחיות" (offer.html) and "מה אין: זיהוי לוחיות"
// (pilot-brief.html); pilot-privacy.html commits "לא יזוהו לוחיות רישוי". The map
// demo's "אני עוזב" flow still asked for "מספר רכב שיצא (רשות)" and kept it in
// window.__lastLeavingPlate. The value was never used, so the field only cost trust:
// a city DPO who taps the demo sees the product collect a plate number.
// Found by the Grok bot's DPIA branch (ext/grok-bot-20260907-151336, PR #46).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('the map demo does not ask for or keep a licence plate number', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /id="leavingPlate"/, 'no plate input');
  assert.doesNotMatch(html, /מספר רכב/, 'no plate prompt text');
  assert.doesNotMatch(html, /__lastLeavingPlate/, 'no plate kept in memory');
  assert.doesNotMatch(html, /src="src\/lib\/plate\.js"/, 'the page does not load the plate helper');
});

test('the service worker no longer caches the unused plate helper', () => {
  assert.doesNotMatch(read('sw.js'), /plate\.js/);
});

test('the buyer promise stays the same: no plates', () => {
  assert.match(read('offer.html'), /בלי לוחיות/);
  assert.match(read('pilot-privacy.html'), /לא יזוהו לוחיות רישוי/);
});
