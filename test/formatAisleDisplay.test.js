const test = require("node:test");
const assert = require("node:assert/strict");
const { formatAisleDisplay } = require("../src/lib/formatAisleDisplay");

test("formats underground level with Blue zone and multiple free spots", () => {
	assert.strictEqual(
		formatAisleDisplay(-1, "Blue", 4),
		"מפלס 1- | אזור כחול: 4 פנויות",
	);
});

test("formats ground level with Green zone and single free spot", () => {
	assert.strictEqual(
		formatAisleDisplay(0, "Green", 1),
		"קומת קרקע | אזור ירוק: חניה אחת פנויה",
	);
});

test("formats positive level with standard zone and full lot", () => {
	assert.strictEqual(formatAisleDisplay(2, "C", 0), "מפלס 2 | אזור C: מלא");
});

test("handles negative, NaN, Infinity, and string freeCount as full", () => {
	assert.strictEqual(formatAisleDisplay(1, "A", -5), "מפלס 1 | אזור A: מלא");
	assert.strictEqual(
		formatAisleDisplay(1, "A", Number.NaN),
		"מפלס 1 | אזור A: מלא",
	);
	assert.strictEqual(
		formatAisleDisplay(1, "A", Number.POSITIVE_INFINITY),
		"מפלס 1 | אזור A: מלא",
	);
	assert.strictEqual(
		formatAisleDisplay(1, "A", Number.NEGATIVE_INFINITY),
		"מפלס 1 | אזור A: מלא",
	);
	assert.strictEqual(formatAisleDisplay(1, "A", "4"), "מפלס 1 | אזור A: מלא");
	assert.strictEqual(
		formatAisleDisplay(1, "A", undefined),
		"מפלס 1 | אזור A: מלא",
	);
	assert.strictEqual(formatAisleDisplay(1, "A", null), "מפלס 1 | אזור A: מלא");
});

test("handles case-insensitive and trimmed zone names for Blue and Green", () => {
	assert.strictEqual(
		formatAisleDisplay(1, "  blue  ", 3),
		"מפלס 1 | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(1, "bLuE", 1),
		"מפלס 1 | אזור כחול: חניה אחת פנויה",
	);
	assert.strictEqual(
		formatAisleDisplay(1, " GREEN ", 2),
		"מפלס 1 | אזור ירוק: 2 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(1, "green", 5),
		"מפלס 1 | אזור ירוק: 5 פנויות",
	);
});

test("handles invalid and non-integer level values", () => {
	assert.strictEqual(
		formatAisleDisplay(1.5, "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(-0.5, "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(Number.NaN, "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(Number.POSITIVE_INFINITY, "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay("1", "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(null, "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(undefined, "Blue", 3),
		"מפלס לא ידוע | אזור כחול: 3 פנויות",
	);
});

test("handles missing and invalid zone values", () => {
	assert.strictEqual(formatAisleDisplay(1, "", 3), "מפלס 1 | אזור ?: 3 פנויות");
	assert.strictEqual(
		formatAisleDisplay(1, "   ", 3),
		"מפלס 1 | אזור ?: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(1, null, 3),
		"מפלס 1 | אזור ?: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(1, undefined, 3),
		"מפלס 1 | אזור ?: 3 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(1, 123, 3),
		"מפלס 1 | אזור ?: 3 פנויות",
	);
});

test("floors fractional freeCount values", () => {
	assert.strictEqual(
		formatAisleDisplay(1, "Zone 3", 4.9),
		"מפלס 1 | אזור Zone 3: 4 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(1, "Zone 3", 1.8),
		"מפלס 1 | אזור Zone 3: חניה אחת פנויה",
	);
	assert.strictEqual(
		formatAisleDisplay(1, "Zone 3", 0.7),
		"מפלס 1 | אזור Zone 3: מלא",
	);
});

test("preserves and trims other arbitrary zone strings", () => {
	assert.strictEqual(
		formatAisleDisplay(3, "  East Wing  ", 2),
		"מפלס 3 | אזור East Wing: 2 פנויות",
	);
	assert.strictEqual(
		formatAisleDisplay(3, "North-2", 1),
		"מפלס 3 | אזור North-2: חניה אחת פנויה",
	);
});

test("formats deeper underground levels correctly", () => {
	assert.strictEqual(
		formatAisleDisplay(-3, "B", 10),
		"מפלס 3- | אזור B: 10 פנויות",
	);
});
