const test = require("node:test");
const assert = require("node:assert/strict");
const { isStalenessCritical } = require("../src/lib/isStalenessCritical.js");

test("30s nominal", () => {
	const r = isStalenessCritical(30);
	assert.equal(r.isCritical, false);
	assert.equal(r.alarmLevel, "nominal");
});
test("90s stale", () => {
	assert.equal(isStalenessCritical(90).alarmLevel, "stale");
	assert.equal(isStalenessCritical(90).isCritical, false);
});
test("200s critical", () => {
	assert.equal(isStalenessCritical(200).isCritical, true);
	assert.equal(isStalenessCritical(200).alarmLevel, "critical");
});
test("boundaries 60 and 180", () => {
	assert.equal(isStalenessCritical(60).alarmLevel, "nominal");
	assert.equal(isStalenessCritical(180).alarmLevel, "stale");
	assert.equal(isStalenessCritical(181).alarmLevel, "critical");
});
test("invalid fail-safe critical", () => {
	assert.equal(isStalenessCritical(-1).isCritical, true);
	assert.equal(isStalenessCritical(NaN).isCritical, true);
	assert.equal(isStalenessCritical("x").isCritical, true);
});
test("age rounded", () => assert.equal(isStalenessCritical(30.6).ageSec, 31));
