const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

test('pricing modal clearly marks Premium as a demo', () => {
  assert.match(html, /⚠️ זוהי גרסת הדגמה בלבד — לא מתבצעת גבייה אמיתית/);
  assert.match(html, />הפעל פרמיום \(הדגמה\)</);
});

test('premium lock modal button is labeled as a demo without changing its action', () => {
  assert.match(
    html,
    /<button class="btn btn-primary" style="flex:1" onclick="closeLockModal\(\);showParkPricing\(\)">הפעל Premium להדגמה ⚡<\/button>/
  );
});

test('premium activation toast says no billing occurred', () => {
  assert.match(html, /פרמיום הופעל! \(לא בוצע חיוב — זוהי הדגמה\)/);
});

test('onboarding premium copy says the price is not billed', () => {
  assert.match(html, /₪14\.90 לחודש \(ללא חיוב\)/);
});

test('README documents Premium as demo-only', () => {
  assert.match(readme, /> ⚠️ \*\*הערה:\*\* תכונת Premium היא הדגמאתית בלבד — לא מתבצעת גביה אמיתית\./);
});
