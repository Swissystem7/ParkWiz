const test = require("node:test");
const assert = require("node:assert/strict");
const {
	formatDriverGuidance,
	ZONE_TRANSLATIONS,
} = require("../src/lib/formatDriverGuidance");

test("formats negative levels -1 and -2", () => {
	assert.strictEqual(
		formatDriverGuidance("A-04", -1, "כחול"),
		"מפלס 1-, אזור כחול, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("B-12", -2, "Red"),
		"מפלס 2-, אזור אדום, חניה B-12",
	);
});

test("formats ground floor level 0", () => {
	assert.strictEqual(
		formatDriverGuidance("G-01", 0, "Green"),
		"קומת קרקע, אזור ירוק, חניה G-01",
	);
});

test("formats above-ground level 3", () => {
	assert.strictEqual(
		formatDriverGuidance("C-15", 3, "Yellow"),
		"מפלס 3, אזור צהוב, חניה C-15",
	);
});

test("uses default arguments when level and zone are omitted", () => {
	assert.strictEqual(
		formatDriverGuidance("A-04"),
		"מפלס 1-, אזור כחול, חניה A-04",
	);
});

test("omits zone when empty, whitespace, or null", () => {
	assert.strictEqual(
		formatDriverGuidance("A-04", -1, ""),
		"מפלס 1-, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("A-04", 0, "   "),
		"קומת קרקע, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("A-04", 2, null),
		"מפלס 2, חניה A-04",
	);
});

test("omits level when level is not an integer", () => {
	assert.strictEqual(
		formatDriverGuidance("A-04", null, "Blue"),
		"אזור כחול, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("A-04", 1.5, "Blue"),
		"אזור כחול, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("A-04", "1", "Blue"),
		"אזור כחול, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("A-04", Number.NaN, "Blue"),
		"אזור כחול, חניה A-04",
	);
});

test("returns default string when spotId is missing, empty, whitespace, null, or a number", () => {
	const defaultMessage = "עקוב אחר שילוט החניון הפנוי";
	assert.strictEqual(formatDriverGuidance(), defaultMessage);
	assert.strictEqual(formatDriverGuidance(""), defaultMessage);
	assert.strictEqual(formatDriverGuidance("   "), defaultMessage);
	assert.strictEqual(formatDriverGuidance(null), defaultMessage);
	assert.strictEqual(formatDriverGuidance(123), defaultMessage);
	assert.strictEqual(formatDriverGuidance(undefined), defaultMessage);
});

test("trims whitespace from spotId and zone", () => {
	assert.strictEqual(
		formatDriverGuidance("  A-04  ", 1, "  Purple  "),
		"מפלס 1, אזור סגול, חניה A-04",
	);
});

test("preserves zone text as given without translating", () => {
	assert.strictEqual(
		formatDriverGuidance("D-08", -1, "מזרח"),
		"מפלס 1-, אזור מזרח, חניה D-08",
	);
	assert.strictEqual(
		formatDriverGuidance("D-08", -1, "West-Wing"),
		"מפלס 1-, אזור West-Wing, חניה D-08",
	);
});

test("handles case where both level and zone are omitted", () => {
	assert.strictEqual(formatDriverGuidance("E-99", null, ""), "חניה E-99");
});

test("translates zone colors case-insensitively and with trimming", () => {
	assert.strictEqual(
		formatDriverGuidance("A-01", 1, "Green"),
		"מפלס 1, אזור ירוק, חניה A-01",
	);
	assert.strictEqual(
		formatDriverGuidance("A-02", 1, "RED"),
		"מפלס 1, אזור אדום, חניה A-02",
	);
	assert.strictEqual(
		formatDriverGuidance("A-03", 1, " yellow "),
		"מפלס 1, אזור צהוב, חניה A-03",
	);
	assert.strictEqual(
		formatDriverGuidance("A-04", 1, "North"),
		"מפלס 1, אזור North, חניה A-04",
	);
	assert.strictEqual(
		formatDriverGuidance("A-05", 1, "כחול"),
		"מפלס 1, אזור כחול, חניה A-05",
	);
});

test("exports frozen ZONE_TRANSLATIONS dictionary", () => {
	assert.strictEqual(Object.isFrozen(ZONE_TRANSLATIONS), true);
	assert.deepStrictEqual(ZONE_TRANSLATIONS, {
		blue: "כחול",
		green: "ירוק",
		red: "אדום",
		yellow: "צהוב",
		orange: "כתום",
		purple: "סגול",
	});
});
