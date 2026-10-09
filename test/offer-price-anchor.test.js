const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('offer and MONETIZATION cite the cheapest direct competitor price with a source', () => {
  const offer = read('offer.html');
  const money = read('MONETIZATION.md');
  assert.match(offer, /Parkinto<\/a>[^<]*69 \$ למצלמה לחודש/);
  assert.match(offer, /parkinto\.com\/pricing/);
  assert.match(money, /\*\*Parkinto\*\*[^\n]*69 \$[^\n]*28\.9\.2026[^\n]*parkinto\.com\/pricing/);
});
