'use strict';

// axe rule "select-name": every <select> needs an accessible name.
// Covers the static markup and the selects that index.html builds in template strings.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const selectTags = html.match(/<select\b[^>]*>/gi) || [];

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function hasAccessibleName(tag) {
  const ariaLabel = attr(tag, 'aria-label');
  if (ariaLabel && ariaLabel.trim()) return true;
  const labelledBy = attr(tag, 'aria-labelledby');
  if (labelledBy && html.includes(`id="${labelledBy}"`)) return true;
  const id = attr(tag, 'id');
  return Boolean(id && new RegExp(`<label\\b[^>]*\\sfor="${id}"`, 'i').test(html));
}

test('index.html still has the selects this test is meant to guard', () => {
  assert.ok(selectTags.length >= 4, `expected at least 4 <select> tags, found ${selectTags.length}`);
});

test('every <select> in index.html has an accessible name', () => {
  const unnamed = selectTags.filter((tag) => !hasAccessibleName(tag));
  assert.deepEqual(unnamed, [], `selects without an accessible name: ${unnamed.join(' | ')}`);
});

test('vacation planner selects are named in Hebrew', () => {
  assert.match(html, /<select id="vacDest"[^>]*aria-label="יעד החופשה"/);
  assert.match(html, /<select id="vacHour"[^>]*aria-label="שעת ההגעה ליעד"/);
});

test('vehicle selector is named in Hebrew', () => {
  assert.match(html, /<select id="vehicleSel"[^>]*aria-label="סוג הרכב שלי"/);
});

test('select accessible names are distinct, so screen readers can tell them apart', () => {
  const names = selectTags.map((tag) => attr(tag, 'aria-label')).filter(Boolean);
  assert.equal(new Set(names).size, names.length);
});
