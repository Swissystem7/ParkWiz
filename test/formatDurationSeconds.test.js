const test = require("node:test");
const assert = require("node:assert/strict");
const { formatDurationSeconds } = require("../src/lib/formatDurationSeconds");
test("seconds under a minute", () => {
	assert.equal(formatDurationSeconds(0), "0 שניות");
	assert.equal(formatDurationSeconds(15), "15 שניות");
	assert.equal(formatDurationSeconds(59), "59 שניות");
});
test("minute and above", () => {
	assert.equal(formatDurationSeconds(60), "1:00 דקות");
	assert.equal(formatDurationSeconds(125), "2:05 דקות");
});
test("invalid -> 0 seconds", () => {
	assert.equal(formatDurationSeconds(-1), "0 שניות");
	assert.equal(formatDurationSeconds(null), "0 שניות");
	assert.equal(formatDurationSeconds(NaN), "0 שניות");
});
