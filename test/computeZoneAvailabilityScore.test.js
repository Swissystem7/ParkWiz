const test = require("node:test");
const assert = require("node:assert/strict");
const {
	computeZoneAvailabilityScore,
} = require("../src/lib/computeZoneAvailabilityScore");

test("returns 0.667 for 10 free spots out of 15", () => {
	assert.strictEqual(computeZoneAvailabilityScore(10, 15), 0.667);
});

test("returns 0 for 0 free spots out of 15", () => {
	assert.strictEqual(computeZoneAvailabilityScore(0, 15), 0);
});

test("returns 1 for 15 free spots out of 15", () => {
	assert.strictEqual(computeZoneAvailabilityScore(15, 15), 1);
});

test("returns 0.25 for 5 free spots out of 20", () => {
	assert.strictEqual(computeZoneAvailabilityScore(5, 20), 0.25);
});

test("clamps over-capacity free spots (20 of 15) to 1", () => {
	assert.strictEqual(computeZoneAvailabilityScore(20, 15), 1);
});

test("clamps negative free spots to 0", () => {
	assert.strictEqual(computeZoneAvailabilityScore(-5, 15), 0);
	assert.strictEqual(computeZoneAvailabilityScore(-1, 20), 0);
});

test("returns 0 for NaN inputs", () => {
	assert.strictEqual(computeZoneAvailabilityScore(Number.NaN, 15), 0);
	assert.strictEqual(computeZoneAvailabilityScore(10, Number.NaN), 0);
	assert.strictEqual(computeZoneAvailabilityScore(Number.NaN, Number.NaN), 0);
});

test("returns 0 for string inputs", () => {
	assert.strictEqual(computeZoneAvailabilityScore("10", 15), 0);
	assert.strictEqual(computeZoneAvailabilityScore(10, "15"), 0);
	assert.strictEqual(computeZoneAvailabilityScore("10", "15"), 0);
});

test("returns 0 for Infinity inputs", () => {
	assert.strictEqual(
		computeZoneAvailabilityScore(Number.POSITIVE_INFINITY, 15),
		0,
	);
	assert.strictEqual(
		computeZoneAvailabilityScore(10, Number.POSITIVE_INFINITY),
		0,
	);
	assert.strictEqual(
		computeZoneAvailabilityScore(Number.NEGATIVE_INFINITY, 15),
		0,
	);
});

test("returns 0 for zero or negative total spots", () => {
	assert.strictEqual(computeZoneAvailabilityScore(10, 0), 0);
	assert.strictEqual(computeZoneAvailabilityScore(0, 0), 0);
	assert.strictEqual(computeZoneAvailabilityScore(10, -15), 0);
	assert.strictEqual(computeZoneAvailabilityScore(5, -1), 0);
});

test("always returns a score within [0, 1]", () => {
	const cases = [
		[0, 15],
		[10, 15],
		[15, 15],
		[20, 15],
		[-5, 15],
		[5, 20],
		[1, 3],
		[2, 3],
	];
	for (const [freeSpots, totalSpots] of cases) {
		const score = computeZoneAvailabilityScore(freeSpots, totalSpots);
		assert.ok(score >= 0 && score <= 1, `score ${score} out of range`);
	}
});
