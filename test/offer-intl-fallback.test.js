'use strict';
const assert = require('node:assert');
const { toIntlPhone } = require('../src/lib/offer');

// Test the toIntlPhone function with the contract example and another case
assert.strictEqual(toIntlPhone('526333106'), '972526333106');

// Additional test case with different phone number to ensure it's not hardcoded
assert.strictEqual(toIntlPhone('501234567'), '972501234567');
