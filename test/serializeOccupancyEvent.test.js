const test = require("node:test");
const assert = require("node:assert/strict");
const {
	serializeOccupancyEvent,
} = require("../src/lib/serializeOccupancyEvent");

test("serializes 'free' status round-trip via JSON.parse with exact keys {id, status, ts}", () => {
	const raw = serializeOccupancyEvent("A-01", "free", 1700000000000);
	assert.strictEqual(typeof raw, "string");

	const parsed = JSON.parse(raw);
	assert.deepStrictEqual(parsed, {
		id: "A-01",
		status: "free",
		ts: 1700000000000,
	});
	assert.deepStrictEqual(Object.keys(parsed), ["id", "status", "ts"]);
});

test("serializes 'occupied' status round-trip via JSON.parse with exact keys {id, status, ts}", () => {
	const raw = serializeOccupancyEvent("B-02", "OCCUPIED", 1700000000000);
	assert.strictEqual(typeof raw, "string");

	const parsed = JSON.parse(raw);
	assert.deepStrictEqual(parsed, {
		id: "B-02",
		status: "occupied",
		ts: 1700000000000,
	});
	assert.deepStrictEqual(Object.keys(parsed), ["id", "status", "ts"]);
});

test("serializes 'unknown' status round-trip via JSON.parse with exact keys {id, status, ts}", () => {
	const raw = serializeOccupancyEvent("C-03", "Unknown", 1700000000000);
	assert.strictEqual(typeof raw, "string");

	const parsed = JSON.parse(raw);
	assert.deepStrictEqual(parsed, {
		id: "C-03",
		status: "unknown",
		ts: 1700000000000,
	});
	assert.deepStrictEqual(Object.keys(parsed), ["id", "status", "ts"]);
});

test("normalizes spotId via normalizeSpotId when matching pattern", () => {
	const raw1 = serializeOccupancyEvent("a1", "free", 1700000000000);
	assert.strictEqual(JSON.parse(raw1).id, "A-01");

	const raw2 = serializeOccupancyEvent("  b_2  ", "free", 1700000000000);
	assert.strictEqual(JSON.parse(raw2).id, "B-02");
});

test("falls back to trimmed uppercase string for spotId not matching normalizeSpotId", () => {
	const raw1 = serializeOccupancyEvent("lot-99", "free", 1700000000000);
	assert.strictEqual(JSON.parse(raw1).id, "LOT-99");

	const raw2 = serializeOccupancyEvent(
		"  floor2-zone-east  ",
		"free",
		1700000000000,
	);
	assert.strictEqual(JSON.parse(raw2).id, "FLOOR2-ZONE-EAST");
});

test("defaults timestamp to Date.now() when omitted", () => {
	const before = Date.now();
	const raw = serializeOccupancyEvent("A-01", "free");
	const after = Date.now();

	const parsed = JSON.parse(raw);
	assert.strictEqual(parsed.id, "A-01");
	assert.strictEqual(parsed.status, "free");
	assert.ok(parsed.ts >= before && parsed.ts <= after);
	assert.strictEqual(Number.isInteger(parsed.ts), true);
});

test("rounds floating-point timestamp to nearest integer", () => {
	const raw1 = serializeOccupancyEvent("A-01", "free", 1700000000123.4);
	assert.strictEqual(JSON.parse(raw1).ts, 1700000000123);

	const raw2 = serializeOccupancyEvent("A-01", "free", 1700000000123.6);
	assert.strictEqual(JSON.parse(raw2).ts, 1700000000124);

	const raw3 = serializeOccupancyEvent("A-01", "free", "1700000000500");
	assert.strictEqual(JSON.parse(raw3).ts, 1700000000500);
});

test("returns null for 'reserved' status and other unaccepted statuses", () => {
	assert.strictEqual(
		serializeOccupancyEvent("A-01", "reserved", 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", "Reserved", 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", "RESERVED", 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", "available", 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", "pending", 1700000000000),
		null,
	);
	assert.strictEqual(serializeOccupancyEvent("A-01", "", 1700000000000), null);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", null, 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", undefined, 1700000000000),
		null,
	);
	assert.strictEqual(serializeOccupancyEvent("A-01", 123, 1700000000000), null);
});

test("returns null for bad spotId", () => {
	assert.strictEqual(serializeOccupancyEvent("", "free", 1700000000000), null);
	assert.strictEqual(
		serializeOccupancyEvent("   ", "free", 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent(null, "free", 1700000000000),
		null,
	);
	assert.strictEqual(
		serializeOccupancyEvent(undefined, "free", 1700000000000),
		null,
	);
	assert.strictEqual(serializeOccupancyEvent(123, "free", 1700000000000), null);
	assert.strictEqual(serializeOccupancyEvent({}, "free", 1700000000000), null);
	assert.strictEqual(serializeOccupancyEvent([], "free", 1700000000000), null);
	assert.strictEqual(
		serializeOccupancyEvent(true, "free", 1700000000000),
		null,
	);
});

test("returns null for negative, zero, NaN, or non-finite timestamp", () => {
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", -1), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", -1000), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", 0), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", NaN), null);
	assert.strictEqual(
		serializeOccupancyEvent("A-01", "free", "not-a-number"),
		null,
	);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", Infinity), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", -Infinity), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", null), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", false), null);
	assert.strictEqual(serializeOccupancyEvent("A-01", "free", true), null);
});
