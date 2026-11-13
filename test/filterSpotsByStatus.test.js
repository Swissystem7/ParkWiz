const test = require("node:test");
const assert = require("node:assert/strict");
const { filterSpotsByStatus } = require("../src/lib/filterSpotsByStatus");

test("filters spots by free, occupied, and unknown status", () => {
	const spots = [
		{ id: 1, status: "free" },
		{ id: 2, status: "occupied" },
		{ id: 3, status: "unknown" },
	];

	assert.deepStrictEqual(filterSpotsByStatus(spots, "free"), [spots[0]]);
	assert.deepStrictEqual(filterSpotsByStatus(spots, "occupied"), [spots[1]]);
	assert.deepStrictEqual(filterSpotsByStatus(spots, "unknown"), [spots[2]]);
});

test("matches status case-insensitively and trims whitespace", () => {
	const spot = { status: "  FREE " };

	assert.deepStrictEqual(filterSpotsByStatus([spot], " free "), [spot]);
	assert.deepStrictEqual(filterSpotsByStatus([spot], "FREE"), [spot]);
});

test("returns an empty array for empty and non-array spots", () => {
	assert.deepStrictEqual(filterSpotsByStatus([], "free"), []);
	assert.deepStrictEqual(filterSpotsByStatus(null, "free"), []);
	assert.deepStrictEqual(filterSpotsByStatus(undefined, "free"), []);
	assert.deepStrictEqual(filterSpotsByStatus({}, "free"), []);
	assert.deepStrictEqual(filterSpotsByStatus("free", "free"), []);
});

test("returns an empty array for invalid target statuses", () => {
	const spots = [{ status: "free" }];

	assert.deepStrictEqual(filterSpotsByStatus(spots, ""), []);
	assert.deepStrictEqual(filterSpotsByStatus(spots, "   "), []);
	assert.deepStrictEqual(filterSpotsByStatus(spots, null), []);
	assert.deepStrictEqual(filterSpotsByStatus(spots, undefined), []);
	assert.deepStrictEqual(filterSpotsByStatus(spots, 1), []);
});

test("skips malformed spot items", () => {
	const validSpot = { status: "free" };
	const spots = [null, {}, { status: null }, { status: 1 }, validSpot];

	assert.deepStrictEqual(filterSpotsByStatus(spots, "free"), [validSpot]);
});

test("does not mutate the input array or its items", () => {
	const spot = { id: 1, status: "free" };
	const spots = [spot, { id: 2, status: "occupied" }];
	const originalSpots = spots.slice();
	const originalSpot = { ...spot };

	const result = filterSpotsByStatus(spots, "free");

	assert.notStrictEqual(result, spots);
	assert.deepStrictEqual(spots, originalSpots);
	assert.deepStrictEqual(spot, originalSpot);
	assert.strictEqual(result[0], spot);
});
