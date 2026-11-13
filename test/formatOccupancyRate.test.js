const test = require("node:test");
const assert = require("node:assert/strict");
const { formatOccupancyRate } = require("../src/lib/formatOccupancyRate");

test("formats a fractional occupancy rate to one decimal place", () => {
	assert.strictEqual(formatOccupancyRate(5, 15), "33.3%");
});

test("formats full occupancy", () => {
	assert.strictEqual(formatOccupancyRate(10, 10), "100.0%");
});

test("returns zero for non-positive totals", () => {
	assert.strictEqual(formatOccupancyRate(5, 0), "0.0%");
	assert.strictEqual(formatOccupancyRate(5, -1), "0.0%");
});

test("clamps negative occupied values to zero", () => {
	assert.strictEqual(formatOccupancyRate(-1, 10), "0.0%");
});

test("clamps occupied values above total to one hundred percent", () => {
	assert.strictEqual(formatOccupancyRate(15, 10), "100.0%");
});

test("returns zero for non-finite or non-number inputs", () => {
	assert.strictEqual(formatOccupancyRate(NaN, 10), "0.0%");
	assert.strictEqual(formatOccupancyRate(5, NaN), "0.0%");
	assert.strictEqual(formatOccupancyRate(null, 10), "0.0%");
	assert.strictEqual(formatOccupancyRate(5, undefined), "0.0%");
	assert.strictEqual(formatOccupancyRate("5", 10), "0.0%");
	assert.strictEqual(formatOccupancyRate(5, "10"), "0.0%");
	assert.strictEqual(formatOccupancyRate(Infinity, 10), "0.0%");
	assert.strictEqual(formatOccupancyRate(5, Infinity), "0.0%");
});

test("formats zero occupancy", () => {
	assert.strictEqual(formatOccupancyRate(0, 10), "0.0%");
});
