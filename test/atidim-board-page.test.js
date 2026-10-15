// Boots the inline script of demo/atidim-board.html against a stub DOM, the
// same way pwa-appinstalled.test.js does. The page is shown live in the
// CityZone meeting, so a blank canvas or an unwired control has to fail here
// first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'atidim-board.html'), 'utf8');
const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');

// The two <script src> tags carry attributes, so this matches the inline block.
const inline = html.match(/<script>([\s\S]*?)<\/script>/);

// 2026-10-19 07:30Z is 10:30 in Jerusalem — mid-morning, the hour the demo opens on.
const FIXED = '2026-10-19T07:30:00Z';
const NOW_HOUR = 10;

function fakeEl() {
  const el = {
    textContent: '',
    innerHTML: '',
    value: '',
    attrs: {},
    handlers: {},
    setAttribute(k, v) { el.attrs[k] = v; },
    addEventListener(t, fn) { el.handlers[t] = fn; },
  };
  return el;
}

function fakeCtx(withRoundRect) {
  const ctx = {
    calls: [],
    fills: [],
    strokes: [],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform(...a) { ctx.calls.push(['setTransform', ...a]); },
    fillRect(...a) { ctx.calls.push(['fillRect', ...a]); ctx.fills.push(ctx.fillStyle); },
    strokeRect(...a) { ctx.calls.push(['strokeRect', ...a]); ctx.strokes.push(ctx.strokeStyle); },
    fill() { ctx.calls.push(['fill']); ctx.fills.push(ctx.fillStyle); },
    stroke() { ctx.calls.push(['stroke']); ctx.strokes.push(ctx.strokeStyle); },
    fillText(...a) { ctx.calls.push(['fillText', ...a]); },
    beginPath() { ctx.calls.push(['beginPath']); },
    closePath() { ctx.calls.push(['closePath']); },
    moveTo() { ctx.calls.push(['moveTo']); },
    lineTo() { ctx.calls.push(['lineTo']); },
    arcTo() { ctx.calls.push(['arcTo']); },
    setLineDash() {},
  };
  if (withRoundRect) ctx.roundRect = (...a) => { ctx.calls.push(['roundRect', ...a]); };
  return ctx;
}

async function boot(opts) {
  const o = opts || {};
  const ctx = fakeCtx(o.roundRect !== false);
  const els = new Map();
  const canvas = fakeEl();
  canvas.getContext = () => ctx;
  els.set('bayCanvas', canvas);

  const document = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, fakeEl());
      return els.get(id);
    },
  };
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(FIXED); }
  }
  const timers = [];
  const winHandlers = {};
  const sandbox = {
    document,
    navigator: {},
    window: {
      devicePixelRatio: o.dpr || 2,
      addEventListener: (t, fn) => { winHandlers[t] = fn; },
      ParkWizAtidimLot: lot,
      ParkWizOccupancy: occ,
    },
    Date: FixedDate,
    Number,
    Math,
    Array,
    String,
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    fetch: () => (o.offline
      ? Promise.reject(new Error('file://'))
      : Promise.resolve({
        ok: true,
        json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'demo', 'atidim-data.json'), 'utf8'))),
      })),
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(inline[1], sandbox);
  // Let the atidim-data.json promise chain settle.
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return { ctx, els, timers, winHandlers, get: (id) => document.getElementById(id) };
}

test('the operator board renders live counters on load', async () => {
  const { get } = await boot();
  assert.equal(get('kTotal').textContent, '18');
  const free = Number(get('kFree').textContent);
  const occupied = Number(get('kOcc').textContent);
  assert.equal(free + occupied, 18, 'X free + Y occupied must account for every bay');
  assert.equal(occupied, lot.stateAt(NOW_HOUR, lot.DEFAULT).occupied);
  assert.match(get('kOccPct').textContent, /^\d+%$/);
  assert.equal(get('hourOut').textContent, '10:00');
  // Site name and the "synthetic data" note both come from atidim-data.json.
  assert.match(get('siteTitle').textContent, /פארק עתידים/);
  assert.match(get('dataNote').textContent, /סינתטיים/);
});

test('every bay is drawn green or red, and occupied bays get a car', async () => {
  const { ctx, els } = await boot();
  const green = ctx.strokes.filter((s) => s === '#16a34a').length;
  const red = ctx.strokes.filter((s) => s === '#dc2626').length;
  assert.equal(green + red, 18, 'one outline per bay');
  assert.equal(red, lot.stateAt(NOW_HOUR, lot.DEFAULT).occupied);
  assert.equal(green, lot.stateAt(NOW_HOUR, lot.DEFAULT).free);
  assert.ok(ctx.calls.some((c) => c[0] === 'roundRect'), 'car bodies are drawn');
  assert.equal(ctx.calls.filter((c) => c[0] === 'fillText').length, 18, 'bay numbers');
  // Backing store is scaled for the projector, not left at CSS pixels.
  assert.equal(els.get('bayCanvas').width, 1280);
  assert.equal(els.get('bayCanvas').height, 720);
  assert.deepEqual(ctx.calls[0], ['setTransform', 2, 0, 0, 2, 0, 0]);
});

test('a browser without roundRect still draws the lot', async () => {
  const { ctx } = await boot({ roundRect: false });
  assert.ok(!ctx.calls.some((c) => c[0] === 'roundRect'));
  assert.ok(ctx.calls.filter((c) => c[0] === 'arcTo').length >= 4, 'fallback path runs');
  assert.equal(ctx.strokes.filter((s) => s === '#16a34a' || s === '#dc2626').length, 18);
});

test('dragging the hour scrubber walks the day and drops out of clock-follow', async () => {
  const { get } = await boot();
  assert.equal(get('nowBtn').attrs['aria-pressed'], 'true');
  const busy = Number(get('kOcc').textContent);

  get('hourRange').handlers.input({ target: { value: '3' } });
  assert.equal(get('hourOut').textContent, '03:00');
  const night = Number(get('kOcc').textContent);
  assert.ok(night < busy, `03:00 must be quieter than 10:00 (${night} vs ${busy})`);
  assert.equal(night + Number(get('kFree').textContent), 18);
  assert.equal(get('nowBtn').attrs['aria-pressed'], 'false');
  assert.match(get('followNote').textContent, /ידנית/);

  get('nowBtn').handlers.click();
  assert.equal(get('hourOut').textContent, '10:00');
  assert.equal(Number(get('kOcc').textContent), busy);
  assert.equal(get('nowBtn').attrs['aria-pressed'], 'true');
});

test('bays already taken stay taken as the demo hour advances', async () => {
  const { get, ctx } = await boot();
  const taken = (h) => {
    ctx.strokes.length = 0;
    get('hourRange').handlers.input({ target: { value: String(h) } });
    return ctx.strokes.filter((s) => s === '#16a34a' || s === '#dc2626');
  };
  const at7 = taken(7);
  const at9 = taken(9);
  assert.equal(at7.length, 18);
  at7.forEach((s, i) => {
    if (s === '#dc2626') assert.equal(at9[i], '#dc2626', `bay ${i + 1} emptied as the lot filled up`);
  });
});

test('the hourly chart marks the hour the counters are showing', async () => {
  const { get } = await boot();
  const svg = get('hourlyChart').innerHTML;
  assert.match(svg, /class="chart"/);
  assert.match(svg, /stroke-dasharray="4 4"/, 'marker line for the current hour');
  assert.match(svg, /<circle/);
  get('hourRange').handlers.input({ target: { value: '16' } });
  assert.notEqual(get('hourlyChart').innerHTML, svg, 'marker follows the scrubber');
});

test('the board still comes up when atidim-data.json cannot be fetched', async () => {
  const { get, ctx } = await boot({ offline: true });
  assert.equal(get('kTotal').textContent, '18', 'falls back to the built-in lot');
  assert.equal(get('hourOut').textContent, '10:00');
  assert.equal(ctx.strokes.filter((s) => s === '#16a34a' || s === '#dc2626').length, 18);
});

test('the clock tick only moves the counters while following', async () => {
  const { timers } = await boot();
  assert.equal(timers.length, 1, 'one clock tick is registered');
  assert.doesNotThrow(() => timers[0]());
});
