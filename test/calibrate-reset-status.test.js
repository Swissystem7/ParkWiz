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
    removeAttribute() {},
    addEventListener() {},
    appendChild(child) { node.children.push(child); return child; },
    removeChild(child) { return child; },
    replaceChildren() { node.children.length = 0; },
    select() {},
    click() {},
    getContext() { return { clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {}, setLineDash() {} }; },
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
    execCommand() { return false; },
    body: makeEl('body'),
  };
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const sandbox = {
    console,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(fn) { fn(); return 1; },
    clearTimeout() {},
    Date, Math, Number, String, JSON, Promise, Blob,
    document, localStorage,
    navigator: {},
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Image: function Image() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = () => {};
  const context = vm.createContext(sandbox);
  const root = path.join(__dirname, '..');
  for (const file of ['src/lib/occupancy.js', 'src/lib/heuristic.js', 'src/lib/calibrate.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  const html = fs.readFileSync(path.join(root, 'pilot-calibrate.html'), 'utf8');
  const start = html.indexOf('<script>\n"use strict";');
  const code = html.slice(start + '<script>\n'.length, html.lastIndexOf('</script>'));
  vm.runInContext(
    code + '\nglobalThis.__api = { state, savePack, resetCalibrate, refreshActionButtons };',
    context,
  );
  return { api: context.__api, byId: (id) => document.getElementById(id), store };
}

test('a stored pack enables reset, and reset removes those keys and the file inputs', () => {
  const page = boot();
  page.store.set('pw_pilot_calibration', '{"version":2}');
  page.store.set('pw_pilot_spots', '{"spots":[]}');
  page.store.set('pw_pilot_last_estimate', '[]');
  page.store.set('pw_pilot_street', 'הרצל');
  page.byId('fileSnap').value = 'lot.png';
  page.byId('fileEmpty').value = 'empty.png';
  page.byId('fileNight').value = 'night.png';
  page.api.refreshActionButtons();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, false);

  page.api.resetCalibrate();
  for (const key of ['pw_pilot_calibration', 'pw_pilot_spots', 'pw_pilot_last_estimate', 'pw_pilot_street']) {
    assert.equal(page.store.has(key), false, key);
  }
  assert.equal(page.byId('fileSnap').value, '');
  assert.equal(page.byId('fileEmpty').value, '');
  assert.equal(page.byId('fileNight').value, '');
  assert.equal(page.byId('btnReset').disabled, true);
  assert.equal(page.byId('calStatus').textContent, '');
  assert.match(page.byId('timerNote').textContent, /^הכיול אופס\./);
});

test('a saved pack is announced on calStatus and estNote keeps its own sentence', () => {
  const page = boot();
  const estimateNote = 'עדיין לא חושב. אחרי הייחוס הריק — «חשב תפוסה».';
  page.byId('estNote').textContent = estimateNote;
  page.api.state.spots.push({ id: 's1', x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  page.api.savePack();
  assert.match(page.byId('calStatus').textContent, /כיול נשמר \(השעון לא הופעל — אין זמן למדוד\)/);
  assert.equal(page.byId('estNote').textContent, estimateNote);
  assert.equal(page.store.has('pw_pilot_calibration'), true);
  assert.equal(page.store.has('pw_pilot_spots'), true);

  page.api.state.startedAt = Date.now() - 1000;
  page.api.savePack();
  assert.match(page.byId('calStatus').textContent, /כיול נשמר תוך \d\d:\d\d\. הקובץ מסומן heuristic-occupancy\./);
  assert.equal(page.byId('estNote').textContent, estimateNote);
  assert.notEqual(page.byId('calStatus').textContent, page.byId('estNote').textContent);
});
