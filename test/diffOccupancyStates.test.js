const test = require("node:test");
const assert = require("node:assert/strict");
const { diffOccupancyStates } = require("../src/lib/diffOccupancyStates");

test("detects when one spot changed free to occupied", () => {
	const prev = [{ id: "A-01", status: "free" }];
	const curr = [{ id: "A-01", status: "occupied" }];
	const ts = 1_700_000_000_000;

	const events = diffOccupancyStates(prev, curr, ts);

	assert.deepStrictEqual(events, [
		{
			id: "A-01",
			previousStatus: "free",
			currentStatus: "occupied",
			changedAt: ts,
		},
	]);
});

test("detects several spots changed and order follows currentSpots", () => {
	const prev = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
		{ id: "A-03", status: "free" },
	];
	const curr = [
		{ id: "A-03", status: "occupied" },
		{ id: "A-01", status: "occupied" },
		{ id: "A-02", status: "occupied" },
	];
	const ts = 1_700_000_000_500;

	const events = diffOccupancyStates(prev, curr, ts);

	assert.deepStrictEqual(events, [
		{
			id: "A-03",
			previousStatus: "free",
			currentStatus: "occupied",
			changedAt: ts,
		},
		{
			id: "A-01",
			previousStatus: "free",
			currentStatus: "occupied",
			changedAt: ts,
		},
	]);
});

test("returns empty array for identical samples", () => {
	const prev = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
	];
	const curr = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
	];

	assert.deepStrictEqual(diffOccupancyStates(prev, curr), []);
});

test("reports new spot in current with previousStatus 'unknown'", () => {
	const prev = [{ id: "A-01", status: "free" }];
	const curr = [
		{ id: "A-01", status: "free" },
		{ id: "B-02", status: "occupied" },
	];
	const ts = 1_700_000_001_000;

	const events = diffOccupancyStates(prev, curr, ts);

	assert.deepStrictEqual(events, [
		{
			id: "B-02",
			previousStatus: "unknown",
			currentStatus: "occupied",
			changedAt: ts,
		},
	]);
});

test("generates no event when a spot is removed from current", () => {
	const prev = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
	];
	const curr = [{ id: "A-01", status: "free" }];

	assert.deepStrictEqual(diffOccupancyStates(prev, curr), []);
});

test("uses custom timestamp as changedAt", () => {
	const prev = [{ id: "A-01", status: "free" }];
	const curr = [{ id: "A-01", status: "occupied" }];
	const customTs = 1_699_999_999_123;

	const events = diffOccupancyStates(prev, curr, customTs);

	assert.strictEqual(events.length, 1);
	assert.strictEqual(events[0].changedAt, customTs);
});

test("default timestamp is a number close to Date.now()", () => {
	const prev = [{ id: "A-01", status: "free" }];
	const curr = [{ id: "A-01", status: "occupied" }];

	const before = Date.now();
	const events = diffOccupancyStates(prev, curr);
	const after = Date.now();

	assert.strictEqual(events.length, 1);
	assert.strictEqual(typeof events[0].changedAt, "number");
	assert.ok(events[0].changedAt >= before);
	assert.ok(events[0].changedAt <= after);
});

test("returns empty array when given empty arrays", () => {
	assert.deepStrictEqual(diffOccupancyStates([], []), []);
});

test("returns empty array when currentSpots is not an array", () => {
	const validSpots = [{ id: "A-01", status: "free" }];

	assert.deepStrictEqual(diffOccupancyStates(validSpots, null), []);
	assert.deepStrictEqual(diffOccupancyStates(validSpots, undefined), []);
	assert.deepStrictEqual(diffOccupancyStates(validSpots, "not-an-array"), []);
	assert.deepStrictEqual(diffOccupancyStates(validSpots, 12345), []);
	assert.deepStrictEqual(diffOccupancyStates(validSpots, {}), []);
	assert.deepStrictEqual(diffOccupancyStates(validSpots, true), []);
});

test("reports all current spots as from 'unknown' when previousSpots is not an array", () => {
	const curr = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
	];
	const ts = 1_700_000_002_000;

	const invalidPreviousValues = [null, undefined, "invalid", 42, {}, false];

	for (const invalidPrev of invalidPreviousValues) {
		const events = diffOccupancyStates(invalidPrev, curr, ts);
		assert.deepStrictEqual(events, [
			{
				id: "A-01",
				previousStatus: "unknown",
				currentStatus: "free",
				changedAt: ts,
			},
			{
				id: "A-02",
				previousStatus: "unknown",
				currentStatus: "occupied",
				changedAt: ts,
			},
		]);
	}
});

test("does not mutate inputs", () => {
	const prev = [
		{ id: "A-01", status: "free" },
		{ id: "A-02", status: "occupied" },
	];
	const curr = [
		{ id: "A-01", status: "occupied" },
		{ id: "A-02", status: "occupied" },
	];

	const prevSnapshot = JSON.stringify(prev);
	const currSnapshot = JSON.stringify(curr);

	const frozenPrev = Object.freeze([
		Object.freeze({ id: "A-01", status: "free" }),
		Object.freeze({ id: "A-02", status: "occupied" }),
	]);
	const frozenCurr = Object.freeze([
		Object.freeze({ id: "A-01", status: "occupied" }),
		Object.freeze({ id: "A-02", status: "occupied" }),
	]);

	const events = diffOccupancyStates(prev, curr);
	assert.strictEqual(events.length, 1);
	assert.strictEqual(JSON.stringify(prev), prevSnapshot);
	assert.strictEqual(JSON.stringify(curr), currSnapshot);

	const frozenEvents = diffOccupancyStates(frozenPrev, frozenCurr);
	assert.strictEqual(frozenEvents.length, 1);
});

test("skips non-object items and items without id in both previous and current spots", () => {
	const prev = [
		null,
		undefined,
		123,
		"text",
		[],
		{},
		{ id: null, status: "free" },
		{ id: undefined, status: "free" },
		{ id: "", status: "free" },
		{ id: "   ", status: "free" },
		{ id: "A-01", status: "free" },
	];
	const curr = [
		null,
		undefined,
		456,
		"other-text",
		[],
		{},
		{ id: null, status: "occupied" },
		{ id: undefined, status: "occupied" },
		{ id: "", status: "occupied" },
		{ id: "   ", status: "occupied" },
		{ id: "A-01", status: "occupied" },
	];
	const ts = 1_700_000_003_000;

	const events = diffOccupancyStates(prev, curr, ts);

	assert.deepStrictEqual(events, [
		{
			id: "A-01",
			previousStatus: "free",
			currentStatus: "occupied",
			changedAt: ts,
		},
	]);
});
