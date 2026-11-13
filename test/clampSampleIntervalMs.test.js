const test = require("node:test");
const assert = require("node:assert/strict");
const { clampSampleIntervalMs } = require("../src/lib/clampSampleIntervalMs");

test("returns requested intervals within default range unchanged (1000, 5000, 30000)", () => {
	assert.strictEqual(clampSampleIntervalMs(1000), 1000);
	assert.strictEqual(clampSampleIntervalMs(5000), 5000);
	assert.strictEqual(clampSampleIntervalMs(30000), 30000);
});

test("clamps values below default minimum to 500 (100 -> 500)", () => {
	assert.strictEqual(clampSampleIntervalMs(100), 500);
	assert.strictEqual(clampSampleIntervalMs(0), 500);
	assert.strictEqual(clampSampleIntervalMs(499), 500);
});

test("clamps values above default maximum to 60000 (90000 -> 60000)", () => {
	assert.strictEqual(clampSampleIntervalMs(90000), 60000);
	assert.strictEqual(clampSampleIntervalMs(60001), 60000);
});

test("rounds fractional requested intervals to the nearest integer (1234.6 -> 1235)", () => {
	assert.strictEqual(clampSampleIntervalMs(1234.6), 1235);
	assert.strictEqual(clampSampleIntervalMs(1234.4), 1234);
});

test("returns default 1000 for non-numeric and non-finite values (NaN, Infinity, '5000', null, undefined)", () => {
	assert.strictEqual(clampSampleIntervalMs(Number.NaN), 1000);
	assert.strictEqual(clampSampleIntervalMs(Number.POSITIVE_INFINITY), 1000);
	assert.strictEqual(clampSampleIntervalMs(Number.NEGATIVE_INFINITY), 1000);
	assert.strictEqual(clampSampleIntervalMs("5000"), 1000);
	assert.strictEqual(clampSampleIntervalMs(null), 1000);
	assert.strictEqual(clampSampleIntervalMs(undefined), 1000);
	assert.strictEqual(clampSampleIntervalMs(), 1000);
	assert.strictEqual(clampSampleIntervalMs({}), 1000);
	assert.strictEqual(clampSampleIntervalMs([]), 1000);
	assert.strictEqual(clampSampleIntervalMs(true), 1000);
});

test("returns default 1000 for negative requested intervals", () => {
	assert.strictEqual(clampSampleIntervalMs(-1), 1000);
	assert.strictEqual(clampSampleIntervalMs(-100), 1000);
	assert.strictEqual(clampSampleIntervalMs(-5000), 1000);
	assert.strictEqual(clampSampleIntervalMs(-0), 1000);
});

test("supports custom minMs and maxMs bounds", () => {
	assert.strictEqual(clampSampleIntervalMs(50, 200, 2000), 200);
	assert.strictEqual(clampSampleIntervalMs(1500, 200, 2000), 1500);
	assert.strictEqual(clampSampleIntervalMs(5000, 200, 2000), 2000);
});

test("always returns an integer", () => {
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs(1000)), true);
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs(1234.6)), true);
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs(100)), true);
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs(90000)), true);
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs(Number.NaN)), true);
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs(-1)), true);
	assert.strictEqual(Number.isInteger(clampSampleIntervalMs("5000")), true);
});
