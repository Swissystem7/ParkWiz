// End-to-end for the unified pilot flow (#268), the whole product in one test:
// the sample clip asset is decoded, every frame runs through the occupancy
// engine, a departure raises a spot-freed event, and the driver surface of
// demo/pilot.html ends up showing an alert with a live hold and a nav link.
//
// It runs the page's real inline script against a stub DOM — a parse test
// cannot catch a renamed export or a mistyped element id, and a blank driver
// card in front of the operator is this demo's whole failure mode. fetch is
// stubbed with a synchronous thenable so the clip arrives without a real
// event loop, which keeps the assertions readable.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'pilot.html'), 'utf8');
const clip = JSON.parse(fs.readFileSync(path.join(root, 'pilot', 'sample-clip.json'), 'utf8'));

function inlineScript() {
  const m = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(m, 'the flow page must have an inline script');
  return m[1];
}

function markupIds() {
  return new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
}

// Elements the markup ships hidden (the driver alert card, the three inactive
// panes). The stub has to start where the browser starts, or a test could pass
// on a card the real page never shows.
function hiddenIds() {
  const out = new Set();
  for (const m of html.matchAll(/<[a-z0-9]+\s[^>]*id="([^"]+)"[^>]*>/gi)) {
    if (/\shidden(\s|>|$)/.test(m[0])) out.add(m[1]);
  }
  return out;
}

function makeElement(tag, hidden) {
  return {
    tag,
    hidden: Boolean(hidden),
    textContent: '',
    className: '',
    style: {},
    attrs: {},
    children: [],
    handlers: {},
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    fire(type, event) {
      (this.handlers[type] || []).forEach((fn) => fn.call(this, event || { preventDefault() {} }));
    },
  };
}

// fetch().then(r => r.json()).then(...) without a real microtask queue.
function syncThenable(value) {
  return {
    then(onValue) {
      const out = onValue(value);
      return (out && typeof out.then === 'function') ? out : syncThenable(out);
    },
    catch() { return this; },
  };
}

function runPage(options) {
  const opts = options || {};
  const ids = markupIds();
  const hidden = hiddenIds();
  const elements = new Map();
  const timers = [];
  const fetched = [];

  const document = {
    getElementById(id) {
      assert.ok(ids.has(id), 'the script asks for #' + id + ' which is not in the markup');
      if (!elements.has(id)) elements.set(id, makeElement('div', hidden.has(id)));
      return elements.get(id);
    },
    createElement: (tag) => makeElement(tag, false),
  };

  const hostHandlers = {};
  const sandbox = {
    document,
    navigator: { userAgent: 'node-test' },
    location: { hash: opts.hash || '', protocol: 'file:' },
    localStorage: opts.storage || (function () {
      const map = new Map();
      return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
    })(),
    addEventListener(type, fn) { (hostHandlers[type] = hostHandlers[type] || []).push(fn); },
    fetch(url) {
      fetched.push(url);
      if (opts.failFetch) return { then() { return this; }, catch(cb) { cb(new Error('offline')); return this; } };
      return syncThenable({ json: () => syncThenable(clip) });
    },
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    clearInterval: () => {},
  };
  vm.createContext(sandbox);
  // window *is* the global, as in a browser: the libraries are UMD and hang
  // themselves off it, and the page's localStorage calls have to reach the
  // stub above rather than the Node process global.
  sandbox.window = vm.runInContext('this', sandbox);
  for (const lib of ['src/lib/atidim-lot.js', 'src/lib/pilot-flow.js']) {
    new vm.Script(fs.readFileSync(path.join(root, lib), 'utf8'), { filename: lib }).runInContext(sandbox);
  }
  new vm.Script(inlineScript(), { filename: 'demo/pilot.html' }).runInContext(sandbox);

  const el = (id) => document.getElementById(id);
  return {
    el,
    elements,
    timers,
    fetched,
    window: sandbox.window,
    step() { el('btnStep').fire('click'); },
  };
}

test('the page boots on the sample clip: KPIs, sign and an empty driver card', () => {
  const page = runPage();
  assert.deepEqual(page.fetched, ['../pilot/sample-clip.json'], 'the clip is the default camera source');
  // The page lives in demo/, so its relative fetch has to land on the asset
  // the service worker precaches from the repo root.
  assert.ok(fs.existsSync(path.resolve(root, 'demo', page.fetched[0])), 'the clip URL must resolve on disk');
  assert.equal(page.el('clipPos').textContent, 'פריים 1 מתוך ' + clip.frames.length);
  assert.match(page.el('flowStatus').textContent, /קליפ הדוגמה נטען/);
  assert.equal(page.el('clipNote').textContent, clip.noteHe);
  // The first frame is a cold start: counters yes, departure alert no.
  assert.equal(page.el('driverAlert').hidden, true);
  assert.equal(page.el('driverEmpty').hidden, false);
  const free = Number(page.el('mFree').textContent);
  const occupied = Number(page.el('mOcc').textContent);
  assert.ok(Number.isInteger(free) && Number.isInteger(occupied));
  assert.equal(free + occupied, 220, 'free + occupied must equal the lot capacity');
  assert.match(page.el('mPct').textContent, /^\d{1,3}%$/);
  assert.equal(page.el('mEv').textContent, '0 / 2');
  // The sign is the same number the manager sees, never its own count.
  assert.equal(page.el('signNum').textContent, String(free));
  assert.equal(page.el('signWord').textContent, 'מקומות פנויים');
  assert.match(page.el('driverFree').textContent, /בחניון כרגע: \d+ מתוך 220 פנויים/);
});

test('sample clip to driver alert: a departure reaches the driver with a hold and a nav link', () => {
  const page = runPage();
  page.step(); // frame 2 — nothing changes
  assert.equal(page.el('driverAlert').hidden, true);
  page.step(); // frame 3 — bay A-09 empties
  assert.equal(page.el('driverAlert').hidden, false, 'the driver surface must show the freed bay');
  assert.equal(page.el('driverEmpty').hidden, true);
  assert.equal(page.el('driverHead').textContent, 'התפנה תא חניה A-09');
  assert.match(page.el('driverBody').textContent, /חיזוי, לא הבטחה/);
  assert.match(page.el('driverBody').textContent, /מקור: קליפ דוגמה/);
  assert.match(page.el('driverHold').textContent, /^מוחזק עבורך עוד \d{2}:\d{2}$/);
  assert.match(page.el('driverNav').href, /^https:\/\/waze\.com\/ul\?ll=/);
  assert.equal(page.el('driverAlert').className, 'alert');
  // The same event lands in the manager's log, off the one bus.
  assert.equal(page.el('eventEmpty').hidden, true);
  const logged = page.el('eventLog').children.map((li) => li.textContent);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /^תא A-09 התפנה · שנייה \d+ בקליפ · מקור: קליפ דוגמה$/);
  // Releasing the hold puts the driver surface back to its empty state.
  page.el('btnRelease').fire('click');
  assert.equal(page.el('driverAlert').hidden, true);
  assert.match(page.el('flowStatus').textContent, /ההחזקה שוחררה/);
});

test('the charging bay that empties later is announced as a charger', () => {
  const page = runPage();
  // Boot shows frame 1, so this walks to the last frame without looping back.
  for (let i = 1; i < clip.frames.length; i++) page.step();
  const logged = page.el('eventLog').children.map((li) => li.textContent);
  assert.ok(logged.some((line) => /עמדת טעינה/.test(line)), 'the EV bay must be marked in the log');
  assert.equal(page.el('mEv').textContent, '1 / 2');
});

test('the one nav switches surfaces in place and marks the current one', () => {
  const page = runPage();
  const links = page.el('flowNav').children;
  const FLOW = page.window.ParkWizPilotFlow;
  // Array.from keeps both sides in this realm: FLOW lives in the page's vm context.
  assert.deepEqual(links.map((a) => a.textContent), Array.from(FLOW.SURFACES, (s) => s.labelHe));
  assert.deepEqual(links.map((a) => a.href), Array.from(FLOW.SURFACES, (s) => s.hash));
  // Driver is the default surface.
  assert.equal(links[0].getAttribute('aria-current'), 'page');
  assert.equal(page.el('paneDriver').hidden, false);
  assert.equal(page.el('paneSign').hidden, true);
  links[2].fire('click'); // שלט כניסה
  assert.equal(page.el('paneSign').hidden, false);
  assert.equal(page.el('paneDriver').hidden, true);
  assert.equal(links[2].getAttribute('aria-current'), 'page');
  assert.equal(links[0].getAttribute('aria-current'), null);
  assert.equal(page.window.location.hash, '#sign');
});

test('a deep link opens straight on the operator surface', () => {
  const page = runPage({ hash: '#manager' });
  assert.equal(page.el('paneManager').hidden, false);
  assert.equal(page.el('paneDriver').hidden, true);
});

test('the settings surface drives the one source list and persists the choice', () => {
  const map = new Map();
  const storage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
  const page = runPage({ storage });
  const FLOW = page.window.ParkWizPilotFlow;
  const labels = page.el('sourceList').children.map((row) => row.children[1].textContent);
  assert.deepEqual(labels, Array.from(FLOW.SOURCES, (s) => s.labelHe));
  // Only the Frigate bridge needs an address, so only it shows the field.
  assert.equal(page.el('frigateRow').hidden, true);
  const frigateRadio = page.el('sourceList').children[2].children[0];
  frigateRadio.checked = true;
  frigateRadio.fire('change');
  assert.equal(page.el('frigateRow').hidden, false);
  assert.match(page.el('settingsNote').textContent, /מקור פעיל: גשר Frigate/);
  assert.equal(FLOW.loadSettings(storage).sourceId, 'frigate');
  // Switching the camera clears any live alert: a new source is a cold start.
  assert.equal(page.el('driverAlert').hidden, true);

  page.el('evOnly').checked = true;
  page.el('holdSeconds').value = '300';
  page.el('btnSave').fire('click');
  const saved = FLOW.loadSettings(storage);
  assert.equal(saved.evOnly, true);
  assert.equal(saved.holdSeconds, 300);
  page.el('btnRestore').fire('click');
  assert.equal(FLOW.loadSettings(storage).sourceId, 'sample');
  assert.equal(FLOW.loadSettings(storage).evOnly, false);
});

test('play toggles the clip and the page ticks the hold countdown', () => {
  const page = runPage();
  assert.ok(page.timers.length >= 1, 'the page must schedule the hold countdown');
  const play = page.el('btnPlay');
  play.fire('click');
  assert.equal(play.getAttribute('aria-pressed'), 'true');
  assert.equal(play.textContent, 'עצור את הקליפ');
  const framesAdvanced = page.timers.length;
  page.timers.forEach((fn) => fn()); // the countdown tick and one clip frame
  assert.ok(framesAdvanced >= 2, 'playing must schedule the frame timer');
  play.fire('click');
  assert.equal(play.getAttribute('aria-pressed'), 'false');
  assert.equal(play.textContent, 'הפעל את הקליפ');
});

test('a clip that cannot be fetched says so instead of failing silently', () => {
  const page = runPage({ failFetch: true });
  assert.match(page.el('flowStatus').textContent, /קליפ הדוגמה לא נטען/);
  assert.equal(page.el('driverAlert').hidden, true);
  page.step(); // no frames: must not throw, and must not claim a frame either
  assert.doesNotMatch(page.el('clipPos').textContent, /פריים/);
});

test('the flow page is Hebrew RTL, local-only, and honest about the camera', () => {
  assert.match(html, /<html lang="he" dir="rtl">/);
  assert.doesNotMatch(html, /unpkg|cdnjs|googleapis/i);
  assert.match(html, /class="banner"/);
  assert.match(html, /לא שידור חי|ולא שידור חי/);
  assert.match(html, /אין לוחיות רישוי/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /src="\.\.\/src\/lib\/pilot-flow\.js"/);
  assert.match(html, /src="\.\.\/src\/lib\/atidim-lot\.js"/);
});
