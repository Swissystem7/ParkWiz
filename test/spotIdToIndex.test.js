const test = require("node:test");
const assert = require("node:assert/strict");
const { spotIdToIndex } = require("../src/lib/spotIdToIndex");
test("A-01 -> 0", () => assert.equal(spotIdToIndex("A-01"), 0));
test("A-04 -> 3", () => assert.equal(spotIdToIndex("A-04"), 3));
test("B-15 -> 14", () => assert.equal(spotIdToIndex("B-15"), 14));
test("A01 without dash", () => assert.equal(spotIdToIndex("A01"), 0));
test("invalid -> -1", () => {
	assert.equal(spotIdToIndex(""), -1);
	assert.equal(spotIdToIndex("   "), -1);
	assert.equal(spotIdToIndex("ABC"), -1);
	assert.equal(spotIdToIndex("12"), -1);
	assert.equal(spotIdToIndex(null), -1);
	assert.equal(spotIdToIndex("A-00"), -1);
});
