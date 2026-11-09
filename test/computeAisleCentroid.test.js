const test = require("node:test");
const assert = require("node:assert/strict");
const { computeAisleCentroid } = require("../src/lib/computeAisleCentroid.js");

test("line layout", () => {
	const r = computeAisleCentroid([
		{ x: 0, y: 0 },
		{ x: 2, y: 0 },
		{ x: 4, y: 0 },
	]);
	assert.deepEqual(r, { x: 2, y: 0, stallCount: 3 });
});
test("2d layout", () => {
	const r = computeAisleCentroid([
		{ x: 0, y: 0 },
		{ x: 2, y: 2 },
	]);
	assert.deepEqual(r, { x: 1, y: 1, stallCount: 2 });
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
});
test("no valid", () => assert.equal(computeAisleCentroid([{ a: 1 }]), null));
test("rounding", () => {
	const r = computeAisleCentroid([
		{ x: 0.333, y: 0.666 },
		{ x: 0.334, y: 0.667 },
	]);
	assert.equal(r.x, 0.33);
	assert.equal(r.y, 0.67);
});
