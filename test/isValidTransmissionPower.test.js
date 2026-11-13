const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidTransmissionPower } = require("../src/lib/isValidTransmissionPower.js");

test("valid mid-range and boundaries", () => {
	assert.equal(isValidTransmissionPower(-59), true);
	assert.equal(isValidTransmissionPower(-65), true);
	assert.equal(isValidTransmissionPower(-50), true);
	assert.equal(isValidTransmissionPower(-100), true);
	assert.equal(isValidTransmissionPower(-40), true);
});
test("out of range", () => {
	assert.equal(isValidTransmissionPower(-105), false);
	assert.equal(isValidTransmissionPower(-30), false);
	assert.equal(isValidTransmissionPower(0), false);
	assert.equal(isValidTransmissionPower(10), false);
});
test("non-numbers", () => {
	assert.equal(isValidTransmissionPower(NaN), false);
	assert.equal(isValidTransmissionPower("-59"), false);
	assert.equal(isValidTransmissionPower(null), false);
	assert.equal(isValidTransmissionPower(undefined), false);
});
