// ParkWiz test helper: run index.html's main inline script for real.
//
// The map page is one big inline script, so the only way to prove what a person
// sees is to run that script and call the same functions the UI calls. This
// helper gives it a DOM stub that REMEMBERS its elements (so a test can read
// back what a render wrote into #spotsList or #arrivalPanel), a Leaflet stub
// that records every bindTooltip text, and an optional frozen clock.
//
// Nothing here reaches the network, the real clock or Math.random.
process.env.TZ = 'Asia/Jerusalem'; // the availability model reasons in Israel time

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Tuesday, 10:00 Israel time: the 10:00 slot of the pinned hourly series.
const FIXED_NOW = new Date('2026-07-14T10:00:00+03:00').getTime();

function fakeEl(id) {
  return {
    id, textContent: '', innerHTML: '', value: '0', checked: false, disabled: false,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return ''; }, appendChild() {}, replaceChildren() {},
    addEventListener() {}, remove() {}, querySelectorAll() { return []; },
  };
}

// A Leaflet stand-in: every property is callable and every call is chainable,
// so the page's map code runs unchanged. bindTooltip texts are collected.
function leafletStub(tooltips) {
  function node(p) {
    const f = function (...args) {
      if (p.endsWith('.bindTooltip')) tooltips.push(String(args[0]));
      return node(p + '()');
    };
    return new Proxy(f, {
      get(t, k) {
        if (typeof k === 'symbol') return t[k];
        if (k === 'lat' || k === 'lng') return 32.3;
        return node(p + '.' + String(k));
      },
      apply(t, self, args) {
        if (p.endsWith('.bindTooltip')) tooltips.push(String(args[0]));
        return node(p + '()');
      },
    });
  }
  return node('L');
}

// opts.now: freeze Date.now() and `new Date()` at this epoch ms.
function loadPage(opts) {
  const o = opts || {};
  const lines = html.split('\n');
  const open = lines.findIndex((l, i) => i > 800 && l.trim() === '<script>');
  const close = lines.findIndex((l, i) => i > open && l.trim() === '</script>');
  assert.ok(open > 0 && close > open, 'could not find the main inline script in index.html');

  const store = {};
  const els = new Map();
  const tooltips = [];
  let DateCtor = Date;
  if (typeof o.now === 'number') {
    const at = o.now;
    DateCtor = class FrozenDate extends Date {
      constructor(...a) { if (a.length === 0) super(at); else super(...a); }
      static now() { return at; }
    };
  }

  const sandbox = {
    console, Math, Intl, JSON, Number, String, Array, Object, isNaN, parseInt, parseFloat,
    Date: DateCtor,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      getElementById: (id) => { if (!els.has(id)) els.set(id, fakeEl(id)); return els.get(id); },
      querySelectorAll: () => [], createElement: () => fakeEl('created'),
      addEventListener() {}, head: fakeEl('head'), body: fakeEl('body'), readyState: 'complete',
    },
    navigator: { serviceWorker: { register: () => Promise.resolve() }, geolocation: { getCurrentPosition() {} } },
    location: { origin: 'http://localhost', href: 'http://localhost/' },
    fetch: () => Promise.reject(new Error('no network in tests')),
    alert() {}, open() {}, addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener() {} }),
    L: o.leaflet === false ? undefined : leafletStub(tooltips),
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
    shoulderMapTag, isShoulderStreet, isShoulderType, surfaceAdjustedPct,
    chanceHeadingFor, chanceWordFor, surfaceLevelLabel, surfaceHeadline, streetTooltipText,
    chanceBadgeHTML, fitInfo, streetGap, shoulderRoomLine, shoulderFreeRunM, shoulderCarsFree,
    arrivalAvailLabel, showRecommended, curbTypeFor,
    renderSidePanel, renderStreetCard, arrivalMode, initRealMap,
    setVehicleId: (v) => { localStorage.setItem('pw_vehicle', v); } };`;
  vm.runInContext(lines.slice(open + 1, close).join('\n') + exportLine, sandbox, { filename: 'index.html' });
  return { page: sandbox.__PW, store, els, tooltips, html };
}

// What a render actually wrote into an element, or '' if it never touched it.
function written(els, id) {
  const el = els.get(id);
  if (!el) return '';
  return String(el.innerHTML || '') + String(el.textContent || '');
}

module.exports = { loadPage, written, html, root, FIXED_NOW };
