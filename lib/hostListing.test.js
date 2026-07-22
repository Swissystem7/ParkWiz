'use strict';
const assert = require('node:assert');
const { validateListing } = require('./hostListing');
assert.deepStrictEqual(validateListing({ spotType: 'garage', ownershipAttested: true, address: 'Dizengoff 1', priceIls: 30 }), { ok: true, errors: [] });
for (const spotType of ['public_curb', 'street']) {
  const result = validateListing({ spotType, ownershipAttested: true, address: 'x', priceIls: 10 });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /cannot be listed/);
}
assert.strictEqual(validateListing({ spotType: 'private_lot', address: 'x', priceIls: 10 }).ok, false);
assert.strictEqual(validateListing(null).ok, false);
console.log('hostListing: all assertions passed');
