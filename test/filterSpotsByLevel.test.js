const test = require("node:test");
const assert = require("node:assert/strict");
const { filterSpotsByLevel } = require("../src/lib/filterSpotsByLevel.js");

test("filter by -1, -2 and 0", () => {
	const spotNeg2 = { id: "A-01", level: -2 };
	const spotNeg1 = { id: "A-02", level: -1 };
	const spot0 = { id: "A-03", level: 0 };
	const spot1 = { id: "A-04", level: 1 };
	const spots = [spotNeg2, spotNeg1, spot0, spot1];

	assert.deepStrictEqual(filterSpotsByLevel(spots, -1), [spotNeg1]);
	assert.deepStrictEqual(filterSpotsByLevel(spots, -2), [spotNeg2]);
	assert.deepStrictEqual(filterSpotsByLevel(spots, 0), [spot0]);
});

test("missing level defaults to -1 (included for -1, excluded for 0)", () => {
	const spotMissing = { id: "A-01" };
	const spotGround = { id: "A-02", level: 0 };
	const spots = [spotMissing, spotGround];

	assert.deepStrictEqual(filterSpotsByLevel(spots, -1), [spotMissing]);
	assert.deepStrictEqual(filterSpotsByLevel(spots, 0), [spotGround]);
});

test("invalid level fields default to -1", () => {
	const spotString = { id: "A-01", level: "0" };
	const spotFloat = { id: "A-02", level: 1.5 };
	const spotNaN = { id: "A-03", level: Number.NaN };
	const spotNull = { id: "A-04", level: null };
	const spotUndefined = { id: "A-05", level: undefined };
	const spotBool = { id: "A-06", level: true };
	const spotObj = { id: "A-07", level: {} };
	const spotValidGround = { id: "A-08", level: 0 };
	const spots = [
		spotString,
		spotFloat,
		spotNaN,
		spotNull,
		spotUndefined,
		spotBool,
		spotObj,
		spotValidGround,
	];

	const defaultNeg1Spots = [
		spotString,
		spotFloat,
		spotNaN,
		spotNull,
		spotUndefined,
		spotBool,
		spotObj,
	];

	assert.deepStrictEqual(filterSpotsByLevel(spots, -1), defaultNeg1Spots);
	assert.deepStrictEqual(filterSpotsByLevel(spots, 0), [spotValidGround]);
	assert.deepStrictEqual(filterSpotsByLevel(spots, 1), []);
});

test("empty array returns an empty array", () => {
	assert.deepStrictEqual(filterSpotsByLevel([], -1), []);
	assert.deepStrictEqual(filterSpotsByLevel([], 0), []);
	assert.deepStrictEqual(filterSpotsByLevel([], 2), []);
});

test("non-array inputs (null, undefined, object, string)", () => {
	assert.deepStrictEqual(filterSpotsByLevel(null, -1), []);
	assert.deepStrictEqual(filterSpotsByLevel(undefined, -1), []);
	assert.deepStrictEqual(filterSpotsByLevel({}, -1), []);
	assert.deepStrictEqual(filterSpotsByLevel("string", -1), []);
	assert.deepStrictEqual(filterSpotsByLevel(123, -1), []);
	assert.deepStrictEqual(filterSpotsByLevel(true, -1), []);
});

test("invalid targetLevel (NaN, '1', 1.5, -10, 6) -> []", () => {
	const spots = [
		{ id: "A-01", level: 1 },
		{ id: "A-02", level: -1 },
	];

	assert.deepStrictEqual(filterSpotsByLevel(spots, Number.NaN), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, "1"), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, 1.5), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, -10), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, 6), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, null), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, undefined), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, {}), []);
	assert.deepStrictEqual(filterSpotsByLevel(spots, []), []);
	assert.deepStrictEqual(
		filterSpotsByLevel(spots, Number.POSITIVE_INFINITY),
		[],
	);
});

test("input not mutated and result is a new array", () => {
	const spot = { id: "A-01", level: 0 };
	const spots = [spot, { id: "A-02", level: 1 }];
	const originalSpots = spots.slice();
	const originalSpot = { ...spot };

	const result = filterSpotsByLevel(spots, 0);

	assert.notStrictEqual(result, spots);
	assert.deepStrictEqual(spots, originalSpots);
	assert.deepStrictEqual(spot, originalSpot);
	assert.strictEqual(result[0], spot);

	const emptyInput = [];
	const emptyResult = filterSpotsByLevel(emptyInput, 0);
	assert.notStrictEqual(emptyResult, emptyInput);
	assert.deepStrictEqual(emptyResult, []);
});

test("null/primitive items skipped", () => {
	const spotValid = { id: "A-01", level: 0 };
	const spotDefault = { id: "A-02" };
	const spots = [
		null,
		undefined,
		"primitive string",
		42,
		true,
		false,
		Symbol("spot"),
		[1, 2, 3],
		spotValid,
		spotDefault,
	];

	assert.deepStrictEqual(filterSpotsByLevel(spots, 0), [spotValid]);
	assert.deepStrictEqual(filterSpotsByLevel(spots, -1), [spotDefault]);
});
