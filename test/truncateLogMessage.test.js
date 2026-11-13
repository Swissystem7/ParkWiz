const test = require("node:test");
const assert = require("node:assert/strict");
const { truncateLogMessage } = require("../src/lib/truncateLogMessage.js");

test("short unchanged", () => assert.equal(truncateLogMessage("hi"), "hi"));
test("long truncates with ellipsis", () => {
	const r = truncateLogMessage("x".repeat(200), 20);
	assert.equal(r.length, 20);
	assert.ok(r.endsWith("..."));
});
test("exact length", () => assert.equal(truncateLogMessage("abcd", 4), "abcd"));
test("maxLen <= 3", () => assert.equal(truncateLogMessage("abcdef", 2), "ab"));
test("empty/nonstring", () => {
	assert.equal(truncateLogMessage(""), "");
	assert.equal(truncateLogMessage(null), "");
	assert.equal(truncateLogMessage(1), "");
});
