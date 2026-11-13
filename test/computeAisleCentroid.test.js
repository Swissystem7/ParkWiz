const test = require("node:test");
const assert = require("node:assert/strict");
const { computeAisleCentroid } = require("../src/lib/computeAisleCentroid.js");

test("line layout", () => {
	assert.deepEqual(
		computeAisleCentroid([
			{ x: 0, y: 0 },
			{ x: 2, y: 0 },
			{ x: 4, y: 0 },
		]),
		{ x: 2, y: 0, stallCount: 3 },
	);
});

test("2d layout", () => {
	assert.deepEqual(
		computeAisleCentroid([
			{ x: 0, y: 0 },
			{ x: 2, y: 2 },
		]),
		{ x: 1, y: 1, stallCount: 2 },
	);
});

test("skips invalid coords", () => {
	const r = computeAisleCentroid([
		{ x: 0, y: 0 },
		{ x: NaN, y: 1 },
		{ foo: 1 },
		{ x: 2, y: 0 },
	]);
	assert.equal(r.stallCount, 2);
	assert.equal(r.x, 1);
});

test("empty/non-array", () => {
	assert.equal(computeAisleCentroid([]), null);
	assert.equal(computeAisleCentroid(null), null);
	assert.equal(computeAisleCentroid(undefined), null);
});

test("no valid", () => assert.equal(computeAisleCentroid([{ a: 1 }, null, "x"]), null));

test("rounding", () => {
	const r = computeAisleCentroid([
		{ x: 0.333, y: 0.666 },
		{ x: 0.334, y: 0.667 },
	]);
	assert.equal(r.x, 0.33);
	assert.equal(r.y, 0.67);
});

test("coords array via parseSpotCoordinates", () => {
	assert.deepEqual(
		computeAisleCentroid([{ coords: [0, 0] }, { coords: [2, 4] }]),
		{ x: 1, y: 2, stallCount: 2 },
	);
});

test("string numeric x/y", () => {
	assert.deepEqual(
		computeAisleCentroid([
			{ x: "1", y: "1" },
			{ x: "3", y: "5" },
		]),
		{ x: 2, y: 3, stallCount: 2 },
	);
});

test("null x/y falls through to coords", () => {
	assert.deepEqual(
		computeAisleCentroid([{ x: null, y: null, coords: [10, 20] }]),
		{ x: 10, y: 20, stallCount: 1 },
	);
});

test("array stall skipped", () => {
	assert.deepEqual(
		computeAisleCentroid([[1, 2], { x: 2, y: 4 }]),
		{ x: 2, y: 4, stallCount: 1 },
	);
});
