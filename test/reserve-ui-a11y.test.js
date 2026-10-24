'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('reserveModal has dialog role, aria-modal, and aria-labelledby', () => {
  assert.match(html, /<div class="reserve-modal" id="reserveModal" role="dialog" aria-modal="true" aria-labelledby="reserveTitle">/);
  assert.match(html, /<h3 id="reserveTitle">/);
});

test('reserveModal includes accessible close button and semantic action buttons', () => {
  assert.match(html, /<button type="button" class="reserve-close" id="reserveCloseBtn" onclick="closeReserve\(event\)" aria-label="סגור חלון הזמנה"/);
  assert.match(html, /<button type="button" class="btn-cancel-r" id="reserveCancelBtn" onclick="closeReserve\(event\)">ביטול<\/button>/);
  assert.match(html, /<button type="button" class="btn-confirm" id="reserveConfirmBtn" onclick="confirmReserve\(\)">✅ הזמן עכשיו<\/button>/);
});

test('closeReserve guards against clicks inside dialog content and handles backdrop click', () => {
  assert.match(html, /function closeReserve\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#reserveCloseBtn'\) && !e\.target\.closest\('#reserveCancelBtn'\) && !e\.target\.closest\('\.btn-cancel-r'\)/);
  assert.match(html, /reserveModalEl\.addEventListener\('click',\s*closeReserve\);/);
});

test('escape key listener closes open reserve modal and street card overlay', () => {
  assert.match(html, /window\.addEventListener\('keydown',\s*\(e\)\s*=>\s*\{[\s\S]*?e\.key === 'Escape'[\s\S]*?closeReserve\(\)[\s\S]*?closeStreetCard\(\)/);
});

test('service worker cache is bumped past the reserve modal a11y updates', () => {
  const v = Number((sw.match(/const CACHE = 'parkwiz-field-v(\d+)';/) || [])[1]);
  assert.ok(v >= 27, `a changed index.html needs a cache bump, got v${v}`);
});
