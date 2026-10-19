// The Atidim pilot one-pager (#262) is the page Roni, the park's parking
// manager, reads in the meeting. It is a promise sheet, so these assertions pin
// the parts that would be embarrassing to let drift: the four-week shape and
// the zero price, the two success metrics the decision hangs on, the privacy
// line (no plates, no stored video, runs in the browser), and the two things we
// ask of Atidim. The peak window is checked against the lot model so the page
// cannot quote an hour the demo chart does not draw.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lot = require('../src/lib/atidim-lot');
require('../src/lib/surface-nav');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const doc = read(path.join('docs', 'pilot-atidim.md'));
const page = read('pilot-atidim.html');

test('the one-pager states the business-park problem, not a street-parking one', () => {
  for (const text of [doc, page]) {
    assert.match(text, /שיא/, 'the morning peak is the problem');
    assert.match(text, /סבבים/);
    assert.match(text, /אין נתון חי לאיזה חניון יש מקום/);
    assert.match(text, /220/, 'the park is 220 spots across three zones');
  }
});

test('the peak window quoted is the one the lot model actually draws', () => {
  const peaks = lot.getHourlyCurve().filter((p) => p.isPeak);
  const window = peaks[0].label + '–' + peaks[peaks.length - 1].label;
  for (const text of [doc, page]) assert.ok(text.includes(window), 'must quote ' + window);
});

test('what ParkWiz gives: live count per lot, load picture, manager report, optional sign', () => {
  for (const text of [doc, page]) {
    assert.match(text, /מצלמות האבטחה הקיימות/, 'existing cameras, no new hardware');
    assert.match(text, /פנויים חי לכל חניון|מקומות פנויים חי/);
    assert.match(text, /שעתית/);
    assert.match(text, /דוח שעת בוקר/);
    assert.match(text, /שלט או מסך בכניסה/);
    assert.match(text, /אופציונלי/, 'the entrance screen is an add-on, not a promise');
  }
});

test('privacy: no plates, no stored video, processing in the browser', () => {
  for (const text of [doc, page]) {
    assert.match(text, /No LPR/);
    assert.match(text, /לוחיות רישוי/);
    assert.match(text, /וידאו לא נשמר/);
    assert.match(text, /בדפדפן/);
    assert.match(text, /אין אכיפה/);
  }
});

test('the pilot is four free weeks with both success metrics named up front', () => {
  for (const text of [doc, page]) {
    assert.match(text, /4 שבועות/);
    assert.match(text, /0 ₪/);
    assert.match(text, /סימון תאים/, 'week 1 marks the spots on one camera');
    assert.match(text, /2–3/, 'weeks 2-3 measure');
    assert.match(text, /דוח והחלטה/, 'week 4 reports and decides');
    assert.match(text, /דיוק ספירה מול בדיקה ידנית/);
    assert.match(text, /דקות שנחסכות בשעת שיא/);
  }
});

test('the ask from Atidim is one existing camera view and one contact person', () => {
  for (const text of [doc, page]) {
    assert.match(text, /מצלמה אחת קיימת/);
    assert.match(text, /RTSP\/ONVIF/);
    assert.match(text, /איש קשר אחד/);
    assert.match(text, /אין צורך להתקין מצלמה חדשה/);
  }
  // The honesty line the rest of the Atidim surfaces carry: the demo frame is
  // drawn in the browser and field accuracy is still unmeasured.
  assert.match(doc, /הדמיה/);
  assert.match(page, /class="banner"/);
  assert.match(page, /הדמיה/);
});

test('the page is a Hebrew RTL surface with no new dependencies, and is reachable', () => {
  assert.match(page, /lang="he"/);
  assert.match(page, /dir="rtl"/);
  assert.match(page, /class="skip-link"/);
  assert.doesNotMatch(page, /unpkg|cdnjs|googleapis|jsdelivr/i);
  assert.match(page, /href="\.\/docs\/pilot-atidim\.md"/, 'page links the doc');
  assert.match(page, /href="\.\/demo\/atidim\.html"/, 'page links the demo');

  // Linked from the demo footer, in the global nav, and in the offline shell.
  const demo = read(path.join('demo', 'atidim.html'));
  const footer = demo.slice(demo.indexOf('<footer'), demo.indexOf('</footer>'));
  assert.match(footer, /\.\.\/pilot-atidim\.html/, 'the demo footer must link the plan');
  const link = globalThis.ParkWizSurfaceNav.LINKS.find((l) => l.id === 'atidim-pilot');
  assert.ok(link, 'nav needs an Atidim pilot entry');
  assert.equal(link.href, './pilot-atidim.html');
  assert.match(page, /data-active="atidim-pilot"/);
  assert.match(read('sw.js'), /'\.\/pilot-atidim\.html'/);
});
