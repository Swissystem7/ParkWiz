const test = require("node:test");
const assert = require("node:assert/strict");
const { isSpotAvailable } = require("../src/lib/isSpotAvailable");

const FIXED_NOW = 1_700_000_000_000;

test("returns true for a fresh free spot", () => {
	const spot = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 10_000,
	};
	assert.strictEqual(isSpotAvailable(spot, 60, FIXED_NOW), true);
});

test("returns false for occupied and unknown spot statuses", () => {
	const occupiedSpot = {
		id: "spot-2",
		status: "occupied",
		ts: FIXED_NOW - 5_000,
	};
	const unknownSpot = {
		id: "spot-3",
		status: "unknown",
		ts: FIXED_NOW - 5_000,
	};
	assert.strictEqual(isSpotAvailable(occupiedSpot, 60, FIXED_NOW), false);
	assert.strictEqual(isSpotAvailable(unknownSpot, 60, FIXED_NOW), false);
});

test("returns false for a free spot that is 61 seconds old", () => {
	const staleSpot = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 61_000,
	};
	assert.strictEqual(isSpotAvailable(staleSpot, 60, FIXED_NOW), false);
});

test("returns true for a free spot that is exactly 60 seconds old", () => {
	const boundarySpot = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 60_000,
	};
	assert.strictEqual(isSpotAvailable(boundarySpot, 60, FIXED_NOW), true);
});

test("handles custom maxStalenessSeconds correctly", () => {
	const spotWithin10s = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 9_000,
	};
	const spotExact10s = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 10_000,
	};
	const spotPast10s = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 11_000,
	};
	assert.strictEqual(isSpotAvailable(spotWithin10s, 10, FIXED_NOW), true);
	assert.strictEqual(isSpotAvailable(spotExact10s, 10, FIXED_NOW), true);
	assert.strictEqual(isSpotAvailable(spotPast10s, 10, FIXED_NOW), false);
});

test("returns false for future timestamps", () => {
	const futureSpot1 = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW + 1,
	};
	const futureSpotFar = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW + 60_000,
	};
	assert.strictEqual(isSpotAvailable(futureSpot1, 60, FIXED_NOW), false);
	assert.strictEqual(isSpotAvailable(futureSpotFar, 60, FIXED_NOW), false);
});

test("returns false for missing, zero, negative, or NaN timestamps", () => {
	const invalidTimestamps = [
		undefined,
		null,
		0,
		-1,
		-5000,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		"1700000000000",
	];
	for (const ts of invalidTimestamps) {
		const spot = {
			id: "spot-1",
			status: "free",
			ts,
		};
		assert.strictEqual(isSpotAvailable(spot, 60, FIXED_NOW), false);
	}
});

test("returns false for invalid records", () => {
	const invalidRecords = [
		null,
		undefined,
		[],
		{},
		{ status: "free", ts: FIXED_NOW },
		{ id: "", status: "free", ts: FIXED_NOW },
		{ id: "   ", status: "free", ts: FIXED_NOW },
		{ id: 123, status: "free", ts: FIXED_NOW },
		{ id: "spot-1", status: "FREE", ts: FIXED_NOW },
		{ id: "spot-1", status: "available", ts: FIXED_NOW },
	];
	for (const record of invalidRecords) {
		assert.strictEqual(isSpotAvailable(record, 60, FIXED_NOW), false);
	}
});

test("returns false for invalid maxStalenessSeconds or now", () => {
	const validSpot = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 5_000,
	};

	const invalidStaleness = [
		-1,
		-0.01,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		"60",
		null,
	];
	for (const maxStaleness of invalidStaleness) {
		assert.strictEqual(
			isSpotAvailable(validSpot, maxStaleness, FIXED_NOW),
			false,
		);
	}

	const invalidNow = [
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		"1700000000000",
		null,
	];
	for (const now of invalidNow) {
		assert.strictEqual(isSpotAvailable(validSpot, 60, now), false);
	}
});

test("does not mutate the input spot object", () => {
	const spot = {
		id: "spot-1",
		status: "free",
		ts: FIXED_NOW - 5_000,
	};
	const snapshot = JSON.stringify(spot);
	const frozen = Object.freeze({ ...spot });

	assert.strictEqual(isSpotAvailable(spot, 60, FIXED_NOW), true);
	assert.strictEqual(JSON.stringify(spot), snapshot);

	assert.strictEqual(isSpotAvailable(frozen, 60, FIXED_NOW), true);
});
