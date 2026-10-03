// The in-app "משוב" button used to save feedback only in the visitor's browser,
// so nothing ever reached the developer. The owner runs one Google Form for all
// the apps ("משוב על האפליקציות", app dropdown includes ParkWiz, asks for no
// personal details). The factory branch ext/feature-code-20260927-143034-1100
// found its URL; this makes the button reach it, honestly labeled.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform';

function overlay() {
  const start = html.indexOf('id="pwFbOverlay"');
  assert.ok(start > 0, 'feedback overlay exists');
  return html.slice(start, html.indexOf('</div>\n</div>', start));
}

test('the feedback overlay links to the owner feedback form, prefilled with ParkWiz, in a new tab', () => {
  const box = overlay();
  const a = box.match(/<a id="pwFbForm" href="([^"]+)"([^>]*)>([^<]+)<\/a>/);
  assert.ok(a, 'a real "send feedback" link must exist in the overlay');
  const url = new URL(a[1].replace(/&amp;/g, '&'));
  assert.equal(url.origin + url.pathname, FORM);
  assert.equal(url.searchParams.get('entry.368039752'), 'ParkWiz', 'the app dropdown is prefilled');
  assert.match(a[2], /target="_blank"/);
  assert.match(a[2], /rel="noopener"/);
  assert.match(a[3], /משוב/);
});

test('the overlay says where the text goes and asks for no personal details', () => {
  const box = overlay();
  assert.match(box, /Google/, 'the visitor is told the form is an outside service');
  assert.match(box, /בלי פרטים אישיים/);
  assert.doesNotMatch(box, /לא נשלח אלינו\. כדי שנקרא אותו/, 'the old "only local" dead end is gone');
});

test('the privacy text names the outside feedback form', () => {
  const privacy = html.slice(html.indexOf("privacy: { title:"), html.indexOf("function pwOpenLegal"));
  assert.match(privacy, /טופס Google/);
  assert.match(privacy, /רק אם/, 'sending is opt-in');
});

test('index.html changed, so the service worker cache moved past v7', () => {
  const v = Number((sw.match(/parkwiz-field-v(\d+)/) || [])[1]);
  assert.ok(v >= 8, 'cache version ' + v);
});

test('links inside the dark modals get a light color (the default blue was unreadable on the dark panel)', () => {
  assert.match(html, /\.pw-modal a\{color:#7dd3fc/);
});
