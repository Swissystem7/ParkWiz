const test = require('node:test');
const assert = require('node:assert/strict');
const offer = require('../src/lib/offer.js');

test('quote rejects a fractional camera count instead of rounding it', () => {
  const q = offer.validateQuote({ packageId: 'measure-after', amountIls: 1000, cameras: '1.5' });
  assert.equal(q.ok, false);
  assert.ok(q.errors.some((e) => /מצלמות/.test(e)));
  assert.equal(offer.validateQuote({ packageId: 'measure-after', amountIls: 1000, cameras: '3' }).ok, true);
});
