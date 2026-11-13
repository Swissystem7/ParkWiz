const test = require("node:test");
const assert = require("node:assert/strict");
const { formatTurnInstruction } = require("../src/lib/formatTurnInstruction.js");

test("small angles straight", () => {
	assert.equal(formatTurnInstruction(10).action, "straight");
	assert.equal(formatTurnInstruction(-20).action, "straight");
});
test("right and left", () => {
	assert.equal(formatTurnInstruction(45).action, "right");
	assert.equal(formatTurnInstruction(90).textHe, "פנה ימינה");
	assert.equal(formatTurnInstruction(-45).action, "left");
	assert.equal(formatTurnInstruction(-90).textHe, "פנה שמאלה");
});
test("u-turn", () => {
	assert.equal(formatTurnInstruction(150).action, "u-turn");
	assert.equal(formatTurnInstruction(-180).action, "u-turn");
});
test("custom threshold", () => {
	assert.equal(formatTurnInstruction(30, 40).action, "straight");
	assert.equal(formatTurnInstruction(30, 25).action, "right");
});
test("invalid defaults straight", () => {
	assert.equal(formatTurnInstruction(NaN).action, "straight");
	assert.equal(formatTurnInstruction("x").action, "straight");
	assert.equal(formatTurnInstruction(null).action, "straight");
});
test("hebrew present", () => assert.match(formatTurnInstruction(0).textHe, /ישר/));
