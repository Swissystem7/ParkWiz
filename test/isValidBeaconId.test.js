const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidBeaconId } = require("../src/lib/isValidBeaconId");

test("accepts 101-65 and 101-66", () => {
	assert.equal(isValidBeaconId("101-65"), true);
	assert.equal(isValidBeaconId("101-66"), true);
});

test("accepts bounds 1 and 65535", () => {
	assert.equal(isValidBeaconId("1-1"), true);
	assert.equal(isValidBeaconId("65535-65535"), true);
});

test("rejects out of range", () => {
	assert.equal(isValidBeaconId("0-1"), false);
	assert.equal(isValidBeaconId("1-0"), false);
	assert.equal(isValidBeaconId("65536-1"), false);
	assert.equal(isValidBeaconId("1-65536"), false);
});

test("rejects malformed", () => {
	assert.equal(isValidBeaconId("101"), false);
	assert.equal(isValidBeaconId("101-"), false);
	assert.equal(isValidBeaconId("a-1"), false);
	assert.equal(isValidBeaconId(""), false);
	assert.equal(isValidBeaconId(null), false);
});

test("rejects leading zeros? digits ok as Number", () => {
	assert.equal(isValidBeaconId("01-02"), true);
});
