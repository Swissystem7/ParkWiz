'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'live-assign.html'), 'utf8');

test('live-assign has main landmark with id mainContent', () => {
  assert.match(html, /<main[^>]*id="mainContent"/);
  assert.match(html, /id="mainContent"[^>]*role="main"|role="main"[^>]*id="mainContent"/);
});

test('live-assign has skip link to main content', () => {
  assert.match(html, /href="#mainContent"[^>]*>דלג לתוכן הראשי</);
  assert.match(html, /class="skip-link"/);
});

test('existing main-grid layout class is preserved on main', () => {
  assert.match(html, /<main[^>]*class="[^"]*main-grid/);
});
