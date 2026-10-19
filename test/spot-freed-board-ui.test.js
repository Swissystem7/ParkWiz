// Boots the inline script of demo/atidim-board.html with src/lib/spot-freed.js
// present, which atidim-board-page.test.js deliberately does not do — that
// harness pins the counters and the canvas, this one pins the "a bay freed"
// feed: the core value of EPIC #265, shown live in the CityZone meeting.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'atidim-board.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');
const marginLib = require('../src/lib/margin');
const sf = require('../src/lib/spot-freed');

const inline = html.match(/<script>([\s\S]*?)<\/script>/);

// 10:30 Jerusalem — mid-morning, 13 of 18 bays taken, the hour the demo opens on.
const FIXED = '2026-10-19T07:30:00Z';
const OPEN_HOUR = 10;
const EVENING_HOUR = 19;
const TOTAL = 18;

function fakeEl(tag) {
  const el = {
    tagName: tag || 'div',
    textContent: '',
    innerHTML: '',
    value: '',
    className: '',
    hidden: false,
    children: [],
    attrs: {},
    handlers: {},
    style: {},
    setAttribute(k, v) { el.attrs[k] = v; },
    addEventListener(t, fn) { el.handlers[t] = fn; },
    appendChild(child) { el.children.push(child); return child; },
    replaceChildren() { el.children.length = 0; },
  };
  return el;
}

function noopCtx() {
  const ctx = { texts: [], setTransform() {}, fillRect() {}, strokeRect() {}, fill() {}, stroke() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arcTo() {}, setLineDash() {},
    roundRect() {}, fillText(t) { ctx.texts.push(String(t)); } };
  return ctx;
}

async function boot() {
  const ctx = noopCtx();
  const els = new Map();
  const canvas = fakeEl('canvas');
  canvas.getContext = () => ctx;
  els.set('bayCanvas', canvas);
  const document = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, fakeEl());
      return els.get(id);
    },
    createElement: (tag) => fakeEl(tag),
  };
  // A clock the test can advance: the feed stamps each alert with Date.now()
  // and re-renders its freshness on a timer, so both have to be steerable.
  const clock = { ms: Date.parse(FIXED) };
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(clock.ms); }
    static now() { return clock.ms; }
  }
  const timers = [];
  const winHandlers = {};
  const sandbox = {
    document,
    navigator: {},
    window: {
      devicePixelRatio: 1,
      addEventListener: (t, fn) => { winHandlers[t] = fn; },
      ParkWizAtidimLot: lot,
      ParkWizOccupancy: occ,
      ParkWizMargin: marginLib,
      ParkWizSpotFreed: sf,
    },
    Date: FixedDate,
    Number, Math, Array, String, JSON,
    setInterval: (fn) => timers.push(fn),
    fetch: () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'demo', 'atidim-data.json'), 'utf8'))),
    }),
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(inline[1], sandbox);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return { ctx, winHandlers, clock, timers, get: (id) => document.getElementById(id) };
}

function scrubTo(page, hour) {
  page.get('hourRange').handlers.input({ target: { value: String(hour) } });
}

function headlines(page) {
  return page.get('alertsList').children.map((li) => li.children[0].textContent);
}

// The bays that actually empty between the two hours, in the order the feed
// shows them — derived from the lot model rather than hard-coded, so a change
// to the occupancy curve fails loudly here instead of drifting silently.
function expectedFeed() {
  const ids = sf.labelGrid(6, 3);
  const types = sf.demoSpotTypes(ids);
  const before = lot.bayLayout(lot.stateAt(OPEN_HOUR, lot.DEFAULT).occupied, TOTAL);
  const after = lot.bayLayout(lot.stateAt(EVENING_HOUR, lot.DEFAULT).occupied, TOTAL);
  const freed = ids.filter((id, i) => before[i] && !after[i]);
  return {
    all: freed,
    eligible: freed.filter((id) => types[id] === 'visitor'),
    reserved: freed.filter((id) => types[id] !== 'visitor'),
    types,
  };
}

test('on load the feed is empty — the first frame is a baseline, not 13 alerts', async () => {
  const page = await boot();
  assert.deepEqual(page.get('alertsList').children, []);
  assert.equal(page.get('alertsEmpty').hidden, false);
});

test('scrubbing to the evening fills the feed with freed bays, newest first', async () => {
  const page = await boot();
  const want = expectedFeed();
  assert.ok(want.eligible.length > 0, 'the evening must actually free a visitor bay');
  scrubTo(page, EVENING_HOUR);
  const shown = headlines(page);
  assert.ok(shown.length > 0);
  assert.ok(shown.length <= 4, 'the feed is capped — a driver is sent to one spot, not a list');
  assert.equal(page.get('alertsEmpty').hidden, true);
  const expected = want.eligible.slice().reverse().slice(0, 4);
  assert.deepEqual(shown.map((t) => t.match(/מקום ([A-C]-\d\d)/)[1]), expected);
  for (const line of shown) assert.match(line, /^התפנה מקום [A-C]-\d\d \(מבקרים\) · פארק עתידים/);
});

test('reserved bays that free up never reach the driver feed', async () => {
  const page = await boot();
  const want = expectedFeed();
  assert.ok(want.reserved.length > 0, 'the fixture must include a reserved bay that empties');
  scrubTo(page, EVENING_HOUR);
  const shownIds = headlines(page).map((t) => t.match(/מקום ([A-C]-\d\d)/)[1]);
  for (const id of shownIds) {
    assert.equal(want.types[id], 'visitor', id + ' is ' + want.types[id] + ' and must not be alerted');
  }
});

test('each alert carries a Waze and a Google Maps link to the lot entrance', async () => {
  const page = await boot();
  scrubTo(page, EVENING_HOUR);
  const first = page.get('alertsList').children[0];
  const links = first.children[1].children;
  assert.equal(links.length, 2);
  assert.equal(links[0].textContent, 'נווט ב-Waze');
  assert.match(links[0].href, /^https:\/\/waze\.com\/ul\?ll=32\.1136%2C34\.8395&navigate=yes$/);
  assert.equal(links[1].textContent, 'נווט ב-Google Maps');
  assert.match(links[1].href, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  for (const a of links) {
    assert.equal(a.rel, 'noopener noreferrer');
    assert.match(a.attrs['aria-label'], /מקום [A-C]-\d\d/);
  }
});

test('scrubbing back to the morning refills the lot without inventing freed bays', async () => {
  const page = await boot();
  scrubTo(page, EVENING_HOUR);
  const evening = headlines(page);
  scrubTo(page, OPEN_HOUR);
  assert.deepEqual(headlines(page), evening, 'cars arriving must not append freed alerts');
});

test('an alert ages on the minute tick instead of reading "just now" forever', async () => {
  const page = await boot();
  scrubTo(page, EVENING_HOUR);
  assert.match(headlines(page)[0], /ממש עכשיו$/);
  page.clock.ms += 5 * 60000;
  page.timers.forEach((fn) => fn());
  assert.match(headlines(page)[0], /לפני 5 דקות$/);
});

test('the feed states what leaves the browser and what does not', async () => {
  const page = await boot();
  scrubTo(page, EVENING_HOUR);
  const note = page.get('alertsNote').textContent;
  assert.match(note, /מבקרים/);
  assert.match(note, /ללא תמונה/);
  assert.match(note, /ללא לוחית רישוי/);
});

test('bays on the canvas are labelled with the ids the alerts quote', async () => {
  const page = await boot();
  const ids = sf.labelGrid(6, 3);
  assert.deepEqual(page.ctx.texts.slice(0, TOTAL), ids);
});

test('the alerts panel is announced and the shell precaches its library', () => {
  assert.match(html, /<section class="panel alerts"[^>]*aria-labelledby="alertsTitle"/);
  assert.match(html, /<h2 id="alertsTitle">התפנה מקום — ההתראה שהנהג מקבל<\/h2>/);
  assert.match(html, /<div aria-live="polite">\s*<p class="empty" id="alertsEmpty">/);
  assert.match(html, /<ol id="alertsList" aria-label="מקומות שהתפנו"><\/ol>/);
  assert.match(html, /<script src="\.\.\/src\/lib\/spot-freed\.js"><\/script>/);
  const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  assert.ok(block.includes("'./src/lib/spot-freed.js'"), 'the event core must be in the offline shell');
});
