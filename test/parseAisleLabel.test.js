const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAisleLabel } = require("../src/lib/parseAisleLabel");

test("parses the long Floor / Zone / Row format", () => {
	assert.deepStrictEqual(parseAisleLabel("Floor -1 / Blue Zone / Row C"), {
		level: -1,
		zone: "Blue",
		row: "C",
	});
});

test("parses the long Level format with a lowercase row", () => {
	assert.deepStrictEqual(parseAisleLabel("Level 2 / Red / Row a"), {
		level: 2,
		zone: "Red",
		row: "A",
	});
});

test("parses the short format", () => {
	assert.deepStrictEqual(parseAisleLabel("-1/B/C"), {
		level: -1,
		zone: "B",
		row: "C",
	});
});

test("parses a trailing-minus level as negative", () => {
	assert.deepStrictEqual(parseAisleLabel("1-/B/a"), {
		level: -1,
		zone: "B",
		row: "A",
	});
});

test("parses a positive level", () => {
	assert.deepStrictEqual(parseAisleLabel("2/Red/D"), {
		level: 2,
		zone: "Red",
		row: "D",
	});
});

test("trims extra whitespace around every part", () => {
	const label = "  Floor  3 /  Green Zone  /  Row  b ";
	assert.deepStrictEqual(parseAisleLabel(label), {
		level: 3,
		zone: "Green",
		row: "B",
	});
});

test("parses level zero", () => {
	assert.deepStrictEqual(parseAisleLabel("0/B/C"), {
		level: 0,
		zone: "B",
		row: "C",
	});
});

test("returns null for partial formats", () => {
	assert.strictEqual(parseAisleLabel("-1/B"), null);
	assert.strictEqual(parseAisleLabel("Floor -1"), null);
});

test("returns null for empty or whitespace-only labels", () => {
	assert.strictEqual(parseAisleLabel(""), null);
	assert.strictEqual(parseAisleLabel("   "), null);
});

test("returns null for non-string labels", () => {
	assert.strictEqual(parseAisleLabel(null), null);
	assert.strictEqual(parseAisleLabel(undefined), null);
	assert.strictEqual(parseAisleLabel(42), null);
	assert.strictEqual(parseAisleLabel(-1), null);
});

test("returns null for invalid rows", () => {
	assert.strictEqual(parseAisleLabel("-1/B/CC"), null);
	assert.strictEqual(parseAisleLabel("-1/B/1"), null);
});

test("returns null when the level or zone is invalid", () => {
	assert.strictEqual(parseAisleLabel("1.5/B/C"), null);
	assert.strictEqual(parseAisleLabel("-1//C"), null);
	assert.strictEqual(parseAisleLabel("-1/B/C/D"), null);
});
