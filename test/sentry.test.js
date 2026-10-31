// Sentry stays off unless a deploy step replaces the placeholder. The committed
// app must behave as it does today: no SDK request, no test error, no DSN.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const VALID = 'https://example@o0.ingest.sentry.io/1';

function fakeDocument() {
  const children = [];
  return {
    head: {
      children,
      appendChild(el) { children.push(el); return el; },
    },
    createElement() {
      return { src: '', integrity: '', crossOrigin: '', onload: null };
    },
  };
}

function loadInBrowser(doc) {
  const sandbox = { document: doc, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read('src/lib/sentry.js'), sandbox, { filename: 'src/lib/sentry.js' });
  return sandbox;
}

test('no DSN is committed; the deploy token appears once', () => {
  const src = read('src/lib/sentry.js');
  assert.equal((src.match(/__SENTRY_DSN__/g) || []).length, 1);
  assert.doesNotMatch(src, /https:\/\/[a-z0-9]+@[^\s"']*sentry\.io\/\d+/i);
  assert.match(src, /sendDefaultPii:\s*false/);
  assert.doesNotMatch(src, /replayIntegration|bundle\.replay|bundle\.tracing/);
  const readme = read('README.md');
  assert.match(readme, /SENTRY_DSN/);
  assert.match(readme, /__SENTRY_DSN__/);
});

test('the app works with no DSN and does not load Sentry', () => {
  const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const html = read(page);
    const n = (html.match(/src="src\/lib\/sentry\.js"/g) || []).length;
    const want = page === 'index.html' || page.startsWith('pilot-');
    assert.equal(n, want ? 1 : 0, page);
    if (!want) continue;
    const first = html.match(/<script[^>]*\ssrc="([^"]+)"/);
    assert.equal(first && first[1], 'src/lib/sentry.js', page + ' must load the gate first');
  }

  const doc = fakeDocument();
  const sandbox = loadInBrowser(doc);
  assert.equal(sandbox.ParkWizSentry.PLACEHOLDER, '__SENTRY_DSN__');
  assert.equal(doc.head.children.length, 0, 'placeholder must not inject the CDN');
  assert.equal(sandbox.ParkWizSentry.install({ document: doc, search: '?sentryTest=1' }).enabled, false);
  assert.equal(sandbox.ParkWizSentry.resolveDsn(''), '');
  assert.equal(sandbox.ParkWizSentry.resolveDsn('__SENTRY_DSN__'), '');
  assert.equal(sandbox.ParkWizSentry.resolveDsn('http://example@o0.ingest.sentry.io/1'), '');
  assert.equal(doc.head.children.length, 0);

  const index = read('index.html');
  assert.match(index, /class="eval-banner"/);
  assert.match(index, /leaflet\.js/);
  assert.ok(index.indexOf('src/lib/sentry.js') < index.indexOf('leaflet.js'));
  const sw = read('sw.js');
  assert.match(sw, /src\/lib\/sentry\.js/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 27);
});

test('with a DSN the errors-only SDK inits, scrubs media and location, and sends one test error', () => {
  const doc = fakeDocument();
  const sandbox = loadInBrowser(doc);
  const calls = [];
  let initOpts = null;
  const Sentry = {
    init(opts) { initOpts = opts; },
    captureException(err) { calls.push(err); },
  };
  const on = sandbox.ParkWizSentry.install({
    document: doc,
    dsn: VALID,
    search: '?sentryTest=1',
    getSentry() { return Sentry; },
  });
  assert.equal(on.enabled, true);
  const script = doc.head.children[0];
  assert.equal(script.src, sandbox.ParkWizSentry.SDK_SRC);
  assert.match(script.src, /\/11\.10\.0\/bundle\.min\.js$/);
  assert.equal(script.crossOrigin, 'anonymous');
  assert.match(script.integrity, /^sha384-/);
  script.onload();
  assert.equal(initOpts.sendDefaultPii, false);
  assert.equal(initOpts.replaysSessionSampleRate, 0);
  assert.equal(initOpts.replaysOnErrorSampleRate, 0);
  assert.equal(initOpts.dsn, VALID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].message, 'ParkWiz Sentry test error');

  const sent = initOpts.beforeSend({
    message: 'map failed',
    extra: {
      latitude: 32.33,
      longitude: 34.85,
      street: 'הרצל',
      png: 'data:image/png;base64,AAAA',
    },
    request: { url: 'https://tiles.example/x?lat=32.33&lng=34.85&q=1' },
  });
  assert.equal(sent.message, 'map failed');
  assert.equal(sent.extra.latitude, '[Filtered]');
  assert.equal(sent.extra.longitude, '[Filtered]');
  assert.equal(sent.extra.street, 'הרצל');
  assert.equal(sent.extra.png, '[Filtered]');
  assert.equal(sent.request.url, 'https://tiles.example/x?lat=[Filtered]&lng=[Filtered]&q=1');
  assert.equal(initOpts.beforeBreadcrumb({ message: 'data:video/webm;base64,AAAA' }), null);
  assert.equal(initOpts.beforeBreadcrumb({ message: 'click' }).message, 'click');

  const quiet = fakeDocument();
  const box = loadInBrowser(quiet);
  box.ParkWizSentry.install({
    document: quiet,
    dsn: VALID,
    search: '',
    getSentry() { return Sentry; },
  });
  const before = calls.length;
  quiet.head.children[0].onload();
  assert.equal(calls.length, before, 'a normal load must not send the test error');

  const dash = read('pilot-dashboard.html');
  assert.match(dash, /https:\/\/browser\.sentry-cdn\.com/);
  assert.match(dash, /https:\/\/\*\.sentry\.io/);
});
