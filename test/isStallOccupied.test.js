const test = require("node:test");
const assert = require("node:assert/strict");
const { isStallOccupied } = require("../src/lib/isStallOccupied.js");

test("occupied true flag", () => assert.equal(isStallOccupied({ occupied: true }), true));
test("status occupied", () => assert.equal(isStallOccupied({ status: "Occupied" }), true));
test("state occupied", () => assert.equal(isStallOccupied({ state: "occupied" }), true));
test("free/unknown", () => {
	assert.equal(isStallOccupied({ occupied: false, status: "free" }), false);
	assert.equal(isStallOccupied({ status: "unknown" }), false);
});
test("empty object", () => assert.equal(isStallOccupied({}), false));
test("null/undefined/numbers", () => {
	assert.equal(isStallOccupied(null), false);
	assert.equal(isStallOccupied(undefined), false);
	assert.equal(isStallOccupied(1), false);
});
