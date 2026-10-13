// The Park Atidim operator demo (demo/atidim.html) is shown live in a meeting,
// so the model behind the overlay is asserted here rather than eyeballed: the
// same minute must always give the same frame, the counters must add up, and
// the page must keep its two promises — synthetic (not a real camera) and
// offline (no network call at all).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AT = require('../src/lib/atidim');
const OCC = require('../src/lib/occupancy');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const SPOTS = AT.buildSpots();

test('the lot is a fixed grid of uniquely identified spots', () => {
  assert.equal(SPOTS.length, AT.LOT.rows * AT.LOT.perRow);
  assert.equal(new Set(SPOTS.map((s) => s.id)).size, SPOTS.length);
  for (const s of SPOTS) {
    assert.equal(s.quad.length, 4);
    for (const [x, y] of s.quad) {
      assert.ok(x >= 0 && x <= 1, `${s.id} x=${x} outside the frame`);
      assert.ok(y >= 0 && y <= 1, `${s.id} y=${y} outside the frame`);
      assert.ok(y >= AT.LOT.horizon, `${s.id} is drawn above the horizon`);
    }
  }
});

test('perspective keeps rows apart and widens them towards the camera', () => {
  for (let row = 0; row + 1 < AT.LOT.rows; row++) {
    const near = SPOTS.find((s) => s.row === row);
    const next = SPOTS.find((s) => s.row === row + 1);
    const bottomOfRow = near.quad[2][1];
    const topOfNext = next.quad[0][1];
    assert.ok(bottomOfRow < topOfNext, `row ${row} overlaps row ${row + 1}`);
    const width = (q) => q[1][0] - q[0][0];
    assert.ok(Math.abs(width(next.quad)) > Math.abs(width(near.quad)), 'far rows must be narrower');
  }
});

test('spots in a row are side by side, never on top of each other', () => {
  const rowA = SPOTS.filter((s) => s.row === 0).sort((a, b) => a.col - b.col);
  for (let i = 0; i + 1 < rowA.length; i++) {
    const right = rowA[i].quad[1][0];
    const left = rowA[i + 1].quad[0][0];
    assert.ok(Math.abs(right - left) < 1e-9, 'adjacent spots must share an edge');
  }
});

test('the same minute always renders the same frame', () => {
  for (const m of [0, 7 * 60 + 15, 11 * 60, 23 * 60 + 59]) {
    const a = AT.snapshot(m, SPOTS);
    const b = AT.snapshot(m, SPOTS);
    assert.equal(a.occupied, b.occupied);
    assert.deepEqual([...a.occupiedIds].sort(), [...b.occupiedIds].sort());
  }
});

test('counters add up and the rate matches the counters', () => {
  for (let m = 0; m < AT.MINUTES_PER_DAY; m += 37) {
    const s = AT.snapshot(m, SPOTS);
    assert.equal(s.free + s.occupied, s.total);
    assert.ok(s.free >= 0 && s.occupied >= 0);
    assert.equal(s.occupiedIds.size, s.occupied);
    assert.ok(Math.abs(s.rate - s.occupied / s.total) < 1e-12);
  }
});

// The overlay must not flicker a car out of a spot while the lot is filling:
// the fill order is fixed, so a fuller frame is a superset of an emptier one.
test('filling the lot only adds cars, never moves them', () => {
  const quiet = AT.snapshot(4 * 60, SPOTS);
  const busy = AT.snapshot(11 * 60, SPOTS);
  assert.ok(busy.occupied > quiet.occupied, 'midday must be busier than 04:00');
  for (const id of quiet.occupiedIds) {
    assert.ok(busy.occupiedIds.has(id), `${id} emptied while the lot filled`);
  }
});

test('the daily profile reads like an office park, and never leaves [0,1]', () => {
  for (let m = 0; m < AT.MINUTES_PER_DAY; m++) {
    const r = AT.targetRate(m);
    assert.ok(r >= 0 && r <= 1, `rate ${r} at minute ${m}`);
  }
  assert.ok(AT.targetRate(3 * 60) < 0.15, 'the lot is empty at night');
  assert.ok(AT.targetRate(11 * 60) > 0.85, 'the lot is full at 11:00');
  assert.ok(AT.targetRate(21 * 60) < AT.targetRate(9 * 60), 'evening empties out');
});

test('minutes wrap instead of throwing, and the clock is zero padded', () => {
  assert.equal(AT.clampMinute(-1), AT.MINUTES_PER_DAY - 1);
  assert.equal(AT.clampMinute(AT.MINUTES_PER_DAY + 5), 5);
  assert.equal(AT.clockLabel(0), '00:00');
  assert.equal(AT.clockLabel(9 * 60 + 5), '09:05');
  assert.equal(AT.clockLabel(NaN), '00:00');
});

test('the hourly series feeds the shared occupancy renderer', () => {
  const recs = AT.hourlyRecords(SPOTS, '2026-10-13');
  assert.equal(recs.length, 24);
  assert.deepEqual(OCC.parse(JSON.stringify(recs)).length, 24);
  const sum = OCC.summarize(recs);
  assert.equal(OCC.hourFromTs(sum.peak.ts), 11);
  assert.ok(OCC.occupancyRate(sum.peak) > OCC.occupancyRate(sum.low));
  assert.match(OCC.chartSvg(recs), /<svg class="chart"/);
  assert.match(OCC.hourHeatmapSvg(recs), /<svg class="chart heatmap"/);
  // No plate, no identity, no dwell time: a record is a count and nothing else.
  assert.deepEqual(Object.keys(recs[0]).sort(), ['confidence', 'occupied', 'source', 'street', 'total', 'ts']);
});

test('the demo page is Hebrew RTL, honest about being synthetic, and offline', () => {
  assert.match(page, /lang="he"/);
  assert.match(page, /dir="rtl"/);
  assert.match(page, /class="skip-link"/);
  assert.match(page, /class="banner"/);
  assert.match(page, /אין כאן מצלמה אמיתית/);
  assert.match(page, /רינדור סינתטי/);
  assert.doesNotMatch(page, /unpkg|cdnjs|googleapis|http:\/\//i);
  // Fully offline: the page computes every frame locally, it fetches nothing.
  assert.doesNotMatch(page, /fetch\(|XMLHttpRequest|EventSource|WebSocket/);
});

test('the demo page shows the live counter, the overlay and the hourly chart', () => {
  assert.match(page, /<canvas id="feed"/);
  assert.match(page, /id="kFree"/);
  assert.match(page, /id="kTotal"/);
  assert.match(page, /id="kRate"/);
  assert.match(page, /id="chart"/);
  assert.match(page, /hourHeatmapSvg\(/);
  assert.match(page, /OCC\.chartSvg\(RECORDS/);
  assert.match(page, /id="btnPlay" aria-pressed="true"/);
  assert.match(page, /btn\.setAttribute\("aria-pressed", on \? "true" : "false"\)/);
  assert.match(page, /aria-label="שעת יום להדגמה"/);
  // the canvas is the only picture on the page, so it carries the alt text
  assert.match(page, /<canvas[^>]*role="img"[^>]*\n?\s*aria-label="[^"]*תפוסה/);
});

test('the demo page states the architecture and the privacy floor', () => {
  assert.match(page, /RTSP/);
  assert.match(page, /אין חומרה חדשה בחניון/);
  assert.match(page, /מצלמות הקיימות|מצלמות שכבר מותקנות/);
  assert.match(page, /ללא קריאת לוחיות רישוי/);
  assert.match(page, /ללא שמירת וידאו/);
  assert.match(page, /עיבוד מקומי \(Edge\)/);
  assert.match(page, /ללא זיהוי אנשים או מעקב רכב/);
  // Same floor as the rest of the product: no plate is asked for, kept or helped.
  assert.doesNotMatch(page, /מספר רכב|id="[^"]*[Pp]late|plate\.js/);
});

test('every link and script on the demo page resolves from demo/', () => {
  const refs = [...page.matchAll(/(?:href|src)="(\.\.\/[^"#]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 6, 'expected the page to reach the shared libs and surfaces');
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(root, 'demo', ref)), `demo/atidim.html -> ${ref} is missing`);
  }
});

// Smoke test for the page script itself: no browser here, so the canvas and
// the DOM are stubs that record what the page asked for. It catches the two
// failures a static regex cannot — the frame loop throwing, and the counters
// disagreeing with the overlay the operator is looking at.
function runPageScript(opts) {
  const o = opts || {};
  const calls = { fill: 0, stroke: 0, fillText: 0 };
  const ctx = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    fill() { calls.fill++; },
    stroke() { calls.stroke++; },
    fillText() { calls.fillText++; },
  }, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: () => true,
  });
  const els = {};
  // textContent stringifies on assignment, the way a real node does — the page
  // hands it raw numbers.
  const textNode = () => {
    let text = '';
    return { get: () => text, set: (v) => { text = String(v); }, enumerable: true };
  };
  const el = (id) => (els[id] || (els[id] = Object.defineProperty({
    id,
    innerHTML: '',
    value: '600',
    width: 960,
    height: 540,
    attrs: {},
    handlers: {},
    getContext: () => ctx,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    addEventListener(type, fn) { this.handlers[type] = fn; },
  }, 'textContent', textNode())));
  const timers = [];
  const script = page.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/)[1];
  const run = new Function('window', 'document', 'setInterval', 'clearInterval', '"use strict";' + script);
  run(
    { ParkWizAtidim: AT, ParkWizOccupancy: OCC, matchMedia: () => ({ matches: !!o.reducedMotion }) },
    { getElementById: el },
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    () => {}
  );
  return { els, el, calls, timers };
}

test('the page script paints a frame and the counters match the overlay', () => {
  const { el, calls } = runPageScript();
  assert.ok(calls.fill > SPOTS.length, 'every spot gets an overlay fill');
  assert.ok(calls.stroke >= SPOTS.length, 'every spot gets a marked outline');
  assert.ok(calls.fillText > 0, 'the HUD is drawn');

  const total = Number(el('kTotal').textContent);
  assert.equal(total, SPOTS.length);
  assert.equal(Number(el('kFree').textContent) + Number(el('kOcc').textContent), total);
  assert.match(el('kRate').textContent, /^\d+%$/);
  assert.match(el('kPeak').textContent, /^9[0-9]%$/);
  assert.match(el('clockLabel').textContent, /^\d{2}:\d{2}$/);
  assert.match(el('chart').innerHTML, /<svg class="chart"/);
  assert.match(el('heat').innerHTML, /<svg class="chart heatmap"/);
  assert.equal(el('camId').textContent, AT.LOT.camera);
});

test('the clock slider scrubs the frame and pauses playback', () => {
  const { el, els } = runPageScript();
  assert.equal(el('btnPlay').getAttribute('aria-pressed'), 'true');
  els.clockRange.handlers.input({ target: { value: String(3 * 60) } });
  assert.equal(el('clockLabel').textContent, '03:00');
  assert.equal(el('btnPlay').getAttribute('aria-pressed'), 'false', 'scrubbing pauses the loop');
  const nightFree = Number(el('kFree').textContent);
  els.clockRange.handlers.input({ target: { value: String(11 * 60) } });
  assert.ok(Number(el('kFree').textContent) < nightFree, '11:00 must have fewer free spots than 03:00');
});

test('reduced motion starts paused instead of animating the frame', () => {
  const still = runPageScript({ reducedMotion: true });
  assert.equal(still.el('btnPlay').getAttribute('aria-pressed'), 'false');
  assert.equal(still.timers.length, 0, 'no frame loop when the viewer asked for no motion');
  assert.match(still.el('kFree').textContent, /^\d+$/, 'the first frame still renders');

  const moving = runPageScript();
  assert.equal(moving.timers.length, 1);
  assert.ok(moving.timers[0].ms >= 100, 'the demo clock must be watchable, not a strobe');
});

test('the demo surface is part of the offline shell and reachable from the nav', () => {
  assert.match(sw, /'\.\/demo\/atidim\.html'/);
  assert.match(sw, /'\.\/src\/lib\/atidim\.js'/);
  assert.match(sw, /parkwiz-field-v(1[0-9]|[2-9]\d)/, 'a new precached asset needs a cache bump');

  delete require.cache[require.resolve('../src/lib/surface-nav.js')];
  globalThis.document = undefined;
  require('../src/lib/surface-nav.js');
  const link = globalThis.ParkWizSurfaceNav.LINKS.find((l) => l.id === 'atidim');
  assert.ok(link, 'the operator demo needs a nav entry');
  assert.equal(link.href, './demo/atidim.html');

  // A subdirectory page cannot register './sw.js' — it would ask for demo/sw.js.
  assert.match(page, /data-sw-base="\.\.\/"/);
});
