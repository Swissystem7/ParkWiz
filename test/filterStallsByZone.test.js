const test = require("node:test");
const assert = require("node:assert/strict");
const { filterStallsByZone } = require("../src/lib/filterStallsByZone.js");

const stalls = [
	{ id: "A-01", zone: "A", color: "blue" },
	{ id: "B-02", zone: "B", color: "green" },
	{ id: "A-03", zone: "A", color: "red" },
	{ id: "C-01", zone: "C", color: "yellow" },
];

test("area A", () => {
	const r = filterStallsByZone(stalls, "A");
	assert.equal(r.length, 2);
	assert.ok(r.every((s) => s.id.startsWith("A")));
});
test("area B", () => assert.equal(filterStallsByZone(stalls, "b").length, 1));
test("english color", () => assert.equal(filterStallsByZone(stalls, "blue").length, 1));
test("hebrew color", () => assert.equal(filterStallsByZone(stalls, "ירוק").length, 1));
test("nonexistent", () => assert.deepEqual(filterStallsByZone(stalls, "Z"), []));
test("invalid inputs", () => {
	assert.deepEqual(filterStallsByZone(null, "A"), []);
	assert.deepEqual(filterStallsByZone(stalls, ""), []);
	assert.deepEqual(filterStallsByZone([], "A"), []);
});
