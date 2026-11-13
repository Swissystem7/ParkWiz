const test = require("node:test");
const assert = require("node:assert/strict");
const { computeTurnAngleDegrees } = require("../src/lib/computeTurnAngleDegrees.js");

test("right turn positive", () => assert.equal(computeTurnAngleDegrees(0, 90), 90));
test("left turn negative", () => assert.equal(computeTurnAngleDegrees(0, 270), -90));
test("north crossing +20", () => assert.equal(computeTurnAngleDegrees(350, 10), 20));
test("north crossing -20", () => assert.equal(computeTurnAngleDegrees(10, 350), -20));
test("straight and uturn", () => {
	assert.equal(computeTurnAngleDegrees(45, 45), 0);
	assert.equal(computeTurnAngleDegrees(0, 180), 180);
});
test("invalid", () => {
	assert.equal(computeTurnAngleDegrees(NaN, 10), 0);
	assert.equal(computeTurnAngleDegrees("x", 10), 0);
});
