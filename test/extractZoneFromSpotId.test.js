const test = require("node:test");
const assert = require("node:assert/strict");
const { extractZoneFromSpotId } = require("../src/lib/extractZoneFromSpotId");

test("extracts zone 'A' from 'A-01'", () => {
	assert.strictEqual(extractZoneFromSpotId("A-01"), "A");
});

test("extracts zone 'B' from 'B-15'", () => {
	assert.strictEqual(extractZoneFromSpotId("B-15"), "B");
});

test("extracts zone 'C' from 'C-02'", () => {
	assert.strictEqual(extractZoneFromSpotId("C-02"), "C");
});

test("extracts zone 'A' from lowercase 'a1'", () => {
	assert.strictEqual(extractZoneFromSpotId("a1"), "A");
});

test("extracts zone 'A' from lowercase 'a12'", () => {
	assert.strictEqual(extractZoneFromSpotId("a12"), "A");
});

test("extracts zone 'B' from padded ' b_05 '", () => {
	assert.strictEqual(extractZoneFromSpotId(" b_05 "), "B");
});

test("returns null for empty string", () => {
	assert.strictEqual(extractZoneFromSpotId(""), null);
});

test("returns null for whitespace-only string", () => {
	assert.strictEqual(extractZoneFromSpotId("   "), null);
});

test("returns null for digits-only '105'", () => {
	assert.strictEqual(extractZoneFromSpotId("105"), null);
});

test("returns null for leading special character '#A1'", () => {
	assert.strictEqual(extractZoneFromSpotId("#A1"), null);
});

test("returns null for non-string inputs (null, undefined, 42, {})", () => {
	assert.strictEqual(extractZoneFromSpotId(null), null);
	assert.strictEqual(extractZoneFromSpotId(undefined), null);
	assert.strictEqual(extractZoneFromSpotId(42), null);
	assert.strictEqual(extractZoneFromSpotId({}), null);
});
