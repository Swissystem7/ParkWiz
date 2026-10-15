const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pwa.js'), 'utf8');

function fakeEl() {
  const classes = new Set();
  const handlers = {};
  return {
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c) },
    addEventListener: (t, fn) => { handlers[t] = fn; },
    setAttribute() {},
    handlers,
  };
}

function boot() {
  const btn = fakeEl();
  const winHandlers = {};
  const document = {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { firstChild: null, insertBefore() {} },
    getElementById: (id) => (id === 'pwInstallBtn' ? btn : null),
    createElement: () => fakeEl(),
    addEventListener() {},
  };
  const window = { addEventListener: (t, fn) => { winHandlers[t] = fn; } };
  const navigator = { onLine: true };
  vm.runInNewContext(src, { document, window, navigator, globalThis: {} });
  return { btn, winHandlers };
}

test('install button hides when the app is installed from the browser menu', () => {
  const { btn, winHandlers } = boot();
  let prompted = 0;
  winHandlers.beforeinstallprompt({ preventDefault() {}, prompt() { prompted++; } });
  assert.equal(btn.classList.has('show'), true);
  winHandlers.appinstalled({});
  assert.equal(btn.classList.has('show'), false);
  btn.handlers.click();
  assert.equal(prompted, 0, 'a spent prompt must not be replayed');
});

test('install button still prompts once when no install happened elsewhere', () => {
  const { btn, winHandlers } = boot();
  let prompted = 0;
  winHandlers.beforeinstallprompt({ preventDefault() {}, prompt() { prompted++; } });
  btn.handlers.click();
  btn.handlers.click();
  assert.equal(prompted, 1);
  assert.equal(btn.classList.has('show'), false);
});
