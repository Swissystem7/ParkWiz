const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidParkingLevel } = require("../src/lib/isValidParkingLevel");

test("returns true for valid underground levels within default range", () => {
	assert.strictEqual(isValidParkingLevel(-1), true);
	assert.strictEqual(isValidParkingLevel(-5), true);
});

test("returns true for valid ground and above-ground levels within default range", () => {
	assert.strictEqual(isValidParkingLevel(0), true);
	assert.strictEqual(isValidParkingLevel(2), true);
	assert.strictEqual(isValidParkingLevel(5), true);
});

test("returns false for levels outside default range", () => {
	assert.strictEqual(isValidParkingLevel(-6), false);
	assert.strictEqual(isValidParkingLevel(6), false);
	assert.strictEqual(isValidParkingLevel(100), false);
	assert.strictEqual(isValidParkingLevel(-100), false);
});

test("returns false for non-integer numbers", () => {
	assert.strictEqual(isValidParkingLevel(-1.5), false);
	assert.strictEqual(isValidParkingLevel(0.5), false);
	assert.strictEqual(isValidParkingLevel(2.2), false);
});

test("returns false for NaN and infinities", () => {
	assert.strictEqual(isValidParkingLevel(Number.NaN), false);
	assert.strictEqual(isValidParkingLevel(Number.POSITIVE_INFINITY), false);
	assert.strictEqual(isValidParkingLevel(Number.NEGATIVE_INFINITY), false);
});

test("returns false for string and non-number primitive types", () => {
	assert.strictEqual(isValidParkingLevel("1"), false);
	assert.strictEqual(isValidParkingLevel("-1"), false);
	assert.strictEqual(isValidParkingLevel(""), false);
	assert.strictEqual(isValidParkingLevel(null), false);
	assert.strictEqual(isValidParkingLevel(undefined), false);
	assert.strictEqual(isValidParkingLevel(true), false);
	assert.strictEqual(isValidParkingLevel(false), false);
});

test("returns false for complex objects and arrays", () => {
	assert.strictEqual(isValidParkingLevel({}), false);
	assert.strictEqual(isValidParkingLevel([]), false);
	assert.strictEqual(isValidParkingLevel([1]), false);
	assert.strictEqual(isValidParkingLevel({ level: 1 }), false);
});

test("supports valid custom level ranges", () => {
	assert.strictEqual(isValidParkingLevel(-2, -3, 0), true);
	assert.strictEqual(isValidParkingLevel(-3, -3, 0), true);
	assert.strictEqual(isValidParkingLevel(0, -3, 0), true);
	assert.strictEqual(isValidParkingLevel(1, -3, 0), false);
	assert.strictEqual(isValidParkingLevel(-4, -3, 0), false);
	assert.strictEqual(isValidParkingLevel(10, 1, 20), true);
	assert.strictEqual(isValidParkingLevel(0, 1, 20), false);
});

test("returns false when custom range has minLevel greater than maxLevel", () => {
	assert.strictEqual(isValidParkingLevel(0, 5, -5), false);
	assert.strictEqual(isValidParkingLevel(2, 3, 1), false);
});

test("returns false when custom minLevel or maxLevel is not an integer", () => {
	assert.strictEqual(isValidParkingLevel(2, " -5 ", 5), false);
	assert.strictEqual(isValidParkingLevel(2, -5, "5"), false);
	assert.strictEqual(isValidParkingLevel(2, -5.5, 5), false);
	assert.strictEqual(isValidParkingLevel(2, -5, 5.5), false);
	assert.strictEqual(isValidParkingLevel(2, null, 5), false);
	assert.strictEqual(isValidParkingLevel(2, -5, null), false);
	assert.strictEqual(isValidParkingLevel(2, Number.NaN, 5), false);
	assert.strictEqual(
		isValidParkingLevel(2, -5, Number.POSITIVE_INFINITY),
		false,
	);
});

test("never throws when called with unusual arguments or no arguments", () => {
	assert.doesNotThrow(() => {
		isValidParkingLevel();
		isValidParkingLevel(Symbol("level"));
		isValidParkingLevel(10n);
		isValidParkingLevel(0, Symbol("min"), 5);
		isValidParkingLevel(0, -5, Symbol("max"));
	});
	assert.strictEqual(isValidParkingLevel(), false);
});
