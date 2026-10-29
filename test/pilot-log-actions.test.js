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
    checked: false,
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
  };
  Object.defineProperty(node, 'innerHTML', {
    get() { return ''; },
    set() { node.children.length = 0; },
  });
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
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/occupancy.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/compare.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/protocol.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lib/export.js'), 'utf8'), context);
  const html = fs.readFileSync(path.join(root, 'pilot-log.html'), 'utf8');
  const start = html.indexOf('<script>\n"use strict";');
  const code = html.slice(start + '<script>\n'.length, html.lastIndexOf('</script>'));
  vm.runInContext(
    code + '\nglobalThis.__api = { state, copySummary, resetFlags, refreshActionButtons, render };',
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

function fillDay(page) {
  page.api.state.days[0] = {
    day: 1,
    date: '2026-08-01',
    lighting: 'יום',
    total: 10,
    systemOccupied: 8,
    manualOccupied: 8,
    note: '',
    source: 'field',
  };
}

test('copy, export, and reset stay disabled until there is something to act on', () => {
  const page = boot();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnCsv').disabled, true);
  assert.equal(page.byId('btnJson').disabled, true);
  assert.equal(page.byId('btnClear').disabled, true);
  assert.equal(page.byId('btnResetFlags').disabled, true);

  page.byId('streetName').value = 'ויצמן, נתניה';
  page.api.render();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnCsv').disabled, true);
  assert.equal(page.byId('btnResetFlags').disabled, false);

  fillDay(page);
  page.api.render();
  assert.equal(page.byId('btnCopySummary').disabled, false);
  assert.equal(page.byId('btnCsv').disabled, false);
  assert.equal(page.byId('btnJson').disabled, false);
  assert.equal(page.byId('btnClear').disabled, false);

  page.byId('fileLog').value = 'pilot-log.json';
  page.api.state.selected = 4;
  page.api.resetFlags();
  assert.equal(page.api.state.selected, 1);
  assert.equal(page.byId('streetName').value, 'הרצל, נתניה');
  assert.equal(page.byId('fileLog').value, '');
  assert.equal(page.api.state.days[0].total, null);
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnResetFlags').disabled, true);
  assert.equal(page.byId('status').textContent, 'תנאי הפיילוט והיומן אופסו לברירת המחדל.');
});

test('stored log enables reset only, and reset removes those keys', () => {
  const page = boot();
  page.store.set('pw_pilot_log', '[]');
  page.store.set('pw_pilot_log_meta', '{"street":"הרצל, נתניה","startDate":"2026-08-01"}');
  page.api.refreshActionButtons();
  assert.equal(page.byId('btnCopySummary').disabled, true);
  assert.equal(page.byId('btnResetFlags').disabled, false);
  page.api.resetFlags();
  assert.equal(page.store.has('pw_pilot_log'), false);
  assert.equal(page.store.has('pw_pilot_log_meta'), false);
  assert.equal(page.byId('btnResetFlags').disabled, true);
});

test('העתק סיכום writes the Hebrew summary and announces it on the live region', async () => {
  const page = boot();
  page.byId('streetName').value = 'הרצל, נתניה';
  fillDay(page);
  await page.api.copySummary();
  assert.equal(page.copied.length, 1);
  assert.match(page.copied[0], /ParkWiz — סיכום יומן שדה 30 יום/);
  assert.match(page.copied[0], /אתר: הרצל, נתניה/);
  assert.match(page.copied[0], /תאריך התחלה: 2026-08-01/);
  assert.match(page.copied[0], /ימים עם ספירה: 1 מתוך 30/);
  assert.match(page.copied[0], /הסכם מול פקח: 100%/);
  assert.match(page.copied[0], /פסק דין: מדגם קטן מדי — ממשיכים לאסוף\. \(INSUFFICIENT\)/);
  assert.equal(page.byId('status').textContent, 'סיכום יומן השדה הועתק ללוח.');
  assert.equal(page.byId('status').style.color, 'var(--brand)');
});

test('copy with no counted days announces the blocker and leaves the clipboard alone', async () => {
  const page = boot();
  await page.api.copySummary();
  assert.equal(page.copied.length, 0);
  assert.equal(page.byId('status').textContent, 'אין ימים עם ספירה להעתקת סיכום.');
  assert.equal(page.byId('status').style.color, 'var(--occ)');
});

test('copy falls back to execCommand and reports a failure on the live region', async () => {
  const page = boot();
  fillDay(page);
  page.navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
  let commands = 0;
  page.document.execCommand = (cmd) => {
    commands += 1;
    return cmd === 'copy';
  };
  await page.api.copySummary();
  assert.equal(commands, 1);
  assert.equal(page.copied.length, 0);
  assert.equal(page.byId('status').textContent, 'סיכום יומן השדה הועתק ללוח.');

  page.document.execCommand = () => false;
  await page.api.copySummary();
  assert.equal(page.byId('status').textContent, 'לא ניתן להעתיק ללוח בדפדפן זה.');
  assert.equal(page.byId('status').style.color, 'var(--occ)');
});
