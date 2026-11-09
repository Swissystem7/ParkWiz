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
