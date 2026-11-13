const test = require("node:test");
const assert = require("node:assert/strict");
const isOlderThanSeconds = require("../src/lib/isOlderThanSeconds");

const now = 1_700_000_000_000;

test("a timestamp 10 seconds old is fresh within a 60-second limit", () => {
	assert.equal(isOlderThanSeconds(now - 10_000, 60, now), false);
});

test("a timestamp 61 seconds old is stale with a 60-second limit", () => {
	assert.equal(isOlderThanSeconds(now - 61_000, 60, now), true);
});

test("a timestamp exactly at the age limit is fresh", () => {
	assert.equal(isOlderThanSeconds(now - 60_000, 60, now), false);
});

test("a future timestamp is stale", () => {
	assert.equal(isOlderThanSeconds(now + 1, 60, now), true);
});

test("missing and invalid timestamps are stale", () => {
	for (const ts of [null, undefined, NaN, "abc", "1700000000000"]) {
		assert.equal(isOlderThanSeconds(ts, 60, now), true);
	}
});

test("zero, negative, and non-finite age limits are stale", () => {
	for (const maxAgeSec of [0, -1, NaN]) {
		assert.equal(isOlderThanSeconds(now - 1_000, maxAgeSec, now), true);
	}
});

test("the default now value uses Date.now()", () => {
	assert.equal(isOlderThanSeconds(Date.now() - 1_000, 60), false);
});
