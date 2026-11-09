const test = require("node:test");
const assert = require("node:assert/strict");
const { formatOccupancyStats } = require("../src/lib/formatOccupancyStats");

test("formats typical lot with 15 spots (10 free, 5 occupied)", () => {
	const spots = [
		...Array.from({ length: 10 }, (_, i) => ({
			id: `A${i + 1}`,
			status: "free",
		})),
		...Array.from({ length: 5 }, (_, i) => ({
			id: `B${i + 1}`,
			status: "occupied",
		})),
	];

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(stats, {
		total: 15,
		free: 10,
		occupied: 5,
		unknown: 0,
		ratePercent: "33.3%",
		category: "low",
	});
});

test("formats busy lot (17 of 20 occupied)", () => {
	const spots = [
		...Array.from({ length: 17 }, (_, i) => ({
			id: `A${i + 1}`,
			status: "occupied",
		})),
		...Array.from({ length: 3 }, (_, i) => ({
			id: `B${i + 1}`,
			status: "free",
		})),
	];

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(stats, {
		total: 20,
		free: 3,
		occupied: 17,
		unknown: 0,
		ratePercent: "85.0%",
		category: "high",
	});
});

test("formats full lot with 50 of 50 spots occupied", () => {
	const spots = Array.from({ length: 50 }, (_, i) => ({
		id: `F${i + 1}`,
		status: "occupied",
	}));

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(stats, {
		total: 50,
		free: 0,
		occupied: 50,
		unknown: 0,
		ratePercent: "100.0%",
		category: "full",
	});
});

test("formats full lot threshold with 49 of 50 spots occupied", () => {
	const spots = [
		...Array.from({ length: 49 }, (_, i) => ({
			id: `F${i + 1}`,
			status: "occupied",
		})),
		{ id: "F50", status: "free" },
	];

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(stats, {
		total: 50,
		free: 1,
		occupied: 49,
		unknown: 0,
		ratePercent: "98.0%",
		category: "full",
	});
});

test("formats medium occupancy lot (6 of 10 occupied)", () => {
	const spots = [
		...Array.from({ length: 6 }, (_, i) => ({
			id: `M${i + 1}`,
			status: "occupied",
		})),
		...Array.from({ length: 4 }, (_, i) => ({
			id: `M${i + 7}`,
			status: "free",
		})),
	];

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(stats, {
		total: 10,
		free: 4,
		occupied: 6,
		unknown: 0,
		ratePercent: "60.0%",
		category: "medium",
	});
});

test("counts spots with status unknown or other non-standard status in unknown and total", () => {
	const spots = [
		{ id: "U1", status: "unknown" },
		{ id: "U2", status: "reserved" },
		{ id: "U3", status: "" },
		{ id: "U4", status: "free" },
		{ id: "U5", status: "occupied" },
	];

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(stats, {
		total: 5,
		free: 1,
		occupied: 1,
		unknown: 3,
		ratePercent: "20.0%",
		category: "low",
	});
});

test("returns zero stats object for empty array", () => {
	const stats = formatOccupancyStats([]);
	assert.deepStrictEqual(stats, {
		total: 0,
		free: 0,
		occupied: 0,
		unknown: 0,
		ratePercent: "0.0%",
		category: "low",
	});
});

test("returns zero stats object for null, undefined, and non-array inputs", () => {
	const expected = {
		total: 0,
		free: 0,
		occupied: 0,
		unknown: 0,
		ratePercent: "0.0%",
		category: "low",
	};

	assert.deepStrictEqual(formatOccupancyStats(null), expected);
	assert.deepStrictEqual(formatOccupancyStats(undefined), expected);
	assert.deepStrictEqual(formatOccupancyStats("not-an-array"), expected);
	assert.deepStrictEqual(formatOccupancyStats(123), expected);
	assert.deepStrictEqual(formatOccupancyStats({ total: 10 }), expected);
});

test("does not mutate the input array or spot objects", () => {
	const spots = [
		Object.freeze({ id: "S1", status: "free" }),
		Object.freeze({ id: "S2", status: "occupied" }),
	];
	const copy = [...spots];
	Object.freeze(spots);

	const stats = formatOccupancyStats(spots);
	assert.deepStrictEqual(spots, copy);
	assert.deepStrictEqual(stats, {
		total: 2,
		free: 1,
		occupied: 1,
		unknown: 0,
		ratePercent: "50.0%",
		category: "medium",
	});
});
