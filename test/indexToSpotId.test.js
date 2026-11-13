const test = require("node:test");
const assert = require("node:assert/strict");
const { indexToSpotId } = require("../src/lib/indexToSpotId.js");

test("happy paths", () => {
	assert.equal(indexToSpotId(0, "A"), "A-01");
	assert.equal(indexToSpotId(3, "B"), "B-04");
	assert.equal(indexToSpotId(14, "a"), "A-15");
});
test("invalid index", () => {
	assert.equal(indexToSpotId(-1, "A"), null);
	assert.equal(indexToSpotId(2.5, "A"), null);
	assert.equal(indexToSpotId(99, "A"), null);
});
test("invalid zone", () => {
	assert.equal(indexToSpotId(0, ""), null);
	assert.equal(indexToSpotId(0, "12"), null);
	assert.equal(indexToSpotId(0, "AB"), null);
	assert.equal(indexToSpotId(0, null), null);
	assert.equal(indexToSpotId(0, undefined), null);
});
test("default zone A", () => {
	assert.equal(indexToSpotId(0), "A-01");
});
