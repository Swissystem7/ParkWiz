const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// The owner decided on 28.9: the public contact channel for all his apps is his Google Form
// "משוב על האפליקציות", with the app field pre-filled as ParkWiz (an exact option of the form).
const OWNER_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=ParkWiz';

test('one CONTACT value lives in one config file: the owner\'s Google Form, no email or phone', () => {
  const src = read('src/lib/contact.js');
  const decls = src.match(/const CONTACT = '([^']*)';/g) || [];
  assert.equal(decls.length, 1, 'CONTACT must be a single string constant');
  const c = require('../src/lib/contact.js');
  assert.equal(c.CONTACT, OWNER_FORM);
  assert.equal(c.contactHref(c.CONTACT), OWNER_FORM, 'an https form link is used as is');
  assert.doesNotMatch(c.CONTACT, /@|tel:|wa\.me/);
});

// A tiny DOM, enough for mountContact.
function fakeDom() {
  const make = (tag) => ({ tag, children: [], attrs: {}, style: {}, hidden: false, textContent: '', href: '',
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    appendChild(ch) { this.children.push(ch); return ch; }, replaceChildren() { this.children = []; } });
  return { make, document: { createElement: make } };
}

test('the contact block links to the form with a short label (no raw URL), opens it in a new tab', () => {
  const c = require('../src/lib/contact.js');
  const dom = fakeDom();
  globalThis.document = dom.document;
  globalThis.location = { pathname: '/offer.html' };
  try {
    const host = dom.make('div');
    host.setAttribute('data-source', 'offer');
    c.mountContact(host);
    const link = host.children.find((ch) => ch.tag === 'a');
    assert.ok(link, 'the block has a link');
    assert.equal(link.href, OWNER_FORM);
    assert.equal(link.hidden, false);
    assert.equal(link.target, '_blank');
    assert.match(link.rel, /noopener/);
    assert.match(link.textContent, /טופס Google/);
    assert.doesNotMatch(link.textContent, /https?:/, 'a 150-character URL as the label would overflow a phone');
    assert.ok(!host.children.some((ch) => ch.className === 'pw-contact-issue'), 'the GitHub fallback steps aside');
  } finally {
    delete globalThis.document;
    delete globalThis.location;
  }
});

test('changed cached pages: the service worker cache moved to v9', () => {
  assert.match(read('sw.js'), /const CACHE = 'parkwiz-field-v9';/);
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

test('offer page: the buyer CTA goes to the contact block, the outreach form is labeled as the developer tool', () => {
  const html = read('offer.html');
  const cta = html.match(/<a class="primary" href="([^"]+)"[^>]*>([^<]+)<\/a>/);
  assert.ok(cta, 'primary CTA exists');
  assert.equal(cta[1], '#pwContact', 'a city employee must land on a way to reach us, not on our own outreach form');
  const book = html.slice(html.indexOf('id="book"'), html.indexOf('id="book"') + 400);
  assert.match(book, /<h2>למפתח:/);
});
