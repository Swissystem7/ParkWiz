// Edge cases of src/lib/contact.js: what counts as a reachable contact value,
// the public GitHub fallback text, and mounting into a stub DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const contact = require('../src/lib/contact');

test('contactHref rejects empty, malformed and unsafe values', () => {
  for (const v of [null, undefined, '', '   ', 'no-at-sign.com', 'a@b', 'a@@b.com',
    'http://insecure.example', 'javascript:alert(1)', '<script>@x.com', '12345']) {
    assert.equal(contact.contactHref(v), null, String(v));
  }
});

test('contactHref accepts email, https and phone numbers', () => {
  assert.equal(contact.contactHref(' dev@example.org '), 'mailto:dev@example.org');
  assert.equal(contact.contactHref('https://forms.gle/abc'), 'https://forms.gle/abc');
  assert.equal(contact.contactHref('050-123-4567'), 'https://wa.me/972501234567');
  assert.equal(contact.contactHref('+972 (50) 1234567'), 'https://wa.me/972501234567');
});

test('issueUrl warns that the issue is public and records the source page', () => {
  const url = contact.issueUrl('atidim-board.html');
  assert.ok(url.startsWith(contact.REPO + '/issues/new?title='));
  const body = decodeURIComponent(url.split('&body=')[1]);
  assert.match(body, /ציבורי/);
  assert.match(body, /atidim-board\.html/);
  assert.match(decodeURIComponent(contact.issueUrl()), /unknown/);
});

function stubDocument() {
  const make = (tag) => {
    const el = {
      tag, attrs: {}, children: [], style: {}, hidden: false, className: '', textContent: '',
      setAttribute(k, v) { el.attrs[k] = v; },
      getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
      appendChild(c) { el.children.push(c); return c; },
      replaceChildren() { el.children = []; },
    };
    return el;
  };
  return { make, doc: { createElement: make } };
}

test('mountContact does nothing without a host or a document', () => {
  assert.equal(contact.mountContact(null), undefined);
  const { make } = stubDocument();
  assert.equal(contact.mountContact(make('div')), undefined); // no global document in node
});

test('mountContact renders the direct form link with a privacy hint', () => {
  const { make, doc } = stubDocument();
  const prevDoc = globalThis.document;
  const prevLoc = globalThis.location;
  globalThis.document = doc;
  globalThis.location = { pathname: '/demo/atidim-board.html' };
  try {
    const host = make('div');
    contact.mountContact(host);
    assert.equal(host.className, 'pw-contact');
    assert.equal(host.attrs.role, 'region');
    const link = host.children.find((c) => c.className === 'pw-contact-direct');
    assert.ok(link, 'direct link rendered');
    assert.equal(link.hidden, false);
    assert.equal(link.href, contact.contactHref(contact.CONTACT));
    assert.equal(link.target, '_blank');
    assert.match(link.textContent, /טופס/);
    assert.ok(host.children.some((c) => /בלי פרטים אישיים/.test(c.textContent)));
  } finally {
    globalThis.document = prevDoc;
    globalThis.location = prevLoc;
  }
});
