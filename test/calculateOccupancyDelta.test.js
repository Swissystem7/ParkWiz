const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateOccupancyDelta } = require("../src/lib/calculateOccupancyDelta.js");

test("increase plural and singular", () => {
	assert.deepEqual(calculateOccupancyDelta(5, 8), {
		delta: 3, direction: "increase", text: "עלייה של 3 רכבים",
	});
	assert.deepEqual(calculateOccupancyDelta(5, 6), {
		delta: 1, direction: "increase", text: "עלייה של רכב אחד",
	});
});
test("decrease plural and singular", () => {
	assert.deepEqual(calculateOccupancyDelta(8, 6), {
		delta: -2, direction: "decrease", text: "ירידה של 2 רכבים",
	});
	assert.deepEqual(calculateOccupancyDelta(8, 7), {
		delta: -1, direction: "decrease", text: "ירידה של רכב אחד",
	});
});
test("unchanged", () => {
	assert.deepEqual(calculateOccupancyDelta(4, 4), {
		delta: 0, direction: "unchanged", text: "ללא שינוי",
	});
});
test("unsafe inputs", () => {
	const safe = { delta: 0, direction: "unchanged", text: "ללא שינוי" };
	assert.deepEqual(calculateOccupancyDelta(-1, 2), safe);
	assert.deepEqual(calculateOccupancyDelta(1, NaN), safe);
	assert.deepEqual(calculateOccupancyDelta("1", 2), safe);
	assert.deepEqual(calculateOccupancyDelta(1.5, 2), safe);
});
