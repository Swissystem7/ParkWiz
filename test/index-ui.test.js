const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('index.html has accessible status region on toast', () => {
  assert.match(html, /<div class="toast" id="toast" role="status" aria-live="polite"><\/div>/);
});

test('index.html has accessible semantic bottom navigation', () => {
  assert.match(html, /<nav class="bottom-nav" role="navigation" aria-label="ניווט ראשי">/);
  assert.match(html, /id="navMap"[^>]*aria-current="page"/);
  assert.match(html, /b\.removeAttribute\('aria-current'\)/);
  assert.match(html, /activeBtn\.setAttribute\('aria-current',\s*'page'\)/);
});

test('index.html spots list has region role, a11y label, and empty state handling', () => {
  assert.match(html, /id="spotsList"[^>]*role="region"[^>]*aria-label="רשימת רחובות קרובים"/);
  assert.match(html, /if\s*\(!sorted\.length\)\s*\{[\s\S]*?id="spotsEmpty"[\s\S]*?לא נמצאו רחובות התואמים לסינון הנבחר/);
});

test('index.html history sheet has region role, close button, aria-hidden sync, and empty state handling', () => {
  assert.match(html, /id="historySheet"[^>]*role="region"[^>]*aria-label="היסטוריית חניות"[^>]*aria-hidden="true"/);
  assert.match(html, /<button[^>]*id="historyCloseBtn"[^>]*aria-label="סגור היסטוריית חניות"/);
  assert.match(html, /sheet\.setAttribute\('aria-hidden',\s*historyOpen\s*\?\s*'false'\s*:\s*'true'\)/);
  assert.match(html, /if\s*\(!HISTORY\s*\|\|\s*!HISTORY\.length\)\s*\{[\s\S]*?id="historyEmpty"[\s\S]*?אין היסטוריית חניות עדיין/);
});
