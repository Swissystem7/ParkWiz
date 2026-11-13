const test = require("node:test");
const assert = require("node:assert/strict");
const { rssiToApproxDistance } = require("../src/lib/rssiToApproxDistance");

test("returns 1.0 m when RSSI equals txPower (-59 dBm)", () => {
	assert.strictEqual(rssiToApproxDistance(-59), 1);
});

test("computes expected distance for typical intermediate signals (-70 dBm and -85 dBm)", () => {
	const expected70 = Math.round(10 ** ((-59 - -70) / (10 * 3.4)) * 100) / 100;
	assert.strictEqual(expected70, 2.11);
	assert.strictEqual(rssiToApproxDistance(-70), expected70);

	const expected85 = Math.round(10 ** ((-59 - -85) / (10 * 3.4)) * 100) / 100;
	assert.strictEqual(expected85, 5.82);
	assert.strictEqual(rssiToApproxDistance(-85), expected85);
});

test("clamps very strong signal to 0.1 m", () => {
	assert.strictEqual(rssiToApproxDistance(-10), 0.1);
	assert.strictEqual(rssiToApproxDistance(-20), 0.1);
	assert.strictEqual(rssiToApproxDistance(-5), 0.1);
});

test("clamps very weak signal to 50.0 m", () => {
	assert.strictEqual(rssiToApproxDistance(-200), 50);
	assert.strictEqual(rssiToApproxDistance(-150), 50);
});

test("returns null for rssi that is zero or positive", () => {
	assert.strictEqual(rssiToApproxDistance(0), null);
	assert.strictEqual(rssiToApproxDistance(1), null);
	assert.strictEqual(rssiToApproxDistance(50), null);
});

test("returns null for non-finite or non-numeric rssi values", () => {
	assert.strictEqual(rssiToApproxDistance(Number.NaN), null);
	assert.strictEqual(rssiToApproxDistance(null), null);
	assert.strictEqual(rssiToApproxDistance(undefined), null);
	assert.strictEqual(rssiToApproxDistance("-59"), null);
	assert.strictEqual(rssiToApproxDistance("invalid"), null);
	assert.strictEqual(rssiToApproxDistance(Number.POSITIVE_INFINITY), null);
	assert.strictEqual(rssiToApproxDistance(Number.NEGATIVE_INFINITY), null);
	assert.strictEqual(rssiToApproxDistance({}), null);
	assert.strictEqual(rssiToApproxDistance([]), null);
});

test("respects custom txPower and n parameters according to formula", () => {
	const customTxPower = -65;
	const customN = 2.0;
	const customRssi = -75;
	const expected =
		Math.round(10 ** ((customTxPower - customRssi) / (10 * customN)) * 100) /
		100;
	assert.strictEqual(expected, 3.16);
	assert.strictEqual(
		rssiToApproxDistance(customRssi, customTxPower, customN),
		expected,
	);
});

test("returns null for invalid n values (zero, negative, or non-finite)", () => {
	assert.strictEqual(rssiToApproxDistance(-70, -59, 0), null);
	assert.strictEqual(rssiToApproxDistance(-70, -59, -1), null);
	assert.strictEqual(rssiToApproxDistance(-70, -59, -3.4), null);
	assert.strictEqual(rssiToApproxDistance(-70, -59, Number.NaN), null);
	assert.strictEqual(
		rssiToApproxDistance(-70, -59, Number.POSITIVE_INFINITY),
		null,
	);
	assert.strictEqual(rssiToApproxDistance(-70, -59, null), null);
	assert.strictEqual(rssiToApproxDistance(-70, -59, "3.4"), null);
});

test("returns null for invalid txPower values (non-finite)", () => {
	assert.strictEqual(rssiToApproxDistance(-70, Number.NaN, 3.4), null);
	assert.strictEqual(
		rssiToApproxDistance(-70, Number.POSITIVE_INFINITY, 3.4),
		null,
	);
	assert.strictEqual(
		rssiToApproxDistance(-70, Number.NEGATIVE_INFINITY, 3.4),
		null,
	);
	assert.strictEqual(rssiToApproxDistance(-70, null, 3.4), null);
	assert.strictEqual(rssiToApproxDistance(-70, "-59", 3.4), null);
});
