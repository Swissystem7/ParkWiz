const test = require("node:test");
const assert = require("node:assert/strict");
const { findNearestFreeSpot } = require("../src/lib/findNearestFreeSpot");

test("picks the nearest free spot", () => {
	const spots = [
		{ id: "A-01", status: "free", x: 10, y: 10 },
		{ id: "A-02", status: "free", x: 2, y: 3 },
		{ id: "A-03", status: "free", x: 5, y: 5 },
	];

	const result = findNearestFreeSpot(spots);
	assert.strictEqual(result.id, "A-02");
	assert.strictEqual(result.distance, 3.61);
});

test("ignores occupied and unknown spots even when closer", () => {
	const spots = [
		{ id: "B-01", status: "occupied", x: 1, y: 1 },
		{ id: "B-02", status: "unknown", x: 0.5, y: 0.5 },
		{ id: "B-03", status: "free", x: 6, y: 8 },
	];

	const result = findNearestFreeSpot(spots);
	assert.strictEqual(result.id, "B-03");
	assert.strictEqual(result.distance, 10);
});

test("returns null for a full lot with no free spots", () => {
	const spots = [
		{ id: "C-01", status: "occupied", x: 1, y: 1 },
		{ id: "C-02", status: "reserved", x: 2, y: 2 },
		{ id: "C-03", status: "unknown", x: 3, y: 3 },
	];

	assert.strictEqual(findNearestFreeSpot(spots), null);
});

test("returns null for empty array and non-array inputs", () => {
	assert.strictEqual(findNearestFreeSpot([]), null);
	assert.strictEqual(findNearestFreeSpot(null), null);
	assert.strictEqual(findNearestFreeSpot(undefined), null);
	assert.strictEqual(findNearestFreeSpot(42), null);
	assert.strictEqual(findNearestFreeSpot("spots"), null);
	assert.strictEqual(findNearestFreeSpot({}), null);
});

test("custom reference coordinates change the result", () => {
	const spots = [
		{ id: "D-01", status: "free", x: 1, y: 1 },
		{ id: "D-02", status: "free", x: 9, y: 9 },
	];

	const nearOrigin = findNearestFreeSpot(spots, { x: 0, y: 0 });
	assert.strictEqual(nearOrigin.id, "D-01");

	const nearCorner = findNearestFreeSpot(spots, { x: 10, y: 10 });
	assert.strictEqual(nearCorner.id, "D-02");
});

test("skips free spots without numeric coordinates", () => {
	const spots = [
		null,
		undefined,
		"invalid",
		{ id: "E-01", status: "free", x: "1", y: 2 },
		{ id: "E-02", status: "free", x: NaN, y: 2 },
		{ id: "E-03", status: "free", x: 2, y: Infinity },
		{ id: "E-04", status: "free" },
		{ id: "E-05", status: "free", x: 3, y: 4 },
	];

	const result = findNearestFreeSpot(spots);
	assert.strictEqual(result.id, "E-05");
	assert.strictEqual(result.distance, 5);

	const onlyInvalid = [
		{ id: "E-01", status: "free", x: "1", y: 2 },
		{ id: "E-02", status: "free", x: 1, y: null },
	];
	assert.strictEqual(findNearestFreeSpot(onlyInvalid), null);
});

test("tie keeps the first candidate", () => {
	const spots = [
		{ id: "T-01", status: "free", x: 0, y: 5 },
		{ id: "T-02", status: "free", x: 5, y: 0 },
		{ id: "T-03", status: "free", x: 0, y: -5 },
	];

	const result1 = findNearestFreeSpot(spots);
	assert.strictEqual(result1.id, "T-01");

	const reversedSpots = [...spots].reverse();
	const result2 = findNearestFreeSpot(reversedSpots);
	assert.strictEqual(result2.id, "T-03");
});

test("rounds distance to 2 decimals", () => {
	const spots = [{ id: "R-01", status: "free", x: 1, y: 2 }];
	// sqrt(1^2 + 2^2) = sqrt(5) = 2.23606797749979 -> 2.24
	const result = findNearestFreeSpot(spots);
	assert.strictEqual(result.distance, 2.24);

	const spotsExact = [{ id: "R-02", status: "free", x: 3, y: 4 }];
	const resultExact = findNearestFreeSpot(spotsExact);
	assert.strictEqual(resultExact.distance, 5);
});

test("does not mutate the input spot object", () => {
	const originalSpot = Object.freeze({
		id: "M-01",
		status: "free",
		x: 3,
		y: 4,
	});

	const result = findNearestFreeSpot([originalSpot]);
	assert.notStrictEqual(result, originalSpot);
	assert.strictEqual(result.id, originalSpot.id);
	assert.strictEqual(result.distance, 5);
	assert.strictEqual(Object.hasOwn(originalSpot, "distance"), false);
});

test("falls back to { x: 0, y: 0 } when referenceCoords is invalid or non-finite", () => {
	const spots = [{ id: "F-01", status: "free", x: 3, y: 4 }];

	const resNull = findNearestFreeSpot(spots, null);
	assert.strictEqual(resNull.distance, 5);

	const resPartial = findNearestFreeSpot(spots, { x: 10 });
	assert.strictEqual(resPartial.distance, 5);

	const resNaN = findNearestFreeSpot(spots, { x: NaN, y: 0 });
	assert.strictEqual(resNaN.distance, 5);

	const resString = findNearestFreeSpot(spots, { x: "0", y: "0" });
	assert.strictEqual(resString.distance, 5);
});
