const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('one CONTACT value lives in one config file and ships empty (no invented details)', () => {
  const src = read('src/lib/contact.js');
  const decl = src.match(/const CONTACT = '([^']*)';/);
  assert.ok(decl, 'CONTACT must be a single string constant');
  assert.equal(decl[1], '', 'the owner fills CONTACT; agents never invent it');
  const c = require('../src/lib/contact.js');
  assert.equal(c.CONTACT, '');
});

test('contactHref turns one value into a mailto, WhatsApp or https link and rejects junk', () => {
  const { contactHref } = require('../src/lib/contact.js');
  assert.equal(contactHref(''), null);
  assert.equal(contactHref('   '), null);
  assert.equal(contactHref('someone@example.com'), 'mailto:someone@example.com');
  assert.equal(contactHref('052-1234567'), 'https://wa.me/972521234567');
  assert.equal(contactHref('+972 52 123 4567'), 'https://wa.me/972521234567');
  assert.equal(contactHref('https://example.com/form'), 'https://example.com/form');
  assert.equal(contactHref('javascript:alert(1)'), null);
  assert.equal(contactHref('12'), null);
});

test('while CONTACT is empty the fallback is a Hebrew GitHub Issue form for this repo', () => {
  const { issueUrl } = require('../src/lib/contact.js');
  const url = new URL(issueUrl('offer'));
  assert.equal(url.origin + url.pathname, 'https://github.com/Swissystem7/ParkWiz/issues/new');
  const title = url.searchParams.get('title');
  const body = url.searchParams.get('body');
  assert.match(title, /פנייה/);
  assert.match(body, /רשות/);
  assert.match(body, /ציבורי/, 'must warn that an issue is public');
  assert.match(body, /offer/);
});

test('buyer surfaces mount the contact block and load the config', () => {
  for (const f of ['offer.html', 'pilot-brief.html', 'index.html']) {
    const html = read(f);
    assert.match(html, /id="pwContact"/, f + ' needs the contact host');
    assert.match(html, /src="src\/lib\/contact\.js"/, f + ' must load contact.js');
  }
  const sw = read('sw.js');
  assert.match(sw, /\.\/src\/lib\/contact\.js/);
});
