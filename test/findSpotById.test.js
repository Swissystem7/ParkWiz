const test = require("node:test");
const assert = require("node:assert/strict");
const { findSpotById } = require("../src/lib/findSpotById");

test("'A-01' found", () => {
	const spot = { id: "A-01", status: "free" };
	const spots = [spot, { id: "B-02", status: "occupied" }];

	const result = findSpotById(spots, "A-01");
	assert.strictEqual(result, spot);
});

test("' a-01 ' found (same object reference)", () => {
	const spot = { id: "A-01", status: "free" };
	const spots = [{ id: "B-01", status: "occupied" }, spot];

	const result = findSpotById(spots, " a-01 ");
	assert.strictEqual(result, spot);
});

test("not found -> null", () => {
	const spots = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
	];

	assert.strictEqual(findSpotById(spots, "A-99"), null);
});

test("[] -> null", () => {
	assert.strictEqual(findSpotById([], "A-01"), null);
});

test("non-array (null, {}, 'A-01') -> null", () => {
	assert.strictEqual(findSpotById(null, "A-01"), null);
	assert.strictEqual(findSpotById(undefined, "A-01"), null);
	assert.strictEqual(findSpotById({}, "A-01"), null);
	assert.strictEqual(findSpotById("A-01", "A-01"), null);
	assert.strictEqual(findSpotById(123, "A-01"), null);
});

test("empty / whitespace / non-string targetId -> null", () => {
	const spots = [{ id: "A-01", status: "free" }];

	assert.strictEqual(findSpotById(spots, ""), null);
	assert.strictEqual(findSpotById(spots, "   "), null);
	assert.strictEqual(findSpotById(spots, null), null);
	assert.strictEqual(findSpotById(spots, undefined), null);
	assert.strictEqual(findSpotById(spots, 123), null);
	assert.strictEqual(findSpotById(spots, {}), null);
});

test("null items skipped", () => {
	const targetSpot = { id: "A-01", status: "free" };
	const spots = [
		null,
		undefined,
		"invalid",
		42,
		[],
		{},
		{ id: null },
		{ id: 123 },
		targetSpot,
	];

	assert.strictEqual(findSpotById(spots, "A-01"), targetSpot);
});

test("input not mutated", () => {
	const spot1 = { id: "A-01", status: "free" };
	const spot2 = { id: "B-02", status: "occupied" };
	const spots = [spot1, spot2];
	const originalSpots = spots.slice();
	const originalSpot1 = { ...spot1 };
	const originalSpot2 = { ...spot2 };

	const result = findSpotById(spots, "A-01");

	assert.strictEqual(result, spot1);
	assert.deepStrictEqual(spots, originalSpots);
	assert.deepStrictEqual(spot1, originalSpot1);
	assert.deepStrictEqual(spot2, originalSpot2);
});

test("matches case-insensitively and handles flexible spot ID formatting", () => {
	const spot = { id: "a-1", status: "free" };
	const spots = [spot];

	assert.strictEqual(findSpotById(spots, "A-01"), spot);
	assert.strictEqual(findSpotById(spots, " a_01 "), spot);
});
