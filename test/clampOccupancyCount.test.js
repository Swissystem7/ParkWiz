const test = require("node:test");
const assert = require("node:assert/strict");
const { clampOccupancyCount } = require("../src/lib/clampOccupancyCount");

test("returns occupied count unchanged when within range (5 of 15)", () => {
	assert.strictEqual(clampOccupancyCount(5, 15), 5);
});

test("clamps negative occupied count to 0 (-2 of 15)", () => {
	assert.strictEqual(clampOccupancyCount(-2, 15), 0);
});

test("clamps occupied count above total spots to total (18 of 15)", () => {
	assert.strictEqual(clampOccupancyCount(18, 15), 15);
});

test("rounds fractional occupied counts (4.4 -> 4, 4.6 -> 5)", () => {
	assert.strictEqual(clampOccupancyCount(4.4, 15), 4);
	assert.strictEqual(clampOccupancyCount(4.6, 15), 5);
});

test("rounds total spots for the cap (total 14.6 caps at 15)", () => {
	assert.strictEqual(clampOccupancyCount(15, 14.6), 15);
	assert.strictEqual(clampOccupancyCount(14, 14.6), 14);
});

test("returns 0 for NaN or Infinity occupied count", () => {
	assert.strictEqual(clampOccupancyCount(Number.NaN, 15), 0);
	assert.strictEqual(clampOccupancyCount(Number.POSITIVE_INFINITY, 15), 0);
	assert.strictEqual(clampOccupancyCount(Number.NEGATIVE_INFINITY, 15), 0);
});

test("returns 0 for string occupied count without coercion ('5')", () => {
	assert.strictEqual(clampOccupancyCount("5", 15), 0);
});

test("returns 0 for invalid total spots (0, negative, NaN, string)", () => {
	assert.strictEqual(clampOccupancyCount(5, 0), 0);
	assert.strictEqual(clampOccupancyCount(5, -10), 0);
	assert.strictEqual(clampOccupancyCount(5, Number.NaN), 0);
	assert.strictEqual(clampOccupancyCount(5, "15"), 0);
});

test("always returns an integer", () => {
	assert.strictEqual(Number.isInteger(clampOccupancyCount(4.4, 15)), true);
	assert.strictEqual(Number.isInteger(clampOccupancyCount(4.6, 14.6)), true);
	assert.strictEqual(Number.isInteger(clampOccupancyCount(-2.7, 15)), true);
	assert.strictEqual(Number.isInteger(clampOccupancyCount(18.2, 15)), true);
});
