const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// Minimal fake DOM: just enough for surface-nav.js to boot and mount.
function fakeElement(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    attrs: {},
    className: '',
    textContent: '',
    style: {},
    appendChild(child) { el.children.push(child); return child; },
    replaceChildren() { el.children = []; },
    setAttribute(name, value) { el.attrs[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null; },
  };
  return el;
}

const fakeDocument = {
  readyState: 'complete',
  head: fakeElement('head'),
  getElementById() { return null; },
  createElement: fakeElement,
  addEventListener() {},
};

globalThis.document = fakeDocument;
require('../src/lib/surface-nav');
const { LINKS, mountSurfaceNav } = globalThis.ParkWizSurfaceNav;

function navHosts() {
  const hosts = [];
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith('.html')) continue;
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    const m = html.match(/id="pwSurfaceNav"[^>]*data-active="([^"]*)"/);
    if (m) hosts.push({ page: name, active: m[1] });
  }
  return hosts;
}

test('every nav link has a unique id and points at a file that exists', () => {
  const ids = new Set();
  for (const link of LINKS) {
    assert.ok(!ids.has(link.id), `duplicate nav id ${link.id}`);
    ids.add(link.id);
    const target = link.href === './' ? 'index.html' : link.href.replace(/^\.\//, '');
    assert.ok(fs.existsSync(path.join(root, target)), `${link.id} -> ${link.href} is missing`);
    assert.ok(link.label.trim().length > 0, `${link.id} needs a label`);
  }
});

// Regression: pilot-summary.html declared data-active="summary" but the shared
// nav had no such id, so the summary surface was unreachable from the nav and
// rendered without a current-page marker.
test('every surface that mounts the nav is a known nav id', () => {
  const hosts = navHosts();
  assert.ok(hosts.length >= 14, `expected the nav on every surface, found ${hosts.length}`);
  const ids = new Set(LINKS.map((l) => l.id));
  for (const { page, active } of hosts) {
    assert.ok(ids.has(active), `${page} uses data-active="${active}" which is not in LINKS`);
    const link = LINKS.find((l) => l.id === active);
    const target = link.href === './' ? 'index.html' : link.href.replace(/^\.\//, '');
    assert.equal(target, page, `${page} marks "${active}" active but that link goes to ${target}`);
  }
});

test('the read-only summary is reachable from the nav and marked as the current page', () => {
  const summary = LINKS.find((l) => l.id === 'summary');
  assert.ok(summary, 'nav needs a summary entry');
  assert.equal(summary.href, './pilot-summary.html');

  const host = fakeElement('div');
  host.setAttribute('data-active', 'summary');
  mountSurfaceNav(host);

  const current = host.children.filter((c) => c.getAttribute('aria-current') === 'page');
  assert.equal(current.length, 1, 'exactly one current-page marker');
  assert.equal(current[0].tagName, 'SPAN');
  assert.equal(current[0].textContent, summary.label);
  const anchors = host.children.filter((c) => c.tagName === 'A');
  assert.equal(anchors.length, LINKS.length - 1, 'every other surface stays a link');
  assert.ok(anchors.every((a) => a.href !== './pilot-summary.html'));
});
