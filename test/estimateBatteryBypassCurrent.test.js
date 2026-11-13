const test = require("node:test");
const assert = require("node:assert/strict");
const {
	estimateBatteryBypassCurrent,
} = require("../src/lib/estimateBatteryBypassCurrent");

test("idle ~120mA ~0.5W", () => {
	const r = estimateBatteryBypassCurrent(false, false);
	assert.equal(r.totalMa, 120);
	assert.equal(r.totalWatts, 0.5);
	assert.equal(r.isWithinPsuLimit, true);
});

test("camera adds 450 -> 570mA", () => {
	const r = estimateBatteryBypassCurrent(true, false);
	assert.equal(r.totalMa, 570);
});

test("full camera+NPU 1770mA ~7.35W", () => {
	const r = estimateBatteryBypassCurrent(true, true);
	assert.equal(r.totalMa, 1770);
	assert.equal(r.totalWatts, 7.35);
});

test("invalid idle falls back to 120", () => {
	assert.equal(estimateBatteryBypassCurrent(false, false, NaN).totalMa, 120);
	assert.equal(estimateBatteryBypassCurrent(false, false, -1).totalMa, 120);
	assert.equal(estimateBatteryBypassCurrent(false, false, 0).totalMa, 120);
});

test("PSU limit flag", () => {
	assert.equal(
		estimateBatteryBypassCurrent(true, true, 2000).isWithinPsuLimit,
		false,
	);
	assert.equal(
		estimateBatteryBypassCurrent(false, false, 3000).isWithinPsuLimit,
		true,
	);
});
