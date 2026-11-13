const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidMacAddress } = require("../src/lib/isValidMacAddress");

test("returns true for standard uppercase colon-separated MAC address", () => {
	assert.strictEqual(isValidMacAddress("AA:BB:CC:DD:EE:FF"), true);
});

test("returns true for lowercase colon-separated MAC address", () => {
	assert.strictEqual(isValidMacAddress("aa:bb:cc:dd:ee:ff"), true);
});

test("returns true for dash-separated MAC address", () => {
	assert.strictEqual(isValidMacAddress("aa-bb-cc-dd-ee-ff"), true);
	assert.strictEqual(isValidMacAddress("AA-BB-CC-DD-EE-FF"), true);
});

test("returns true when surrounding spaces are trimmed", () => {
	assert.strictEqual(isValidMacAddress("  AA:BB:CC:DD:EE:FF  "), true);
});

test("returns false for MAC address with only 5 pairs", () => {
	assert.strictEqual(isValidMacAddress("AA:BB:CC:DD:EE"), false);
});

test("returns false for MAC address with 7 pairs", () => {
	assert.strictEqual(isValidMacAddress("AA:BB:CC:DD:EE:FF:00"), false);
});

test("returns false when non-hex characters like GG are present", () => {
	assert.strictEqual(isValidMacAddress("GG:BB:CC:DD:EE:FF"), false);
	assert.strictEqual(isValidMacAddress("AA:BB:CC:DD:EE:GG"), false);
});

test("returns false for MAC address without separators", () => {
	assert.strictEqual(isValidMacAddress("AABBCCDDEEFF"), false);
});

test("returns false for empty or whitespace-only string", () => {
	assert.strictEqual(isValidMacAddress(""), false);
	assert.strictEqual(isValidMacAddress("   "), false);
});

test("returns false for non-string inputs (null, undefined, 123, object)", () => {
	assert.strictEqual(isValidMacAddress(null), false);
	assert.strictEqual(isValidMacAddress(undefined), false);
	assert.strictEqual(isValidMacAddress(123), false);
	assert.strictEqual(isValidMacAddress({}), false);
});

test("accepts mixed colon and dash separators per regex specification", () => {
	assert.strictEqual(isValidMacAddress("AA:BB-CC:DD-EE:FF"), true);
	assert.strictEqual(isValidMacAddress("aa-bb:cc-dd:ee-ff"), true);
});
