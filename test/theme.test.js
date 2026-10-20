// Design system + light/dark theme (#339).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const theme = require('../src/lib/theme.js');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tokens = read('src/ui/tokens.css');

test('a stored choice wins; otherwise the OS preference decides; dark is the fallback', () => {
  assert.equal(theme.resolveTheme('light', false), 'light');
  assert.equal(theme.resolveTheme('dark', true), 'dark');
  assert.equal(theme.resolveTheme(null, true), 'light');
  assert.equal(theme.resolveTheme(null, false), 'dark');
  assert.equal(theme.resolveTheme('sepia', false), 'dark', 'junk in storage is ignored');
  assert.equal(theme.nextTheme('light'), 'dark');
  assert.equal(theme.nextTheme('dark'), 'light');
});

test('the toggle names the theme it switches to, in Hebrew', () => {
  assert.match(theme.toggleLabel('dark'), /בהירה/);
  assert.match(theme.toggleLabel('light'), /כהה/);
});

function fakeDoc() {
  const attrs = {};
  const meta = { content: '', setAttribute(k, v) { this[k] = v; } };
  return {
    attrs, meta,
    documentElement: { setAttribute(k, v) { attrs[k] = v; } },
    querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? meta : null),
  };
}

test('apply() sets data-theme and the browser chrome colour', () => {
  const doc = fakeDoc();
  theme.apply(doc, 'light');
  assert.equal(doc.attrs['data-theme'], 'light');
  assert.equal(doc.meta.content, theme.THEME_COLOR.light);
});

test('boot() survives a browser that blocks localStorage', () => {
  const doc = Object.assign(fakeDoc(), { addEventListener() {} });
  const win = { get localStorage() { throw new Error('denied'); }, matchMedia: () => ({ matches: true }) };
  theme.boot(doc, win);
  assert.equal(doc.attrs['data-theme'], 'light');
});

// WCAG relative luminance contrast for #rrggbb pairs.
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function block(selector) {
  const start = tokens.indexOf(selector + '{');
  return tokens.slice(start, tokens.indexOf('}', start));
}
function token(css, name) {
  const m = new RegExp('--pw-' + name + ':(#[0-9a-f]{6})').exec(css);
  assert.ok(m, 'missing solid token --pw-' + name);
  return m[1];
}

for (const [label, css] of [['dark', block(':root')], ['light', block('[data-theme="light"]')]]) {
  test(`${label} theme text colours pass WCAG AA (4.5:1)`, () => {
    for (const bgName of ['bg', 'surface', 'surface-2']) {
      const bg = token(css, bgName);
      for (const fg of ['ink', 'muted', 'brand', 'warn', 'danger', 'info', 'accent']) {
        const ratio = contrast(token(css, fg), bg);
        assert.ok(ratio >= 4.5, `${label}: --pw-${fg} on --pw-${bgName} is ${ratio.toFixed(2)}:1`);
      }
    }
    const onBrand = contrast(token(css, 'on-brand'), token(css, 'brand'));
    assert.ok(onBrand >= 4.5, `${label}: text on the brand fill is ${onBrand.toFixed(2)}:1`);
  });
}

test('driver map and lot-manager page load the design system before first paint', () => {
  for (const [page, prefix] of [['index.html', ''], ['demo/atidim.html', '../']]) {
    const html = read(page);
    const head = html.slice(0, html.indexOf('</head>'));
    assert.ok(head.includes(`<link rel="stylesheet" href="${prefix}src/ui/tokens.css">`), page);
    assert.ok(head.includes(`<script src="${prefix}src/lib/theme.js"></script>`), page);
    assert.match(html, /class="pw-theme-toggle" data-theme-toggle aria-label="[^"]+"/, page);
  }
  assert.match(read('index.html'), /<link rel="stylesheet" href="src\/ui\/driver\.css">/);
});

test('fonts stay local: no web-font CDN (the pages must work offline)', () => {
  assert.doesNotMatch(tokens, /@import|url\(\s*["']?https?:/);
  assert.match(tokens, /--pw-font:'Heebo','Rubik'/);
});
