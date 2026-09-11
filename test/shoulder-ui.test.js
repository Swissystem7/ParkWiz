// The map page is one big inline script, so this file runs that script in a
// stubbed DOM and asks it the same questions the UI asks it. Regex over the
// HTML can only prove a string is present; this proves the number a person sees
// beside a shoulder came out of the shoulder rule and not the bay rule.
process.env.TZ = 'Asia/Jerusalem'; // the availability model reasons in Israel time

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SH = require('../src/lib/shoulder');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function fakeEl() {
  return {
    textContent: '', innerHTML: '', value: '0', checked: false, disabled: false,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return ''; }, appendChild() {}, replaceChildren() {},
    addEventListener() {}, remove() {}, querySelectorAll() { return []; },
  };
}

// Run the page's main inline script and hand back the pieces the UI calls.
function loadPage() {
  const lines = html.split('\n');
  const open = lines.findIndex((l, i) => i > 800 && l.trim() === '<script>');
  const close = lines.findIndex((l, i) => i > open && l.trim() === '</script>');
  assert.ok(open > 0 && close > open, 'could not find the main inline script in index.html');
  const store = {};
  const sandbox = {
    console, Math, Date, Intl, JSON, Number, String, Array, Object, isNaN, parseInt, parseFloat,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      getElementById: () => fakeEl(), querySelectorAll: () => [], createElement: () => fakeEl(),
      addEventListener() {}, head: fakeEl(), body: fakeEl(), readyState: 'complete',
    },
    navigator: { serviceWorker: { register: () => Promise.resolve() }, geolocation: { getCurrentPosition() {} } },
    location: { origin: 'http://localhost', href: 'http://localhost/' },
    fetch: () => Promise.reject(new Error('no network in tests')),
    alert() {}, open() {}, addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const lib of ['src/lib/availability.js', 'src/lib/predict.js', 'src/lib/probability.js',
    'src/lib/shoulder.js', 'availability-model.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, lib), 'utf8'), sandbox, { filename: lib });
  }
  const exportLine = `;globalThis.__PW = { STREETS_DEF, CURBS, CURB_TYPES, activeFilters, SHOULDER_COPY,
    getStreetSignalPct, getStreetHourlySignalSeries, getCurrentHourAvailabilityPct,
    getStreetHourlyModelSeries, parkingTypeLabel, parkingTariffLabel, shoulderNoteHtml,
    shoulderMapTag, isShoulderStreet, surfaceAdjustedPct };`;
  vm.runInContext(lines.slice(open + 1, close).join('\n') + exportLine, sandbox, { filename: 'index.html' });
  return { page: sandbox.__PW, store };
}

const REF = new Date('2026-07-14T07:00:00+03:00'); // Tuesday, before the 08:00 slot

test('the demo map carries shoulder streets, each with a shoulder length', () => {
  const { page } = loadPage();
  const shoulders = page.STREETS_DEF.filter((s) => s.type === SH.SURFACE);
  assert.ok(shoulders.length >= 2, 'expected at least two shoulder streets on the map');
  for (const s of shoulders) {
    assert.equal(typeof s.shoulderM, 'number', `${s.name} needs a shoulder length`);
    assert.ok(s.shoulderM > 0, `${s.name} needs a positive shoulder length`);
  }
});

test('a marked bay still shows the bay signal, untouched', () => {
  const { page } = loadPage();
  page.STREETS_DEF.forEach((s, i) => {
    if (s.type === SH.SURFACE) return;
    const signal = Array.from(page.getStreetHourlySignalSeries(i, REF));
    assert.deepEqual(Array.from(page.getStreetHourlyModelSeries(i, REF)), signal, `${s.name} was adjusted`);
  });
});

test('a shoulder shows the shoulder rule, and the two rules disagree', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.type === SH.SURFACE);
  const s = page.STREETS_DEF[idx];
  const signal = Array.from(page.getStreetHourlySignalSeries(idx, REF));
  const shown = Array.from(page.getStreetHourlyModelSeries(idx, REF));
  const byRule = signal.map((pct) => SH.shoulderAvailabilityPct({
    shoulderLengthM: s.shoulderM, streetAvailPct: pct, vehicleLenM: 4.5,
  }));
  assert.deepEqual(shown, byRule, 'the displayed series is not the shoulder rule');
  assert.notDeepEqual(shown, signal, 'a shoulder answered exactly like a bay');
});

// Hand-derived, and pinned so a silent change of rule or of demo data is visible.
// בן גוריון: baseline 25, shoulder 18 m. The availability model takes the street to
// 13 at 08:00 (weekday morning -12) and to 5 at 18:00 and 20:00 (weekday evening -20).
//   13 -> streetOcc .87 -> shoulderOcc .675 -> run 5.85 m -> sedan ratio 1.194 -> 27
//   25 -> streetOcc .75 -> shoulderOcc .375 -> run 11.25 m -> ratio 2.296 -> 69
//    5 -> streetOcc .95 -> shoulderOcc .875 -> run 2.25 m -> ratio 0.459 -> 0
test('the pinned shoulder day for בן גוריון', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  assert.equal(page.STREETS_DEF[idx].type, SH.SURFACE);
  assert.equal(page.STREETS_DEF[idx].shoulderM, 18);
  assert.deepEqual(Array.from(page.getStreetHourlySignalSeries(idx, REF)), [13, 25, 25, 25, 25, 5, 5]);
  assert.deepEqual(Array.from(page.getStreetHourlyModelSeries(idx, REF)), [27, 69, 69, 69, 69, 0, 0]);
});

// דן שומרון: baseline 66, shoulder 14 m. The street never gets busy enough for the
// spill to reach the shoulder, so the shoulder stays flat while the bay number moves —
// which is "last to fill" showing up on the hourly chart.
test('the pinned shoulder day for דן שומרון', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'דן שומרון');
  assert.equal(page.STREETS_DEF[idx].shoulderM, 14);
  assert.deepEqual(Array.from(page.getStreetHourlySignalSeries(idx, REF)), [54, 66, 66, 66, 66, 46, 46]);
  assert.deepEqual(Array.from(page.getStreetHourlyModelSeries(idx, REF)), [90, 90, 90, 90, 90, 90, 90]);
});

test('the shoulder answer moves with the driver vehicle; the bay answer cannot', () => {
  const { page, store } = loadPage();
  const shoulderIdx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  const bayIdx = page.STREETS_DEF.findIndex((s) => s.type === 'blue');
  const read = (idx) => page.getStreetHourlyModelSeries(idx, REF)[1]; // the 10:00 slot
  const seen = {};
  for (const vehicle of ['small', 'sedan', 'suv', 'van']) {
    store.pw_vehicle = vehicle;
    seen[vehicle] = { shoulder: read(shoulderIdx), bay: read(bayIdx) };
  }
  // 11.25 m of free run, needs 4.2 / 4.9 / 5.3 / 5.9 m
  assert.deepEqual([seen.small.shoulder, seen.sedan.shoulder, seen.suv.shoulder, seen.van.shoulder],
    [83, 69, 62, 54]);
  assert.equal(seen.small.bay, seen.van.bay, 'the bay rule cannot see the vehicle at all');
});

test('the list row and the street card both carry the shoulder note', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.type === SH.SURFACE);
  const note = page.shoulderNoteHtml(idx, 25);
  assert.ok(note.includes(page.SHOULDER_COPY.notice), 'the note must carry the notice');
  assert.ok(note.includes(page.SHOULDER_COPY.why), 'the note must say why a shoulder differs');
  assert.ok(note.includes(page.SHOULDER_COPY.listTag));
  // 11.25 m of run holds two sedans; the copy says so as an estimate, not a count.
  assert.ok(note.includes(page.SHOULDER_COPY.roomMany.replace('{n}', 2)), note);
  // and both surfaces that show a shoulder chance render it
  assert.match(html, /\$\{isShoulderStreet\(s\.idx\) \? shoulderNoteHtml\(s\.idx, getStreetSignalPct\(s\.idx\)\) : ''\}/);
  assert.match(html, /scShoulder\.innerHTML = shoulderNoteHtml\(idx, getStreetSignalPct\(idx\)\);/);
});

test('map, legend and filter bar tell a shoulder apart from a marked bay', () => {
  const { page } = loadPage();
  assert.equal(page.shoulderMapTag(SH.SURFACE), ' · ' + page.SHOULDER_COPY.mapTag);
  assert.equal(page.shoulderMapTag('blue'), '');
  const colours = Object.entries(page.CURB_TYPES).map(([k, v]) => [k, v.c]);
  const shoulderColour = page.CURB_TYPES[SH.SURFACE].c;
  assert.ok(shoulderColour, 'the shoulder needs a curb colour of its own');
  for (const [k, c] of colours) {
    if (k !== SH.SURFACE) assert.notEqual(c, shoulderColour, `${k} shares the shoulder colour`);
  }
  assert.equal(page.activeFilters[SH.SURFACE], true);
  assert.match(html, /id="filt-shoulder"[^>]*aria-pressed="true"/);
  assert.match(html, new RegExp(`background:${shoulderColour}`), 'the legend needs the shoulder swatch');
  // a shoulder street's curb stays a shoulder; it never turns into a marked bay
  const idx = page.STREETS_DEF.findIndex((s) => s.type === SH.SURFACE);
  const kinds = new Set(page.CURBS[idx].map((c) => c.type));
  for (const kind of kinds) assert.ok([SH.SURFACE, 'red'].includes(kind), `curb turned into ${kind}`);
  assert.ok(kinds.has(SH.SURFACE));
});

test('labels and tariff for a shoulder come from the shoulder copy', () => {
  const { page } = loadPage();
  assert.equal(page.parkingTypeLabel(SH.SURFACE), page.SHOULDER_COPY.typeLabel);
  assert.equal(page.parkingTariffLabel(SH.SURFACE), page.SHOULDER_COPY.tariff);
  assert.notEqual(page.parkingTypeLabel('blue'), page.SHOULDER_COPY.typeLabel);
  assert.notEqual(page.parkingTariffLabel('free'), page.SHOULDER_COPY.tariff);
});

test('the offline shell ships the shoulder module', () => {
  const assetsBlock = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  assert.match(assetsBlock, /src\/lib\/shoulder\.js/);
  assert.match(html, /<script src="src\/lib\/shoulder\.js"><\/script>/);
});
