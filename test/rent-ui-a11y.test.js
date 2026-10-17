const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('rentOverlay has region role and accessible label', () => {
  assert.match(html, /id="rentOverlay"[^>]*onclick="closeRent\(event\)"[^>]*role="region"[^>]*aria-label="השכרת חניה פרטית"/);
});

test('rent dialog container has dialog role, aria-modal, and aria-labelledby', () => {
  assert.match(html, /class="rent-box"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="rentTitle"/);
});

test('openRent generates accessible title and close button', () => {
  assert.match(html, /id="rentTitle"[^>]*>🏠 השכרת חניה — \$\{p\.owner\}<\/div>/);
  assert.match(html, /<button type="button" class="rent-close" id="rentCloseBtn" onclick="closeRent\(event\)" aria-label="סגור חלון השכרת חניה"/);
});

test('openRent includes accessible form controls and live status calculation', () => {
  assert.match(html, /<label for="rentHours"[^>]*>⏱ לכמה שעות\? \(התחייבות!\)<\/label>/);
  assert.match(html, /<select id="rentHours"[^>]*aria-label="משך השכרת החניה בשעות"/);
  assert.match(html, /<div id="rentCalc"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<input type="checkbox" id="rentTerms"[^>]*aria-label="אישור תנאי התחייבות וגרירה"/);
});

test('simulated credit card inputs have descriptive aria-labels', () => {
  assert.match(html, /<input id="rentCardNum"[^>]*aria-label="מספר כרטיס אשראי \(הדמיה\)"/);
  assert.match(html, /<input id="rentCardExp"[^>]*aria-label="תוקף כרטיס MM\/YY \(הדמיה\)"/);
  assert.match(html, /<input id="rentCardCvv"[^>]*aria-label="קוד אבטחה CVV \(הדמיה\)"/);
});

test('rentCancelBtn is a semantic button wired to closeRent', () => {
  assert.match(html, /<button type="button" id="rentCancelBtn" onclick="closeRent\(event\)"[^>]*>ביטול<\/button>/);
});

test('closeRent guards against clicks inside dialog content', () => {
  assert.match(html, /function closeRent\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#rentCloseBtn'\) && !e\.target\.closest\('#rentCancelBtn'\)/);
});

test('escape key listener closes rent modal when active', () => {
  assert.match(html, /window\.addEventListener\('keydown',\s*\(e\)\s*=>\s*\{[\s\S]*?e\.key === 'Escape'[\s\S]*?closeRent\(\)/);
});

test('service worker cache bumped to v18 for rent modal a11y updates', () => {
  assert.match(sw, /const CACHE = 'parkwiz-field-v18';/);
});
