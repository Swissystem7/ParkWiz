// Extended unit tests for src/lib/theme.js
// Tests branches: exported API, matchMedia dark/light, localStorage get/set, storage that throws, toggling.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const theme = require('../src/lib/theme.js');

const themePath = path.resolve(__dirname, '../src/lib/theme.js');

// Save pristine references to any pre-existing global properties
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  localStorage: globalThis.localStorage,
  matchMedia: globalThis.matchMedia,
};

function restoreGlobals() {
  for (const key of ['window', 'document', 'localStorage', 'matchMedia']) {
    if (originalGlobals[key] === undefined) {
      delete globalThis[key];
    } else {
      globalThis[key] = originalGlobals[key];
    }
  }
}

afterEach(() => {
  restoreGlobals();
});

function createMockElement(tag = 'div') {
  const attrs = {};
  const listeners = {};
  return {
    tag,
    attrs,
    listeners,
    textContent: '',
    setAttribute(k, v) {
      attrs[k] = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    addEventListener(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    click() {
      if (listeners.click) {
        for (const fn of listeners.click) fn();
      }
    },
  };
}

function createMockDocument(options = {}) {
  const { includeMeta = true, buttonCount = 1 } = options;
  const docAttrs = {};
  const docListeners = {};
  const meta = includeMeta ? createMockElement('meta') : null;
  const buttons = Array.from({ length: buttonCount }, () => createMockElement('button'));

  return {
    docAttrs,
    docListeners,
    meta,
    buttons,
    documentElement: {
      setAttribute(k, v) {
        docAttrs[k] = String(v);
      },
      getAttribute(k) {
        return Object.prototype.hasOwnProperty.call(docAttrs, k) ? docAttrs[k] : null;
      },
    },
    querySelector(sel) {
      if (sel === 'meta[name="theme-color"]') return meta;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-theme-toggle]') return buttons;
      return [];
    },
    addEventListener(event, fn) {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(fn);
    },
    dispatchDOMContentLoaded() {
      if (docListeners.DOMContentLoaded) {
        for (const fn of docListeners.DOMContentLoaded) fn();
      }
    },
  };
}

function createMockWindow(options = {}) {
  const { storedTheme = null, prefersLight = false, throwGet = false, throwSet = false, hasMatchMedia = true } = options;
  const store = {};
  if (storedTheme !== null) {
    store[theme.KEY] = storedTheme;
  }

  const localStorage = {
    getItem(k) {
      if (throwGet) throw new Error('localStorage.getItem blocked');
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k, v) {
      if (throwSet) throw new Error('localStorage.setItem blocked');
      store[k] = String(v);
    },
    _store: store,
  };

  const win = {
    localStorage,
  };

  if (hasMatchMedia) {
    win.matchMedia = (query) => ({
      matches: query === '(prefers-color-scheme: light)' ? !!prefersLight : false,
    });
  }

  return { win, localStorage, store };
}

test('exported API matches expected interface and constants', () => {
  assert.equal(theme.KEY, 'parkwiz_theme');
  assert.deepEqual(theme.THEME_COLOR, { dark: '#0f1a19', light: '#f3f5f4' });
  assert.equal(typeof theme.resolveTheme, 'function');
  assert.equal(typeof theme.nextTheme, 'function');
  assert.equal(typeof theme.toggleLabel, 'function');
  assert.equal(typeof theme.toggleIcon, 'function');
  assert.equal(typeof theme.apply, 'function');
  assert.equal(typeof theme.boot, 'function');
});

test('toggleIcon returns moon for light theme and sun for dark theme', () => {
  assert.equal(theme.toggleIcon('light'), '🌙');
  assert.equal(theme.toggleIcon('dark'), '☀️');
});

test('apply handles documents without a theme-color meta tag gracefully', () => {
  const doc = createMockDocument({ includeMeta: false });
  theme.apply(doc, 'dark');
  assert.equal(doc.docAttrs['data-theme'], 'dark');
  assert.equal(doc.meta, null);

  theme.apply(doc, 'light');
  assert.equal(doc.docAttrs['data-theme'], 'light');
});

test('boot with stubbed globals: resolves light theme from prefers-color-scheme when storage is empty', () => {
  const doc = createMockDocument({ buttonCount: 2 });
  const { win } = createMockWindow({ storedTheme: null, prefersLight: true });

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = win.localStorage;
  globalThis.matchMedia = win.matchMedia;

  theme.boot(globalThis.document, globalThis.window);

  assert.equal(doc.docAttrs['data-theme'], 'light');
  assert.equal(doc.meta.attrs.content, theme.THEME_COLOR.light);

  // Trigger DOMContentLoaded
  doc.dispatchDOMContentLoaded();

  // Both buttons painted for light theme
  for (const btn of doc.buttons) {
    assert.equal(btn.textContent, '🌙');
    assert.equal(btn.getAttribute('aria-label'), theme.toggleLabel('light'));
  }

  // Click first button -> toggles to dark
  doc.buttons[0].click();
  assert.equal(win.localStorage._store[theme.KEY], 'dark');
  assert.equal(doc.docAttrs['data-theme'], 'dark');
  assert.equal(doc.meta.attrs.content, theme.THEME_COLOR.dark);
  for (const btn of doc.buttons) {
    assert.equal(btn.textContent, '☀️');
  }

  // Click second button -> toggles back to light
  doc.buttons[1].click();
  assert.equal(win.localStorage._store[theme.KEY], 'light');
  assert.equal(doc.docAttrs['data-theme'], 'light');
  for (const btn of doc.buttons) {
    assert.equal(btn.textContent, '🌙');
  }
});

test('boot with stubbed globals: resolves dark theme when prefers-color-scheme is dark and storage is empty', () => {
  const doc = createMockDocument();
  const { win } = createMockWindow({ storedTheme: null, prefersLight: false });

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = win.localStorage;
  globalThis.matchMedia = win.matchMedia;

  theme.boot(globalThis.document, globalThis.window);

  assert.equal(doc.docAttrs['data-theme'], 'dark');
  assert.equal(doc.meta.attrs.content, theme.THEME_COLOR.dark);

  doc.dispatchDOMContentLoaded();
  assert.equal(doc.buttons[0].textContent, '☀️');
});

test('boot with stubbed globals: stored theme takes precedence over matchMedia', () => {
  const doc = createMockDocument();
  // matchMedia says light, but storage says dark
  const { win } = createMockWindow({ storedTheme: 'dark', prefersLight: true });

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = win.localStorage;
  globalThis.matchMedia = win.matchMedia;

  theme.boot(globalThis.document, globalThis.window);
  assert.equal(doc.docAttrs['data-theme'], 'dark');

  // matchMedia says dark, but storage says light
  const doc2 = createMockDocument();
  const win2 = createMockWindow({ storedTheme: 'light', prefersLight: false }).win;
  theme.boot(doc2, win2);
  assert.equal(doc2.docAttrs['data-theme'], 'light');
});

test('boot falls back to dark when matchMedia is missing on window', () => {
  const doc = createMockDocument();
  const { win } = createMockWindow({ storedTheme: null, hasMatchMedia: false });

  globalThis.document = doc;
  globalThis.window = win;

  theme.boot(doc, win);
  assert.equal(doc.docAttrs['data-theme'], 'dark');
});

test('boot handles localStorage.setItem throwing on toggle click', () => {
  const doc = createMockDocument({ buttonCount: 1 });
  const { win } = createMockWindow({ storedTheme: 'light', throwSet: true });

  globalThis.document = doc;
  globalThis.window = win;

  theme.boot(doc, win);
  doc.dispatchDOMContentLoaded();

  // Should not throw even when setItem throws
  assert.doesNotThrow(() => {
    doc.buttons[0].click();
  });

  // The UI is still updated to dark
  assert.equal(doc.docAttrs['data-theme'], 'dark');
  assert.equal(doc.buttons[0].textContent, '☀️');
});

test('auto-boot runs on module load when document and window globals are defined', () => {
  const doc = createMockDocument({ buttonCount: 1 });
  const { win } = createMockWindow({ storedTheme: 'light' });

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = win.localStorage;
  globalThis.matchMedia = win.matchMedia;

  // Clear module from require cache and re-require with globals set
  delete require.cache[themePath];
  const reloadedTheme = require(themePath);

  assert.equal(doc.docAttrs['data-theme'], 'light');
  assert.equal(typeof reloadedTheme.boot, 'function');

  // Clean cache for subsequent tests
  delete require.cache[themePath];
  require(themePath);
});
