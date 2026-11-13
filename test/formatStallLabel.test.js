const test = require("node:test");
const assert = require("node:assert/strict");
const { formatStallLabel } = require("../src/lib/formatStallLabel.js");

test("with nickname", () => assert.equal(formatStallLabel("a-01", "שער"), "A-01 (שער)"));
test("no nickname", () => assert.equal(formatStallLabel("b-02"), "B-02"));
test("blank name", () => assert.equal(formatStallLabel("c-03", "  "), "C-03"));
test("uppercase", () => assert.equal(formatStallLabel("  d-04  "), "D-04"));
test("invalid id", () => {
	assert.equal(formatStallLabel(""), "");
	assert.equal(formatStallLabel(null), "");
	assert.equal(formatStallLabel(undefined), "");
});
