// Boots the inline script of pilot-kit.html against a stub DOM, the same way
// test/atidim-board-page.test.js does.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pilot-kit.html'), 'utf8');

const occ = require('../src/lib/occupancy');
const heu = require('../src/lib/heuristic');
const red = require('../src/lib/redact');
const cmp = require('../src/lib/compare');
const exp = require('../src/lib/export');

// Extract the inline script block from pilot-kit.html
const inlineMatch = html.match(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/i);
assert.ok(inlineMatch, 'pilot-kit.html must have an inline <script> block');
const inlineCode = inlineMatch[1];

function createClassList(el) {
  return {
    _getSet() {
      return new Set((el.className || '').trim().split(/\s+/).filter(Boolean));
    },
    add(...names) {
      const set = this._getSet();
      names.forEach((n) => set.add(n));
      el.className = Array.from(set).join(' ');
    },
    remove(...names) {
      const set = this._getSet();
      names.forEach((n) => set.delete(n));
      el.className = Array.from(set).join(' ');
    },
    toggle(name, force) {
      const set = this._getSet();
      const has = set.has(name);
      const shouldHave = typeof force === 'boolean' ? force : !has;
      if (shouldHave) set.add(name); else set.delete(name);
      el.className = Array.from(set).join(' ');
      return shouldHave;
    },
    contains(name) {
      return this._getSet().has(name);
    },
  };
}

function fakeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    textContent: '',
    innerHTML: '',
    value: '',
    attrs: {},
    handlers: {},
    _listeners: {},
    style: {},
    children: [],
    className: '',
    disabled: false,
    hidden: false,
    width: 0,
    height: 0,
    clientWidth: 0,
    clientHeight: 0,
    setAttribute(k, v) {
      el.attrs[k] = String(v);
    },
    getAttribute(k) {
      return el.attrs[k] !== undefined ? el.attrs[k] : null;
    },
    hasAttribute(k) {
      return k in el.attrs;
    },
    removeAttribute(k) {
      delete el.attrs[k];
    },
    addEventListener(t, fn) {
      el.handlers[t] = fn;
      if (!el._listeners[t]) el._listeners[t] = [];
      el._listeners[t].push(fn);
    },
    removeEventListener(t, fn) {
      if (el.handlers[t] === fn) delete el.handlers[t];
      if (el._listeners[t]) {
        el._listeners[t] = el._listeners[t].filter((h) => h !== fn);
      }
    },
    dispatchEvent(ev) {
      const type = (ev && ev.type) || ev;
      const list = el._listeners[type] || (el.handlers[type] ? [el.handlers[type]] : []);
      list.forEach((fn) => fn(ev));
    },
    replaceChildren(...args) {
      el.children = [...args];
      el.innerHTML = '';
      el.textContent = '';
    },
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    removeChild(child) {
      el.children = el.children.filter((c) => c !== child);
      return child;
    },
    click() {
      el.dispatchEvent({ type: 'click', target: el });
    },
    select() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      const w = el.width || el.clientWidth || 800;
      const h = el.height || el.clientHeight || 480;
      return {
        left: 0,
        top: 0,
        width: w,
        height: h,
        right: w,
        bottom: h,
      };
    },
  };
  el.classList = createClassList(el);
  return el;
}

function fakeCtx() {
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
    clearRect(...a) { ctx.calls.push(['clearRect', ...a]); },
    fill() { ctx.calls.push(['fill']); ctx.fills.push(ctx.fillStyle); },
    stroke() { ctx.calls.push(['stroke']); ctx.strokes.push(ctx.strokeStyle); },
    fillText(...a) { ctx.calls.push(['fillText', ...a]); },
    beginPath() { ctx.calls.push(['beginPath']); },
    closePath() { ctx.calls.push(['closePath']); },
    moveTo(...a) { ctx.calls.push(['moveTo', ...a]); },
    lineTo(...a) { ctx.calls.push(['lineTo', ...a]); },
    arcTo(...a) { ctx.calls.push(['arcTo', ...a]); },
    setLineDash(...a) { ctx.calls.push(['setLineDash', ...a]); },
    drawImage(...a) { ctx.calls.push(['drawImage', ...a]); },
    getImageData(x, y, w, h) {
      ctx.calls.push(['getImageData', x, y, w, h]);
      const width = Math.max(0, Math.floor(w || 0));
      const height = Math.max(0, Math.floor(h || 0));
      return {
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      };
    },
  };
  return ctx;
}

function fakeLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] || null; },
  };
}

class FakeImage {
  constructor() {
    this._src = '';
    this.naturalWidth = 800;
    this.naturalHeight = 480;
    this.width = 800;
    this.height = 480;
    this.complete = true;
    this.onload = null;
    this.onerror = null;
  }
  get src() { return this._src; }
  set src(v) {
    this._src = v;
    setImmediate(() => {
      if (typeof this.onload === 'function') this.onload();
    });
  }
}

async function boot(opts = {}) {
  const innerWidth = opts.innerWidth || 1280;
  const innerHeight = opts.innerHeight || 800;
  const dpr = opts.dpr || 1;
  const els = new Map();

  const calCanvas = fakeEl('canvas');
  const mainCtx = fakeCtx();
  calCanvas.getContext = () => mainCtx;
  calCanvas.toDataURL = (type) => `data:${type || 'image/png'};base64,stub`;
  els.set('calCanvas', calCanvas);

  const snapImg = fakeEl('img');
  snapImg.naturalWidth = 800;
  snapImg.naturalHeight = 480;
  snapImg.clientWidth = innerWidth < 600 ? innerWidth : 800;
  snapImg.clientHeight = innerWidth < 600 ? Math.round(innerWidth * 0.6) : 480;
  snapImg.complete = true;
  snapImg.src = '';
  els.set('snapImg', snapImg);

  const streetName = fakeEl('input');
  streetName.value = 'הרצל, נתניה';
  els.set('streetName', streetName);

  const kTotal = fakeEl('div'); kTotal.textContent = '0'; els.set('kTotal', kTotal);
  const kOcc = fakeEl('div'); kOcc.textContent = '0'; els.set('kOcc', kOcc);
  const kFree = fakeEl('div'); kFree.textContent = '0'; els.set('kFree', kFree);

  const btnPrivacy = fakeEl('button');
  btnPrivacy.setAttribute('aria-pressed', 'true');
  els.set('btnPrivacy', btnPrivacy);

  const privBadge = fakeEl('span');
  privBadge.textContent = 'פועל';
  els.set('privBadge', privBadge);

  const privLock = fakeEl('span');
  privLock.hidden = true;
  els.set('privLock', privLock);

  const spotListEmpty = fakeEl('p');
  spotListEmpty.style.display = 'none';
  els.set('spotListEmpty', spotListEmpty);

  const chartEmpty = fakeEl('p');
  chartEmpty.style.display = 'none';
  els.set('chartEmpty', chartEmpty);

  for (const id of ['btnCopySummary', 'btnUndo', 'btnClear', 'btnExportSpots', 'btnExportOcc', 'btnExportCsv']) {
    const btn = fakeEl('button');
    btn.setAttribute('aria-disabled', 'true');
    els.set(id, btn);
  }

  const document = {
    body: fakeEl('body'),
    getElementById(id) {
      if (!els.has(id)) {
        els.set(id, fakeEl());
      }
      return els.get(id);
    },
    createElement(tag) {
      const el = fakeEl(tag);
      if (tag.toLowerCase() === 'canvas') {
        el.getContext = () => fakeCtx();
        el.toDataURL = (type) => `data:${type || 'image/png'};base64,stub`;
      }
      return el;
    },
    execCommand() {
      return true;
    },
  };

  const storage = opts.localStorage || fakeLocalStorage(opts.initialStorage || {});

  const fakeUrl = {
    createObjectURL(blob) {
      return `blob:stub-${Math.random().toString(36).slice(2)}`;
    },
    revokeObjectURL() {},
  };

  const winHandlers = {};
  const windowLocation = opts.location || {
    hostname: opts.hostname || 'localhost',
    protocol: opts.protocol || 'http:',
    href: 'http://localhost/pilot-kit.html',
    origin: 'http://localhost',
    pathname: '/pilot-kit.html',
    search: '',
    hash: '',
  };

  const fakeNav = opts.navigator || {
    clipboard: {
      writeText: async () => {},
    },
    userAgent: 'node-test',
  };

  const window = {
    innerWidth,
    innerHeight,
    devicePixelRatio: dpr,
    location: windowLocation,
    navigator: fakeNav,
    localStorage: storage,
    URL: fakeUrl,
    Blob,
    Image: FakeImage,
    addEventListener(t, fn) {
      winHandlers[t] = fn;
    },
    removeEventListener(t, fn) {
      if (winHandlers[t] === fn) delete winHandlers[t];
    },
    ParkWizOccupancy: occ,
    ParkWizHeuristic: heu,
    ParkWizRedact: red,
    ParkWizCompare: cmp,
    ParkWizExport: exp,
  };

  const sandbox = {
    document,
    window,
    navigator: window.navigator,
    localStorage: storage,
    location: window.location,
    URL: fakeUrl,
    Blob,
    Image: FakeImage,
    Date,
    Number,
    Math,
    Array,
    String,
    JSON,
    setTimeout,
    clearTimeout,
    setImmediate,
    clearImmediate,
    fetch: opts.fetch || (async (url) => {
      const rel = String(url).replace(/^\.\//, '').replace(/^\//, '');
      const filePath = path.join(root, rel);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        return {
          ok: true,
          status: 200,
          text: async () => buf.toString('utf8'),
          json: async () => JSON.parse(buf.toString('utf8')),
          blob: async () => ({ size: buf.length }),
        };
      }
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    }),
  };
  sandbox.globalThis = sandbox;

  // Run the inline script
  vm.runInNewContext(inlineCode, sandbox);

  // Allow async tasks (e.g. loadSample promise chain) to settle unless settle === false
  if (opts.settle !== false) {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setImmediate(r));
    }
  }

  return {
    ctx: mainCtx,
    els,
    document,
    window,
    storage,
    winHandlers,
    get: (id) => document.getElementById(id),
  };
}

test('pilot-kit.html structure and metadata: Hebrew RTL, viewport, and required controls', () => {
  // 1. Hebrew RTL configuration
  assert.match(html, /<html\s+[^>]*lang="he"[^>]*dir="rtl"/i);

  // 2. Responsive mobile viewport
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);

  // 3. Presence of canvas and snapshot image
  assert.match(html, /<canvas[^>]*id="calCanvas"/);
  assert.match(html, /<img[^>]*id="snapImg"/);

  // 4. Status line
  assert.match(html, /id="kitStatus"/);

  // 5. Privacy controls
  assert.match(html, /id="btnPrivacy"/);
  assert.match(html, /id="privBadge"/);

  // 6. Spot marking / calibration controls
  const controls = [
    'btnSample', 'btnEstimate', 'btnUndo', 'btnClear',
    'btnSaveLs', 'btnExportSpots', 'btnExportOcc', 'btnExportCsv',
  ];
  for (const id of controls) {
    assert.match(html, new RegExp(`id="${id}"`), `Control #${id} must be present`);
  }

  // 7. File inputs
  const fileInputs = ['fileSnap', 'fileEmpty', 'fileSpots', 'fileOcc'];
  for (const id of fileInputs) {
    assert.match(html, new RegExp(`<input[^>]*type="file"[^>]*id="${id}"`), `File input #${id} must be present`);
  }

  // 8. KPI displays
  for (const id of ['kTotal', 'kOcc', 'kFree']) {
    assert.match(html, new RegExp(`id="${id}"`), `KPI element #${id} must be present`);
  }

  // 9. Chart container
  assert.match(html, /id="chart"/, 'Chart container #chart must be present');
});

test('desktop initialization (window.innerWidth = 1280) boots cleanly with zero uncaught exceptions', async () => {
  const { get, ctx } = await boot({ innerWidth: 1280, innerHeight: 800 });

  // Privacy controls initial state: enabled by default
  assert.equal(get('btnPrivacy').getAttribute('aria-pressed'), 'true');
  assert.match(get('btnPrivacy').textContent, /מצב פרטיות פועל/);
  assert.equal(get('privBadge').textContent, 'פועל');
  assert.equal(get('privBadge').classList.contains('off'), false);

  // Elements initial state and restore() execution
  assert.ok(get('kitStatus').textContent.length > 0, 'Status should be populated');
  assert.match(get('kitStatus').textContent, /נטענה דוגמת מגרש מסונתזת/);

  // Canvas drawing occurred during sample load & overlay
  assert.ok(ctx.calls.length > 0, 'Canvas operations should be recorded');
  const fills = ctx.calls.filter((c) => c[0] === 'fillRect');
  assert.ok(fills.length >= 12, '12 spots should be drawn on canvas overlay');

  // Spot list populated with 12 spots
  const spotItems = get('spotItems');
  assert.equal(spotItems.children.length, 12, '12 spots should be listed in spot list');

  // Export spots guard is enabled once spots exist
  assert.equal(get('btnExportSpots').getAttribute('aria-disabled'), 'false');
  assert.equal(get('btnClear').getAttribute('aria-disabled'), 'false');
  assert.equal(get('btnUndo').getAttribute('aria-disabled'), 'false');
});

test('mobile initialization (window.innerWidth = 390) boots cleanly with zero uncaught exceptions', async () => {
  const { get, els, ctx } = await boot({ innerWidth: 390, innerHeight: 844 });

  // Canvas sizing reflects the mobile container width
  const calCanvas = els.get('calCanvas');
  assert.equal(calCanvas.width, 390, 'Canvas width should scale to mobile snapshot width (390)');

  // Privacy controls initialized enabled on mobile
  assert.equal(get('btnPrivacy').getAttribute('aria-pressed'), 'true');
  assert.equal(get('privBadge').textContent, 'פועל');
  assert.equal(get('privBadge').classList.contains('off'), false);

  // Spot list populated
  assert.equal(get('spotItems').children.length, 12);
  assert.ok(ctx.calls.length > 0);
});

test('privacy mode initializes enabled and reflects production lock vs dev toggle', async () => {
  // 1. Production host: locked
  const prod = await boot({ hostname: 'parkwiz.cityzone.io' });
  const prodBtn = prod.get('btnPrivacy');
  const prodLock = prod.get('privLock');

  assert.equal(prodBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(prodBtn.disabled, true, 'Privacy toggle button must be disabled in production');
  assert.equal(prodLock.hidden, false, 'privLock banner must be visible in production');
  assert.match(prodBtn.textContent, /נעול בבילד ייצור/);

  // Trying to toggle in production must keep it enabled
  prodBtn.click();
  assert.equal(prodBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(prod.get('privBadge').textContent, 'פועל');

  // 2. Dev host (localhost): toggleable
  const dev = await boot({ hostname: 'localhost' });
  const devBtn = dev.get('btnPrivacy');
  const devBadge = dev.get('privBadge');
  const devLock = dev.get('privLock');

  assert.equal(devBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(devBtn.disabled, false, 'Privacy toggle button should be enabled on localhost');
  assert.equal(devLock.hidden, true, 'privLock should be hidden on localhost');

  // Clicking toggles privacy off
  devBtn.click();
  assert.equal(devBtn.getAttribute('aria-pressed'), 'false');
  assert.equal(devBadge.textContent, 'כבוי');
  assert.equal(devBadge.classList.contains('off'), true);
  assert.match(devBtn.textContent, /כבוי/);

  // Clicking again toggles privacy back on
  devBtn.click();
  assert.equal(devBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(devBadge.textContent, 'פועל');
  assert.equal(devBadge.classList.contains('off'), false);
});

test('restoration from localStorage hydrates spots, street, and occupancy during boot', async () => {
  const initialSpots = {
    version: 1,
    street: 'רחוב הבדיקה 42',
    spots: [
      { id: 'spot-1', x: 0.1, y: 0.2, w: 0.15, h: 0.3 },
      { id: 'spot-2', x: 0.3, y: 0.2, w: 0.15, h: 0.3 },
    ],
  };
  const initialOcc = [
    { ts: '2026-10-19T08:00:00Z', street: 'רחוב הבדיקה 42', total: 2, occupied: 1, source: 'test' },
  ];

  const storage = fakeLocalStorage({
    [occ.LS.spots]: JSON.stringify(initialSpots),
    [occ.LS.street]: 'רחוב הבדיקה 42',
    [occ.LS.occupancy]: JSON.stringify(initialOcc),
  });

  const { get } = await boot({
    localStorage: storage,
    settle: false,
  });

  // Street name restored
  assert.equal(get('streetName').value, 'רחוב הבדיקה 42');

  // Spot list restored with the 2 saved spots
  assert.equal(get('spotItems').children.length, 2);

  // Chart rendered with the restored occupancy record
  assert.match(get('chart').innerHTML, /<svg/i);
  assert.equal(get('chartEmpty').style.display, 'none');

  // Export guards unblocked
  assert.equal(get('btnExportSpots').getAttribute('aria-disabled'), 'false');
  assert.equal(get('btnExportOcc').getAttribute('aria-disabled'), 'false');
  assert.equal(get('btnExportCsv').getAttribute('aria-disabled'), 'false');
});

test('computing estimate updates KPIs, note, chart, and export guards', async () => {
  const { get } = await boot();

  // Initially KPIs are 0 before estimate computation
  assert.equal(get('kTotal').textContent, '0');
  assert.equal(get('kOcc').textContent, '0');
  assert.equal(get('kFree').textContent, '0');

  // Trigger compute estimate
  get('btnEstimate').click();

  // After compute estimate, total spots is 12
  const total = Number(get('kTotal').textContent);
  const occupied = Number(get('kOcc').textContent);
  const free = Number(get('kFree').textContent);

  assert.equal(total, 12);
  assert.equal(occupied + free, 12);
  assert.match(get('estNote').textContent, /הערכה היוריסטית בשיטת/);
  assert.match(get('kitStatus').textContent, /חושבה תפוסה עבור 12 מקומות/);

  // Export guards for occupancy are now active
  assert.equal(get('btnExportOcc').getAttribute('aria-disabled'), 'false');
  assert.equal(get('btnExportCsv').getAttribute('aria-disabled'), 'false');

  // Chart is drawn with the new occupancy point
  assert.match(get('chart').innerHTML, /<svg/i);
});

test('undo and clear actions manipulate spots and enforce empty-state guards', async () => {
  const { get, storage } = await boot();

  assert.equal(get('spotItems').children.length, 12);

  // Undo one spot
  get('btnUndo').click();
  assert.equal(get('spotItems').children.length, 11);
  assert.match(get('kitStatus').textContent, /המלבן האחרון בוטל/);

  // Clear all spots
  get('btnClear').click();
  assert.equal(get('spotItems').children.length, 0);
  assert.equal(get('spotListEmpty').style.display, 'block');
  assert.match(get('kitStatus').textContent, /כל המלבנים נוקו/);

  // KPI counters reset to 0
  assert.equal(get('kTotal').textContent, '0');
  assert.equal(get('kOcc').textContent, '0');
  assert.equal(get('kFree').textContent, '0');

  // Spot-related actions are disabled again
  assert.equal(get('btnUndo').getAttribute('aria-disabled'), 'true');
  assert.equal(get('btnClear').getAttribute('aria-disabled'), 'true');
  assert.equal(get('btnExportSpots').getAttribute('aria-disabled'), 'true');
  assert.equal(get('btnCopySummary').getAttribute('aria-disabled'), 'true');

  // Trying to undo or clear when empty informs the operator
  get('btnUndo').click();
  assert.match(get('kitStatus').textContent, /אין מלבנים לביטול/);

  get('btnClear').click();
  assert.match(get('kitStatus').textContent, /אין מלבנים לניקוי/);
});

test('pointer drawing interactions on canvas create new spots', async () => {
  const { get, els, ctx } = await boot();

  const canvas = els.get('calCanvas');
  const countBefore = get('spotItems').children.length;

  // Pointer down at normalized coordinates (0.1, 0.1)
  canvas.handlers.pointerdown({
    pointerId: 1,
    clientX: 80,
    clientY: 48,
  });

  // Pointer move to (0.2, 0.3)
  canvas.handlers.pointermove({
    clientX: 160,
    clientY: 144,
  });

  // Pointer up
  canvas.handlers.pointerup();

  // A new spot should have been added
  assert.equal(get('spotItems').children.length, countBefore + 1);
});
