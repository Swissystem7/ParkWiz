const test = require("node:test");
const assert = require("node:assert/strict");
const {
	isValidPathLossExponent,
} = require("../src/lib/isValidPathLossExponent");
test("valid parking exponents", () => {
	assert.equal(isValidPathLossExponent(2.0), true);
	assert.equal(isValidPathLossExponent(3.4), true);
	assert.equal(isValidPathLossExponent(4.5), true);
	assert.equal(isValidPathLossExponent(5.0), true);
});
test("out of range", () => {
	assert.equal(isValidPathLossExponent(1.8), false);
	assert.equal(isValidPathLossExponent(5.5), false);
});
test("invalid types", () => {
	assert.equal(isValidPathLossExponent(NaN), false);
	assert.equal(isValidPathLossExponent("3.4"), false);
	assert.equal(isValidPathLossExponent(null), false);
	assert.equal(isValidPathLossExponent(-1), false);
});
