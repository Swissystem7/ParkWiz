const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSpotCoordinates } = require("../src/lib/parseSpotCoordinates");

test("parses coordinates from top-level x and y properties", () => {
	assert.deepStrictEqual(parseSpotCoordinates({ x: 10, y: 20 }), {
		x: 10,
		y: 20,
	});
	assert.deepStrictEqual(parseSpotCoordinates({ x: 0, y: 0 }), { x: 0, y: 0 });
	assert.deepStrictEqual(parseSpotCoordinates({ x: -12.5, y: 44.1 }), {
		x: -12.5,
		y: 44.1,
	});
});

test("parses coordinates from coords array with length >= 2", () => {
	assert.deepStrictEqual(parseSpotCoordinates({ coords: [15.5, 30.2] }), {
		x: 15.5,
		y: 30.2,
	});
	assert.deepStrictEqual(parseSpotCoordinates({ coords: [1, 2, 3] }), {
		x: 1,
		y: 2,
	});
});

test("parses coordinates from nested location object", () => {
	assert.deepStrictEqual(parseSpotCoordinates({ location: { x: 5, y: -8 } }), {
		x: 5,
		y: -8,
	});
});

test("parses numeric strings into numbers", () => {
	assert.deepStrictEqual(parseSpotCoordinates({ x: "3", y: "4" }), {
		x: 3,
		y: 4,
	});
	assert.deepStrictEqual(parseSpotCoordinates({ coords: ["15.5", "30.2"] }), {
		x: 15.5,
		y: 30.2,
	});
	assert.deepStrictEqual(
		parseSpotCoordinates({ location: { x: "5", y: "-8" } }),
		{ x: 5, y: -8 },
	);
});

test("returns null for invalid inputs (NaN, missing y, null, [], empty coords, {})", () => {
	assert.strictEqual(parseSpotCoordinates(null), null);
	assert.strictEqual(parseSpotCoordinates(undefined), null);
	assert.strictEqual(parseSpotCoordinates("invalid"), null);
	assert.strictEqual(parseSpotCoordinates(42), null);
	assert.strictEqual(parseSpotCoordinates([]), null);
	assert.strictEqual(parseSpotCoordinates({}), null);
	assert.strictEqual(parseSpotCoordinates({ x: 10 }), null);
	assert.strictEqual(parseSpotCoordinates({ y: 20 }), null);
	assert.strictEqual(parseSpotCoordinates({ x: Number.NaN, y: 20 }), null);
	assert.strictEqual(parseSpotCoordinates({ x: 10, y: Number.NaN }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [] }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [10] }), null);
	assert.strictEqual(parseSpotCoordinates({ location: {} }), null);
	assert.strictEqual(parseSpotCoordinates({ location: { x: 5 } }), null);
	assert.strictEqual(parseSpotCoordinates({ location: { y: -8 } }), null);
	assert.strictEqual(parseSpotCoordinates({ location: null }), null);
});

test("returns null for empty strings and whitespace strings", () => {
	assert.strictEqual(parseSpotCoordinates({ x: "", y: 20 }), null);
	assert.strictEqual(parseSpotCoordinates({ x: 10, y: "" }), null);
	assert.strictEqual(parseSpotCoordinates({ x: "   ", y: 20 }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: ["", 20] }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [10, "   "] }), null);
	assert.strictEqual(
		parseSpotCoordinates({ location: { x: "", y: 20 } }),
		null,
	);
});

test("returns null for booleans, null coordinate values, and infinities", () => {
	assert.strictEqual(parseSpotCoordinates({ x: true, y: 20 }), null);
	assert.strictEqual(parseSpotCoordinates({ x: 10, y: false }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [true, 20] }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [10, false] }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [null, 20] }), null);
	assert.strictEqual(parseSpotCoordinates({ coords: [10, null] }), null);
	assert.strictEqual(
		parseSpotCoordinates({ x: Number.POSITIVE_INFINITY, y: 20 }),
		null,
	);
	assert.strictEqual(
		parseSpotCoordinates({ x: 10, y: Number.NEGATIVE_INFINITY }),
		null,
	);
	assert.strictEqual(parseSpotCoordinates({ x: "foo", y: 20 }), null);
});

test("prioritizes top-level x/y over coords and location", () => {
	assert.deepStrictEqual(
		parseSpotCoordinates({
			x: 10,
			y: 20,
			coords: [99, 88],
			location: { x: 77, y: 66 },
		}),
		{ x: 10, y: 20 },
	);
});

test("prioritizes coords over location when top-level x/y are missing", () => {
	assert.deepStrictEqual(
		parseSpotCoordinates({
			coords: [15.5, 30.2],
			location: { x: 77, y: 66 },
		}),
		{ x: 15.5, y: 30.2 },
	);
});

test("does not mutate input records", () => {
	const frozenWithXY = Object.freeze({ x: 10, y: 20 });
	assert.deepStrictEqual(parseSpotCoordinates(frozenWithXY), { x: 10, y: 20 });

	const frozenWithCoords = Object.freeze({
		coords: Object.freeze([15.5, 30.2]),
	});
	assert.deepStrictEqual(parseSpotCoordinates(frozenWithCoords), {
		x: 15.5,
		y: 30.2,
	});

	const frozenWithLocation = Object.freeze({
		location: Object.freeze({ x: 5, y: -8 }),
	});
	assert.deepStrictEqual(parseSpotCoordinates(frozenWithLocation), {
		x: 5,
		y: -8,
	});
});
