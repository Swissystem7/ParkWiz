const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('streetCardOverlay has accessible region role and label', () => {
  assert.match(html, /id="streetCardOverlay"[^>]*role="region"[^>]*aria-label="פרטי רחוב נבחר"/);
});

test('streetCard has dialog role, aria-modal, aria-labelledby, and accessible close button', () => {
  assert.match(html, /id="streetCard"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="scName"/);
  assert.match(html, /<button type="button" class="sc-close" id="scCloseBtn" onclick="closeStreetCard\(event\)" aria-label="סגור פרטי רחוב"/);
  assert.match(html, /function closeStreetCard\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#scCloseBtn'\)/);
});

test('streetCard actions include reserve button wired to openReserve', () => {
  assert.match(html, /<button class="sc-btn" id="scReserveBtn" onclick="openReserve\(selectedStreetIdx\)">/);
  assert.match(html, /function openReserve\(id\)\s*\{[\s\S]*?const streetIdx = id != null \? id : selectedStreetIdx;[\s\S]*?reserveAddr/);
});

test('reserveModal has accessible dialog attributes', () => {
  assert.match(html, /<div class="reserve-modal" id="reserveModal" role="dialog" aria-modal="true" aria-labelledby="reserveTitle">/);
  assert.match(html, /<h3 id="reserveTitle">/);
});
