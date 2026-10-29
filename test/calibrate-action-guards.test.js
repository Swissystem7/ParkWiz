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
    classList: {
      toggle() {},
      add() {},
      remove() {},
    },
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; },
    removeAttribute(k) { delete node.attrs[k]; },
    addEventListener() {},
    appendChild(child) { node.children.push(child); return child; },
    replaceChildren() { node.children.length = 0; },
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
  };
  const sandbox = {
    console,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Date,
    Math,
    Number,
    String,
    JSON,
    Promise,
    document,
    navigator: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Image: function Image() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = () => {};
  const context = vm.createContext(sandbox);
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/occupancy.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/heuristic.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/calibrate.js'), 'utf8'), context);
  const html = fs.readFileSync(path.join(root, 'pilot-calibrate.html'), 'utf8');
  const start = html.indexOf('<script>\n"use strict";');
  const code = html.slice(start + '<script>\n'.length, html.lastIndexOf('</script>'));
  vm.runInContext(
    code + '\nglobalThis.__api = { state, startClock, renderSpotList, resetCalibrate, showEmptyNote };',
    context,
  );
  return { api: context.__api, byId: (id) => document.getElementById(id) };
}

test('copy and reset stay disabled on an empty wizard', () => {
  const page = boot();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, true);

  const note = 'השעון מתחיל בלחיצה על «התחל כיול». היעד הוא 3 דקות, לא SLA.';
  page.byId('timerNote').textContent = note;
  page.api.resetCalibrate();
  assert.equal(page.byId('timerNote').textContent, note);
  assert.equal(page.api.state.startedAt, 0);
  assert.equal(page.byId('btnReset').disabled, true);
});

test('starting the clock enables reset only, and reset disables it again', () => {
  const page = boot();
  page.api.startClock();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, false);

  page.api.resetCalibrate();
  assert.equal(page.api.state.startedAt, null);
  assert.equal(page.api.state.spots.length, 0);
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, true);
  assert.match(page.byId('timerNote').textContent, /^הכיול אופס\./);
  assert.equal(page.byId('calStatus').textContent, '');
});

test('a marked spot enables copy; an empty frame enables reset without enabling copy', () => {
  const page = boot();
  page.api.state.hasEmpty = true;
  page.api.showEmptyNote();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, false);
  assert.match(page.byId('emptyNote').textContent, /יש ייחוס יום/);

  page.api.state.spots.push({ id: 's1', x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  page.api.renderSpotList();
  assert.equal(page.byId('btnCopySummary').disabled, false);
  assert.equal(page.byId('spotsEmpty').style.display, 'none');

  page.api.resetCalibrate();
  assert.equal(page.api.state.spots.length, 0);
  assert.equal(page.api.state.hasEmpty, false);
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnReset').disabled, true);
  assert.equal(page.byId('spotsEmpty').style.display, 'block');
});
