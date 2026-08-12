const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const research = fs.readFileSync(path.join(__dirname, '..', 'RESEARCH.md'), 'utf8');

for (const heading of [
  '# ParkWiz — Market Research',
  '## חסם הצפיפות (cold start) — נבדק 12/08/2026',
  '## המוצר',
  '## גודל שוק',
  '## מתחרים',
  '## בידול',
  '## מה עוד לא מאומת',
]) {
  test(`RESEARCH.md includes ${heading}`, () => {
    assert.match(research, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('RESEARCH.md explicitly acknowledges the README/index mismatch', () => {
  assert.match(research, /README\.md/);
  assert.match(research, /index\.html/);
  assert.match(research, /consumer parking demo/);
  assert.match(research, /municipal CCTV occupancy pilot/);
});

test('RESEARCH.md includes sourced market data and explicit gaps', () => {
  assert.match(research, /https:\/\//);
  assert.match(research, /לא נמצא נתון מאומת/);
});

test('RESEARCH.md records the cold-start research as a partial answer, not a solved density threshold', () => {
  assert.match(research, /Parknav לא מסתמך על דיווחי משתמשים בכלל/);
  assert.match(research, /"חיזוי, לא הבטחה"/);
  assert.match(research, /תשובה חלקית/);
  assert.match(research, /סף הצפיפות המספרי/);
  assert.match(research, /https:\/\/parknav\.com\/about-us/);
});
