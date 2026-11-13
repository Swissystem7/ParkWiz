const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSpotId } = require("../src/lib/normalizeSpotId");

test("normalizes a lowercase hyphenated spot ID", () => {
	assert.strictEqual(normalizeSpotId("a-1"), "A-01");
});

test("normalizes an unseparated spot ID", () => {
	assert.strictEqual(normalizeSpotId("A01"), "A-01");
});

test("trims and normalizes an underscored spot ID", () => {
	assert.strictEqual(normalizeSpotId(" a_2 "), "A-02");
});

test("normalizes a two-digit unseparated spot ID", () => {
	assert.strictEqual(normalizeSpotId("c12"), "C-12");
});

test("normalizes a hyphenated single-digit spot ID", () => {
	assert.strictEqual(normalizeSpotId("B-5"), "B-05");
});

test("returns null for empty or whitespace-only IDs", () => {
	assert.strictEqual(normalizeSpotId(""), null);
	assert.strictEqual(normalizeSpotId("   "), null);
});

test("returns null for non-string IDs", () => {
	assert.strictEqual(normalizeSpotId(null), null);
	assert.strictEqual(normalizeSpotId(undefined), null);
	assert.strictEqual(normalizeSpotId(12), null);
	assert.strictEqual(normalizeSpotId({}), null);
});

test("returns null for IDs without a valid letter and number", () => {
	assert.strictEqual(normalizeSpotId("12"), null);
	assert.strictEqual(normalizeSpotId("A"), null);
});

test("returns null for out-of-range cell numbers", () => {
	assert.strictEqual(normalizeSpotId("A-0"), null);
	assert.strictEqual(normalizeSpotId("A-100"), null);
});

test("returns null for malformed or special-character IDs", () => {
	assert.strictEqual(normalizeSpotId("AB-1"), null);
	assert.strictEqual(normalizeSpotId("A#1"), null);
	assert.strictEqual(normalizeSpotId("A--1"), null);
});
