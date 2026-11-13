'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('index has main landmark with id mainContent', () => {
  assert.match(html, /<main[^>]*id="mainContent"/);
  assert.match(html, /id="mainContent"[^>]*role="main"|role="main"[^>]*id="mainContent"/);
});

test('skip link to main content exists beside search skip link', () => {
  assert.match(html, /href="#searchInput"[^>]*>דלג לחיפוש</);
  assert.match(html, /href="#mainContent"[^>]*>דלג לתוכן הראשי</);
  assert.match(html, /class="skip-link"[^>]*href="#mainContent"|href="#mainContent"[^>]*class="skip-link"/);
});

test('existing searchInput skip link is preserved', () => {
  assert.match(html, /id="searchInput"/);
  assert.equal((html.match(/href="#searchInput"/g) || []).length >= 1, true);
});
