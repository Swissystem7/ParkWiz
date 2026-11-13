const test = require("node:test");
const assert = require("node:assert/strict");
const {
	categorizeOccupancyLevel,
} = require("../src/lib/categorizeOccupancyLevel");

test("categorizes low occupancy level for typical values", () => {
	assert.strictEqual(categorizeOccupancyLevel(20), "low");
});

test("categorizes medium occupancy level for typical values", () => {
	assert.strictEqual(categorizeOccupancyLevel(60), "medium");
});

test("categorizes high occupancy level for typical values", () => {
	assert.strictEqual(categorizeOccupancyLevel(85), "high");
});

test("categorizes full occupancy level for typical values", () => {
	assert.strictEqual(categorizeOccupancyLevel(99), "full");
});

test("handles low exact boundary values (0 and 49.99)", () => {
	assert.strictEqual(categorizeOccupancyLevel(0), "low");
	assert.strictEqual(categorizeOccupancyLevel(49.99), "low");
});

test("handles medium exact boundary values (50 and 79.99)", () => {
	assert.strictEqual(categorizeOccupancyLevel(50), "medium");
	assert.strictEqual(categorizeOccupancyLevel(79.99), "medium");
});

test("handles high exact boundary values (80 and 97.99)", () => {
	assert.strictEqual(categorizeOccupancyLevel(80), "high");
	assert.strictEqual(categorizeOccupancyLevel(97.99), "high");
});

test("handles full exact boundary values (98 and 100)", () => {
	assert.strictEqual(categorizeOccupancyLevel(98), "full");
	assert.strictEqual(categorizeOccupancyLevel(100), "full");
});

test("returns unknown for out-of-range numbers (-1, 100.01, 150)", () => {
	assert.strictEqual(categorizeOccupancyLevel(-1), "unknown");
	assert.strictEqual(categorizeOccupancyLevel(100.01), "unknown");
	assert.strictEqual(categorizeOccupancyLevel(150), "unknown");
});

test("returns unknown for non-finite values (NaN, Infinity)", () => {
	assert.strictEqual(categorizeOccupancyLevel(Number.NaN), "unknown");
	assert.strictEqual(
		categorizeOccupancyLevel(Number.POSITIVE_INFINITY),
		"unknown",
	);
	assert.strictEqual(
		categorizeOccupancyLevel(Number.NEGATIVE_INFINITY),
		"unknown",
	);
});

test("returns unknown for invalid non-number types (null, undefined, '50')", () => {
	assert.strictEqual(categorizeOccupancyLevel(null), "unknown");
	assert.strictEqual(categorizeOccupancyLevel(undefined), "unknown");
	assert.strictEqual(categorizeOccupancyLevel("50"), "unknown");
});
