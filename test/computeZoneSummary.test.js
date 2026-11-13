const test = require("node:test");
const assert = require("node:assert/strict");
const { computeZoneSummary } = require("../src/lib/computeZoneSummary");

test("summarizes multiple zones and normalizes statuses", () => {
	const spots = [
		{ zone: " A ", status: "free" },
		{ zone: "A", status: " OCCUPIED " },
		{ zone: "B", status: "occupied" },
		{ zone: "B", status: "unknown" },
		{ zone: "B", status: "FREE" },
	];

	assert.deepStrictEqual(computeZoneSummary(spots), {
		total: { total: 5, free: 2, occupied: 2, unknown: 1 },
		zones: {
			A: { total: 2, free: 1, occupied: 1, unknown: 0 },
			B: { total: 3, free: 1, occupied: 1, unknown: 1 },
		},
	});
});

test("uses explicit zones before id prefixes and falls back to DEFAULT", () => {
	assert.deepStrictEqual(
		computeZoneSummary([
			{ zone: "C", id: "d-1", status: "free" },
			{ id: "b-1", status: "free" },
			{ id: "7-1", status: "occupied" },
			{ status: "free" },
		]),
		{
			total: { total: 4, free: 3, occupied: 1, unknown: 0 },
			zones: {
				C: { total: 1, free: 1, occupied: 0, unknown: 0 },
				B: { total: 1, free: 1, occupied: 0, unknown: 0 },
				7: { total: 1, free: 0, occupied: 1, unknown: 0 },
				DEFAULT: { total: 1, free: 1, occupied: 0, unknown: 0 },
			},
		},
	);
});

test("returns empty summaries for empty or non-array inputs", () => {
	const expected = {
		total: { total: 0, free: 0, occupied: 0, unknown: 0 },
		zones: {},
	};

	assert.deepStrictEqual(computeZoneSummary([]), expected);
	assert.deepStrictEqual(computeZoneSummary(null), expected);
	assert.deepStrictEqual(computeZoneSummary("spots"), expected);
	assert.deepStrictEqual(computeZoneSummary({}), expected);
});

test("ignores null and non-object items", () => {
	assert.deepStrictEqual(computeZoneSummary([null, 1, "spot", undefined]), {
		total: { total: 0, free: 0, occupied: 0, unknown: 0 },
		zones: {},
	});
});

test("counts missing and odd statuses as unknown", () => {
	assert.deepStrictEqual(
		computeZoneSummary([
			{ zone: "A" },
			{ zone: "A", status: "reserved" },
			{ zone: "A", status: " free " },
		]),
		{
			total: { total: 3, free: 1, occupied: 0, unknown: 2 },
			zones: {
				A: { total: 3, free: 1, occupied: 0, unknown: 2 },
			},
		},
	);
});

test("does not mutate the input", () => {
	const spots = [
		{ zone: " A ", id: "a-1", status: " FREE " },
		{ id: "b-1", status: "occupied" },
	];
	const original = JSON.parse(JSON.stringify(spots));

	computeZoneSummary(spots);

	assert.deepStrictEqual(spots, original);
});
