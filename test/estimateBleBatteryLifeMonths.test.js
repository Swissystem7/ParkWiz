const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateBleBatteryLifeMonths } = require("../src/lib/estimateBleBatteryLifeMonths.js");

test("CR2477 1000mAh/150ms above 24 months", () => {
	const r = estimateBleBatteryLifeMonths(1000, 150);
	assert.ok(r.isAboveTwoYears);
	assert.ok(r.estimatedMonths >= 24);
});
test("CR2032 220mAh under 24 months", () => {
	const r = estimateBleBatteryLifeMonths(220, 150);
	assert.equal(r.isAboveTwoYears, false);
	assert.ok(r.estimatedMonths < 24);
});
test("interval effect", () => {
	const a = estimateBleBatteryLifeMonths(1000, 100);
	const b = estimateBleBatteryLifeMonths(1000, 500);
	assert.ok(b.estimatedMonths > a.estimatedMonths);
});
test("invalid", () => {
	assert.equal(estimateBleBatteryLifeMonths(-1), null);
	assert.equal(estimateBleBatteryLifeMonths(NaN), null);
	assert.equal(estimateBleBatteryLifeMonths(1000, 0), null);
});
