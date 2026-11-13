const test = require("node:test");
const assert = require("node:assert/strict");
const {
	aggregateOccupancyByFloor,
} = require("../src/lib/aggregateOccupancyByFloor.js");

test("aggregates spots across levels -1, -2, and 0 with correct counters", () => {
	const spots = [
		{ id: "S1", level: -2, status: "free" },
		{ id: "S2", level: -2, status: "occupied" },
		{ id: "S3", level: -1, status: "free" },
		{ id: "S4", level: -1, status: "free" },
		{ id: "S5", level: -1, status: "occupied" },
		{ id: "S6", level: -1, status: "unknown" },
		{ id: "S7", level: 0, status: "free" },
		{ id: "S8", level: 0, status: "occupied" },
		{ id: "S9", level: 0, status: "occupied" },
	];

	const result = aggregateOccupancyByFloor(spots);

	assert.strictEqual(result.totalSpots, 9);
	assert.deepStrictEqual(result.floors["-2"], {
		total: 2,
		free: 1,
		occupied: 1,
		unknown: 0,
		ratePercent: "50.0%",
	});
	assert.deepStrictEqual(result.floors["-1"], {
		total: 4,
		free: 2,
		occupied: 1,
		unknown: 1,
		ratePercent: "25.0%",
	});
	assert.deepStrictEqual(result.floors["0"], {
		total: 3,
		free: 1,
		occupied: 2,
		unknown: 0,
		ratePercent: "66.7%",
	});
});

test("computes exact ratePercent per level matching formatOccupancyRate results", () => {
	const spots = [
		// Floor 1: 1 occupied of 3 total -> '33.3%'
		{ level: 1, status: "occupied" },
		{ level: 1, status: "free" },
		{ level: 1, status: "free" },
		// Floor 2: 2 occupied of 2 total -> '100.0%'
		{ level: 2, status: "occupied" },
		{ level: 2, status: "occupied" },
		// Floor 3: 0 occupied of 4 total -> '0.0%'
		{ level: 3, status: "free" },
		{ level: 3, status: "free" },
		{ level: 3, status: "unknown" },
		{ level: 3, status: "unknown" },
	];

	const result = aggregateOccupancyByFloor(spots);

	assert.strictEqual(result.floors["1"].ratePercent, "33.3%");
	assert.strictEqual(result.floors["2"].ratePercent, "100.0%");
	assert.strictEqual(result.floors["3"].ratePercent, "0.0%");
});

test("assigns items with missing or invalid level to level -1", () => {
	const spots = [
		{ id: "A", status: "free" },
		{ id: "B", level: null, status: "occupied" },
		{ id: "C", level: undefined, status: "free" },
		{ id: "D", level: "0", status: "occupied" },
		{ id: "E", level: 1.5, status: "unknown" },
		{ id: "F", level: Number.NaN, status: "free" },
		{ id: "G", level: {}, status: "free" },
	];

	const result = aggregateOccupancyByFloor(spots);

	assert.strictEqual(result.totalSpots, 7);
	assert.deepStrictEqual(result.floors["-1"], {
		total: 7,
		free: 4,
		occupied: 2,
		unknown: 1,
		ratePercent: "28.6%",
	});
	assert.strictEqual(result.floors["0"], undefined);
	assert.strictEqual(result.floors["1"], undefined);
});

test("counts explicit 'unknown' and odd/unrecognized statuses as unknown", () => {
	const spots = [
		{ level: 1, status: "unknown" },
		{ level: 1, status: "reserved" },
		{ level: 1, status: "maintenance" },
		{ level: 1, status: "" },
		{ level: 1, status: null },
		{ level: 1, status: undefined },
		{ level: 1, status: 123 },
		{ level: 1, status: "FREE" },
		{ level: 1, status: "free" },
		{ level: 1, status: "occupied" },
	];

	const result = aggregateOccupancyByFloor(spots);

	assert.deepStrictEqual(result.floors["1"], {
		total: 10,
		free: 1,
		occupied: 1,
		unknown: 8,
		ratePercent: "10.0%",
	});
});

test("returns empty floors and totalSpots 0 for empty array, null, undefined, and non-array inputs", () => {
	const expected = { floors: {}, totalSpots: 0 };

	assert.deepStrictEqual(aggregateOccupancyByFloor([]), expected);
	assert.deepStrictEqual(aggregateOccupancyByFloor(null), expected);
	assert.deepStrictEqual(aggregateOccupancyByFloor(undefined), expected);
	assert.deepStrictEqual(aggregateOccupancyByFloor("not-an-array"), expected);
	assert.deepStrictEqual(aggregateOccupancyByFloor(42), expected);
	assert.deepStrictEqual(aggregateOccupancyByFloor({}), expected);
	assert.deepStrictEqual(aggregateOccupancyByFloor(true), expected);
});

test("skips non-object items while still counting them toward totalSpots", () => {
	const spots = [
		null,
		undefined,
		42,
		"some string",
		true,
		[],
		{ level: 2, status: "free" },
		{ level: 2, status: "occupied" },
	];

	const result = aggregateOccupancyByFloor(spots);

	assert.strictEqual(result.totalSpots, 8);
	assert.deepStrictEqual(result.floors, {
		2: {
			total: 2,
			free: 1,
			occupied: 1,
			unknown: 0,
			ratePercent: "50.0%",
		},
	});
});

test("does not mutate the input array or its item objects", () => {
	const spots = [
		{ id: "A-01", level: 1, status: "free" },
		{ id: "A-02", level: 2, status: "occupied" },
	];
	const originalSpots = JSON.parse(JSON.stringify(spots));

	aggregateOccupancyByFloor(spots);

	assert.deepStrictEqual(spots, originalSpots);
});

test("does not modify frozen input arrays or objects", () => {
	const spot1 = Object.freeze({ id: "F-01", level: 0, status: "free" });
	const spot2 = Object.freeze({ id: "F-02", level: 0, status: "occupied" });
	const spots = Object.freeze([spot1, spot2]);

	assert.doesNotThrow(() => {
		const result = aggregateOccupancyByFloor(spots);
		assert.strictEqual(result.totalSpots, 2);
		assert.strictEqual(result.floors["0"].ratePercent, "50.0%");
	});
});

test("handles an array containing only non-object items", () => {
	const spots = [null, 10, "invalid", undefined];
	const result = aggregateOccupancyByFloor(spots);

	assert.strictEqual(result.totalSpots, 4);
	assert.deepStrictEqual(result.floors, {});
});
