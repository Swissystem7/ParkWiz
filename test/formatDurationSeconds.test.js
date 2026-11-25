const test = require("node:test");
const assert = require("node:assert/strict");
const { formatDurationSeconds } = require("../src/lib/formatDurationSeconds");

test("seconds under a minute", () => {
	assert.equal(formatDurationSeconds(0), "0 שניות");
	assert.equal(formatDurationSeconds(15), "15 שניות");
	assert.equal(formatDurationSeconds(59), "59 שניות");
});

test("single minute range (60-119 seconds) uses singular 'דקה'", () => {
	assert.equal(formatDurationSeconds(60), "1:00 דקה");
	assert.equal(formatDurationSeconds(119), "1:59 דקה");
});

test("multiple minutes range (120-3599 seconds) uses plural 'דקות'", () => {
	assert.equal(formatDurationSeconds(120), "2:00 דקות");
	assert.equal(formatDurationSeconds(125), "2:05 דקות");
	assert.equal(formatDurationSeconds(3599), "59:59 דקות");
});

test("hours range (3600 seconds and above) handles singular and plural hours", () => {
	assert.equal(formatDurationSeconds(3600), "1:00:00 שעה");
	assert.equal(formatDurationSeconds(3665), "1:01:05 שעה");
	assert.equal(formatDurationSeconds(7200), "2:00:00 שעות");
	assert.equal(formatDurationSeconds(7325), "2:02:05 שעות");
});

test("rounding via Math.round before split", () => {
	assert.equal(formatDurationSeconds(59.4), "59 שניות");
	assert.equal(formatDurationSeconds(59.5), "1:00 דקה");
	assert.equal(formatDurationSeconds(119.5), "2:00 דקות");
	assert.equal(formatDurationSeconds(3599.6), "1:00:00 שעה");
});

test("invalid, negative, Infinity and undefined values return 0 seconds", () => {
	assert.equal(formatDurationSeconds(-1), "0 שניות");
	assert.equal(formatDurationSeconds(null), "0 שניות");
	assert.equal(formatDurationSeconds(undefined), "0 שניות");
	assert.equal(formatDurationSeconds(NaN), "0 שניות");
	assert.equal(formatDurationSeconds(Infinity), "0 שניות");
	assert.equal(formatDurationSeconds(-Infinity), "0 שניות");
	assert.equal(formatDurationSeconds("60"), "0 שניות");
});
