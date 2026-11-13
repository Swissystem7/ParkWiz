const test = require("node:test");
const assert = require("node:assert/strict");
const {
	computeAverageSearchTime,
} = require("../src/lib/computeAverageSearchTime");

test("computes average and formatted minutes for typical valid durations", () => {
	const result = computeAverageSearchTime([120, 180, 240]);
	assert.deepStrictEqual(result, {
		averageSeconds: 180,
		formattedMinutes: "3.0 דקות",
		sampleCount: 3,
	});
});

test("handles rounding correctly for non-integer averages", () => {
	const result = computeAverageSearchTime([100, 101]);
	assert.deepStrictEqual(result, {
		averageSeconds: 101,
		formattedMinutes: "1.7 דקות",
		sampleCount: 2,
	});
});

test("filters out negative numbers, zero, strings, NaN, and Infinity", () => {
	const input = [
		-50,
		0,
		"180",
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		null,
		undefined,
		{},
		120,
	];
	const result = computeAverageSearchTime(input);
	assert.deepStrictEqual(result, {
		averageSeconds: 120,
		formattedMinutes: "2.0 דקות",
		sampleCount: 1,
	});
});

test("returns zero result when all array items are invalid", () => {
	const result = computeAverageSearchTime([
		-10,
		0,
		"300",
		Number.NaN,
		Number.POSITIVE_INFINITY,
	]);
	assert.deepStrictEqual(result, {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
});

test("returns zero result for empty array", () => {
	const result = computeAverageSearchTime([]);
	assert.deepStrictEqual(result, {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
});

test("returns zero result when input is null or undefined", () => {
	assert.deepStrictEqual(computeAverageSearchTime(null), {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
	assert.deepStrictEqual(computeAverageSearchTime(undefined), {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
});

test("returns zero result for non-array inputs like numbers, strings, and objects", () => {
	assert.deepStrictEqual(computeAverageSearchTime(120), {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
	assert.deepStrictEqual(computeAverageSearchTime("120"), {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
	assert.deepStrictEqual(computeAverageSearchTime({ 0: 120, length: 1 }), {
		averageSeconds: 0,
		formattedMinutes: "0.0 דקות",
		sampleCount: 0,
	});
});

test("computes correct values for a single valid value", () => {
	const result = computeAverageSearchTime([90]);
	assert.deepStrictEqual(result, {
		averageSeconds: 90,
		formattedMinutes: "1.5 דקות",
		sampleCount: 1,
	});
});

test("does not mutate the input array", () => {
	const input = Object.freeze([120, 180, 240]);
	const copy = [...input];
	const result = computeAverageSearchTime(input);
	assert.deepStrictEqual(input, copy);
	assert.strictEqual(result.sampleCount, 3);
});
