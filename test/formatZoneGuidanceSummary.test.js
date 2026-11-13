const test = require("node:test");
const assert = require("node:assert/strict");
const {
	formatZoneGuidanceSummary,
} = require("../src/lib/formatZoneGuidanceSummary");

test("formats and sorts multi-zone object", () => {
	const lines = formatZoneGuidanceSummary({
		B: { free: 2, total: 5 },
		A: { free: 1, total: 3 },
	});
	assert.deepEqual(lines, [
		"אזור A: 1 פנויות מתוך 3",
		"אזור B: 2 פנויות מתוך 5",
	]);
});

test("full zone uses מלא", () => {
	const lines = formatZoneGuidanceSummary({ A: { free: 0, total: 4 } });
	assert.deepEqual(lines, ["אזור A: מלא"]);
});

test("accepts nested {zones:{...}}", () => {
	const lines = formatZoneGuidanceSummary({
		zones: { Z: { free: 3, total: 3 } },
	});
	assert.deepEqual(lines, ["אזור Z: 3 פנויות מתוך 3"]);
});

test("invalid/empty -> []", () => {
	assert.deepEqual(formatZoneGuidanceSummary(null), []);
	assert.deepEqual(formatZoneGuidanceSummary({}), []);
	assert.deepEqual(formatZoneGuidanceSummary("x"), []);
	assert.deepEqual(formatZoneGuidanceSummary({ A: null }), []);
});

test("skips non-finite free/total", () => {
	assert.deepEqual(
		formatZoneGuidanceSummary({ A: { free: "x", total: 1 } }),
		[],
	);
});

test("array input -> []", () => {
	assert.deepEqual(formatZoneGuidanceSummary([]), []);
});

test("nested zones wrapper with invalid zones value -> treats as top-level keys or []", () => {
	// zones key present but not an object: fall through to treating input as zone map
	assert.deepEqual(formatZoneGuidanceSummary({ zones: null }), []);
	assert.deepEqual(formatZoneGuidanceSummary({ zones: [] }), []);
});

test("skips entry missing free/total", () => {
	assert.deepEqual(formatZoneGuidanceSummary({ A: { free: 1 } }), []);
	assert.deepEqual(formatZoneGuidanceSummary({ A: { total: 2 } }), []);
});

test("mixed valid and invalid zones keeps only valid sorted", () => {
	assert.deepEqual(
		formatZoneGuidanceSummary({
			C: { free: 0, total: 2 },
			B: { free: NaN, total: 1 },
			A: { free: 2, total: 4 },
		}),
		["אזור A: 2 פנויות מתוך 4", "אזור C: מלא"],
	);
});
