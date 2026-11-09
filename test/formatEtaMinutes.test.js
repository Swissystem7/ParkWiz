const test = require("node:test");
const assert = require("node:assert/strict");
const { formatEtaMinutes } = require("../src/lib/formatEtaMinutes");

test("formats 20 m at default speed as '< דקה'", () => {
	assert.strictEqual(formatEtaMinutes(20), "< דקה");
});

test("formats 0 m at default speed as '< דקה'", () => {
	assert.strictEqual(formatEtaMinutes(0), "< דקה");
});

test("formats 150 m at default speed as 'דקה אחת'", () => {
	assert.strictEqual(formatEtaMinutes(150), "דקה אחת");
});

test("formats 200 m at default speed as '2 דקות'", () => {
	assert.strictEqual(formatEtaMinutes(200), "2 דקות");
});

test("formats 400 m at default speed as '3 דקות'", () => {
	assert.strictEqual(formatEtaMinutes(400), "3 דקות");
});

test("handles custom speed calculations correctly", () => {
	assert.strictEqual(formatEtaMinutes(400, 20), "2 דקות");
	assert.strictEqual(formatEtaMinutes(1000, 5), "12 דקות");
});

test("handles 30 m boundary correctly (29 m '< דקה', 30 m 'דקה אחת')", () => {
	assert.strictEqual(formatEtaMinutes(29), "< דקה");
	assert.strictEqual(formatEtaMinutes(30), "דקה אחת");
});

test("returns null for negative distance", () => {
	assert.strictEqual(formatEtaMinutes(-1), null);
	assert.strictEqual(formatEtaMinutes(-30), null);
});

test("returns null for non-positive or negative speed values", () => {
	assert.strictEqual(formatEtaMinutes(100, 0), null);
	assert.strictEqual(formatEtaMinutes(100, -5), null);
});

test("returns null for non-finite values (NaN, Infinity)", () => {
	assert.strictEqual(formatEtaMinutes(Number.NaN), null);
	assert.strictEqual(formatEtaMinutes(Number.POSITIVE_INFINITY), null);
	assert.strictEqual(formatEtaMinutes(Number.NEGATIVE_INFINITY), null);
	assert.strictEqual(formatEtaMinutes(100, Number.NaN), null);
	assert.strictEqual(formatEtaMinutes(100, Number.POSITIVE_INFINITY), null);
	assert.strictEqual(formatEtaMinutes(100, Number.NEGATIVE_INFINITY), null);
});

test("returns null for invalid types (null, string, undefined)", () => {
	assert.strictEqual(formatEtaMinutes(null), null);
	assert.strictEqual(formatEtaMinutes("100"), null);
	assert.strictEqual(formatEtaMinutes(undefined), null);
	assert.strictEqual(formatEtaMinutes(100, null), null);
	assert.strictEqual(formatEtaMinutes(100, "10"), null);
});
