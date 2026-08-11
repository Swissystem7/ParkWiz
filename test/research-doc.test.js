const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const research = fs.readFileSync(path.join(__dirname, '..', 'RESEARCH.md'), 'utf8');

for (const heading of [
  '# ParkWiz — Market Research',
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
  assert.match(research, /two overlapping product stories|transitioning from a consumer parking demo toward a municipal CCTV occupancy pilot/);
});

test('RESEARCH.md includes sourced market data and explicit gaps', () => {
  assert.match(research, /https:\/\//);
  assert.match(research, /לא נמצא נתון מאומת/);
});
