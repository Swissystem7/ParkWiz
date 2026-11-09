const test = require("node:test");
const assert = require("node:assert/strict");
const {
	isOperatingTemperatureSafe,
} = require("../src/lib/isOperatingTemperatureSafe");

test("returns true for typical operating temperatures (25 C and 41.5 C)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(25), true);
	assert.strictEqual(isOperatingTemperatureSafe(41.5), true);
});

test("returns true for elevated safe operating temperature (50 C)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(50), true);
});

test("returns true for default maximum operating temperature boundary (55 C)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(55), true);
});

test("returns true for minimum safe operating temperature boundary (-10 C)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(-10), true);
});

test("returns false for temperatures above default maximum threshold (56 C and 70 C)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(56), false);
	assert.strictEqual(isOperatingTemperatureSafe(70), false);
});

test("returns false for temperatures below minimum safe threshold (-15 C)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(-15), false);
});

test("returns false for non-number and non-finite currentTempC values (NaN, '25', null, undefined)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(Number.NaN), false);
	assert.strictEqual(isOperatingTemperatureSafe("25"), false);
	assert.strictEqual(isOperatingTemperatureSafe(null), false);
	assert.strictEqual(isOperatingTemperatureSafe(undefined), false);
	assert.strictEqual(
		isOperatingTemperatureSafe(Number.POSITIVE_INFINITY),
		false,
	);
	assert.strictEqual(
		isOperatingTemperatureSafe(Number.NEGATIVE_INFINITY),
		false,
	);
});

test("accepts valid custom maxTempC thresholds (60 with max 65 is true, 45 with max 40 is false)", () => {
	assert.strictEqual(isOperatingTemperatureSafe(60, 65), true);
	assert.strictEqual(isOperatingTemperatureSafe(45, 40), false);
});

test("falls back to default 55 C max threshold when maxTempC is not finite", () => {
	assert.strictEqual(isOperatingTemperatureSafe(55, Number.NaN), true);
	assert.strictEqual(isOperatingTemperatureSafe(56, Number.NaN), false);
	assert.strictEqual(isOperatingTemperatureSafe(55, "65"), true);
	assert.strictEqual(isOperatingTemperatureSafe(56, null), false);
	assert.strictEqual(isOperatingTemperatureSafe(55, undefined), true);
});
