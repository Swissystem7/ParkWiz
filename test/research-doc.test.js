const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const research = fs.readFileSync(path.join(__dirname, '..', 'RESEARCH.md'), 'utf8');

for (const heading of [
  '# ParkWiz — מחקר שוק שלב 1 + פסק דין שלב 0',
  '## 0. מה המוצר בפועל (לא מה שהפיץ\' מבטיח)',
  '## 1) מתחרים',
  '## 2) הקונה',
  '## 5) פסק דין',
]) {
  test(`RESEARCH.md includes ${heading}`, () => {
    assert.match(research, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('RESEARCH.md records a PIVOT verdict toward a Netanya camera pilot', () => {
  assert.match(research, /# PIVOT/);
  assert.match(research, /עיריית נתניה/);
  assert.match(research, /30 יום/);
});

test('RESEARCH.md includes sourced findings and explicit gaps', () => {
  assert.match(research, /https:\/\//);
  assert.match(research, /לא נמצא מקור/);
  assert.match(research, /pumbaparking\.com/);
  assert.match(research, /pinkpark\.co\.il/);
});
