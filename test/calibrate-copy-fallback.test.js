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
    removeChild(child) {
      const i = node.children.indexOf(child);
      if (i >= 0) node.children.splice(i, 1);
      return child;
    },
    replaceChildren() { node.children.length = 0; },
    select() { node.selected = true; },
    getContext() {
      return { clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {}, setLineDash() {} };
    },
  };
  return node;
}

function boot(clipboard) {
  const elements = new Map();
  const document = {
    createElement: (tag) => makeEl(tag),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    execCommand() { return false; },
  };
  document.body = makeEl('body');
  const copied = [];
  const navigator = {};
  if (clipboard) navigator.clipboard = clipboard;
  const sandbox = {
    console,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Date, Math, Number, String, JSON, Promise,
    document,
    navigator,
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
  vm.runInContext(code + '\nglobalThis.__api = { state, copySummary };', context);
  return {
    api: context.__api,
    byId: (id) => document.getElementById(id),
    document,
    copied,
  };
}

function markSpot(page) {
  page.byId('streetName').value = 'הרצל, נתניה';
  page.api.state.startedAt = Date.now() - 125000;
  page.api.state.spots.push({ id: 's1', x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  page.api.state.estimates.push({ occupied: true }, { occupied: false });
  page.api.state.lastLot = { lighting: 'day', confidence: 0.5 };
}

test('clipboard success announces the copy and writes the Hebrew summary', async () => {
  const page = boot({
    writeText(text) {
      page.copied.push(text);
      return Promise.resolve();
    },
  });
  markSpot(page);
  await page.api.copySummary();
  assert.equal(page.copied.length, 1);
  assert.match(page.copied[0], /ParkWiz — סיכום כיול מגרש/);
  assert.match(page.copied[0], /אתר: הרצל, נתניה/);
  assert.match(page.copied[0], /זמן כיול: 02:05/);
  assert.match(page.copied[0], /מקומות מסומנים: 1/);
  assert.match(page.copied[0], /תפוסים \(הערכה\): 1/);
  assert.match(page.copied[0], /פנויים \(הערכה\): 1/);
  assert.match(page.copied[0], /תאורה: יום/);
  assert.match(page.copied[0], /רמת ביטחון: 0\.50/);
  assert.equal(page.byId('estNote').textContent, 'סיכום הכיול הועתק ללוח.');
  assert.equal(page.document.body.children.length, 0);
});

test('a rejected clipboard write falls back to execCommand and still announces success', async () => {
  const page = boot({
    writeText() { return Promise.reject(new Error('denied')); },
  });
  markSpot(page);
  let commands = 0;
  page.document.execCommand = (cmd) => {
    commands += 1;
    return cmd === 'copy';
  };
  await page.api.copySummary();
  assert.equal(commands, 1);
  assert.equal(page.copied.length, 0);
  assert.equal(page.byId('estNote').textContent, 'סיכום הכיול הועתק ללוח.');
  assert.equal(page.document.body.children.length, 0);
});

test('copy with no clipboard and a failed execCommand announces the failure', async () => {
  const page = boot(null);
  markSpot(page);
  let commands = 0;
  page.document.execCommand = () => {
    commands += 1;
    return false;
  };
  await page.api.copySummary();
  assert.equal(commands, 1);
  assert.equal(page.byId('estNote').textContent, 'לא ניתן להעתיק ללוח בדפדפן זה.');
  assert.equal(page.document.body.children.length, 0);

  page.document.execCommand = () => { throw new Error('blocked'); };
  await page.api.copySummary();
  assert.equal(page.byId('estNote').textContent, 'לא ניתן להעתיק ללוח בדפדפן זה.');
});

test('copy with no spots announces the blocker and does not touch the clipboard', async () => {
  const page = boot({
    writeText(text) {
      page.copied.push(text);
      return Promise.resolve();
    },
  });
  let commands = 0;
  page.document.execCommand = () => { commands += 1; return true; };
  await page.api.copySummary();
  assert.equal(page.copied.length, 0);
  assert.equal(commands, 0);
  assert.equal(page.byId('estNote').textContent, 'אין נתוני כיול להעתקה.');
});
