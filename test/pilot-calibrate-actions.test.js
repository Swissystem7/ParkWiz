const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeEl(id) {
  const node = {
    id,
    value: '',
    textContent: '',
    className: '',
    disabled: false,
    complete: false,
    naturalWidth: 0,
    clientWidth: 8,
    clientHeight: 8,
    style: {},
    children: [],
    attrs: {},
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; },
    removeAttribute(k) { delete node.attrs[k]; },
    addEventListener() {},
    appendChild(child) { node.children.push(child); return child; },
    replaceChildren() { node.children.length = 0; },
    remove() {},
    select() {},
    setSelectionRange() {},
    click() {},
    getContext() {
      return { clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {}, setLineDash() {} };
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 8, height: 8 }; },
  };
  return node;
}

function boot() {
  const elements = new Map();
  const document = {
    createElement: (tag) => makeEl(tag),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    execCommand: () => false,
  };
  document.body = makeEl('body');
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const copied = [];
  const navigator = {
    clipboard: {
      writeText(text) {
        copied.push(text);
        return Promise.resolve();
      },
    },
  };
  const sandbox = {
    console, setInterval, clearInterval, setTimeout, clearTimeout,
    Date, Math, Number, String, JSON, Promise, document, navigator, localStorage,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Image: function Image() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = () => {};
  const context = vm.createContext(sandbox);
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/occupancy.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/calibrate.js'), 'utf8'), context);
  const html = fs.readFileSync(path.join(root, 'pilot-calibrate.html'), 'utf8');
  const start = html.indexOf('<script>\n"use strict";');
  const code = html.slice(start + '<script>\n'.length, html.lastIndexOf('</script>'));
  vm.runInContext(
    code + '\nglobalThis.__api = { state, copySummary, resetCalibrate, startClock, refreshActionButtons, renderSpotList };',
    context,
  );
  return {
    api: context.__api,
    byId: (id) => document.getElementById(id),
    copied,
    store,
    navigator,
    document,
  };
}

test('copy and reset stay disabled until there is something to copy or clear', () => {
  const page = boot();
  const copyBtn = page.byId('btnCopySummary');
  const resetBtn = page.byId('btnReset');
  assert.equal(copyBtn.disabled, true);
  assert.equal(resetBtn.disabled, true);

  page.api.startClock();
  assert.equal(copyBtn.disabled, true);
  assert.equal(resetBtn.disabled, false);

  page.api.state.spots.push({ id: 's1', x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  page.api.renderSpotList();
  assert.equal(copyBtn.disabled, false);

  page.api.resetCalibrate();
  assert.equal(page.api.state.spots.length, 0);
  assert.equal(page.api.state.startedAt, null);
  assert.equal(copyBtn.disabled, true);
  assert.equal(resetBtn.disabled, true);
  assert.equal(page.byId('calStatus').textContent, 'הכיול אופס בהצלחה.');
  assert.equal(page.byId('timer').textContent, '03:00');
});

test('stored calibration enables reset only, and reset removes those keys', () => {
  const page = boot();
  page.store.set('pw_pilot_calibration', '{"version":2}');
  page.store.set('pw_pilot_spots', '{"spots":[]}');
  page.store.set('pw_pilot_last_estimate', '[]');
  page.store.set('pw_pilot_street', 'הרצל');
  page.api.refreshActionButtons();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, false);
  page.api.resetCalibrate();
  assert.equal(page.store.has('pw_pilot_calibration'), false);
  assert.equal(page.store.has('pw_pilot_spots'), false);
  assert.equal(page.store.has('pw_pilot_last_estimate'), false);
  assert.equal(page.store.has('pw_pilot_street'), false);
  assert.equal(page.byId('btnReset').disabled, true);
});

test('העתק סיכום writes the Hebrew summary and announces it on the live region', async () => {
  const page = boot();
  page.byId('streetName').value = 'הרצל, נתניה';
  page.api.state.spots.push({ id: 's1', x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  page.api.state.estimates.push({ occupied: true }, { occupied: false });
  page.api.state.lastLot = { lighting: 'day', confidence: 0.5 };
  await page.api.copySummary();
  assert.equal(page.copied.length, 1);
  assert.match(page.copied[0], /ParkWiz — סיכום כיול מגרש/);
  assert.match(page.copied[0], /אתר: הרצל, נתניה/);
  assert.match(page.copied[0], /מקומות מסומנים: 1/);
  assert.match(page.copied[0], /תפוסים \(הערכה\): 1/);
  assert.match(page.copied[0], /פנויים \(הערכה\): 1/);
  assert.match(page.copied[0], /תאורה: יום/);
  assert.match(page.copied[0], /רמת ביטחון: 0\.50/);
  assert.equal(page.byId('calStatus').textContent, 'סיכום הכיול הועתק ללוח.');
});

test('copy with no spots announces the blocker and leaves the clipboard alone', async () => {
  const page = boot();
  await page.api.copySummary();
  assert.equal(page.copied.length, 0);
  assert.equal(page.byId('calStatus').textContent, 'אין נתוני כיול להעתקה.');
});

test('copy falls back to execCommand and reports a failure on the live region', async () => {
  const page = boot();
  page.api.state.spots.push({ id: 's1', x: 0, y: 0, w: 0.2, h: 0.2 });
  page.navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
  let commands = 0;
  page.document.execCommand = (cmd) => {
    commands += 1;
    return cmd === 'copy';
  };
  await page.api.copySummary();
  assert.equal(commands, 1);
  assert.equal(page.copied.length, 0);
  assert.equal(page.byId('calStatus').textContent, 'סיכום הכיול הועתק ללוח.');

  page.document.execCommand = () => false;
  await page.api.copySummary();
  assert.equal(page.byId('calStatus').textContent, 'לא ניתן להעתיק ללוח בדפדפן זה.');
});
