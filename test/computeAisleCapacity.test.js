const test = require("node:test");
const assert = require("node:assert/strict");
const { computeAisleCapacity } = require("../src/lib/computeAisleCapacity");

const stalls = [
	{ id: "A-01", aisle: "A", status: "free" },
	{ id: "A-02", aisle: "A", status: "occupied" },
	{ id: "A-03", aisle: "A", status: "unknown" },
	{ id: "B-01", aisle: "B", status: "free" },
	{ id: "B-02", aisle: "B", status: "occupied" },
];

test("counts free/occupied/unknown for aisle A", () => {
	const r = computeAisleCapacity(stalls, "A");
	assert.deepEqual(r, {
		aisle: "A",
		total: 3,
		free: 1,
		occupied: 1,
		unknown: 1,
		isFull: false,
	});
});

test("case-insensitive aisle", () => {
	assert.equal(computeAisleCapacity(stalls, " a ").aisle, "A");
	assert.equal(computeAisleCapacity(stalls, "a").total, 3);
});

test("isFull when no free stalls", () => {
	const full = [
		{ id: "C-01", aisle: "C", status: "occupied" },
		{ id: "C-02", aisle: "C", status: "unknown" },
	];
	const r = computeAisleCapacity(full, "C");
	assert.equal(r.isFull, true);
	assert.equal(r.free, 0);
	assert.equal(r.total, 2);
});

test("invalid input returns empty zeros with isFull true", () => {
	assert.deepEqual(computeAisleCapacity(null, "A"), {
		aisle: "A",
		total: 0,
		free: 0,
		occupied: 0,
		unknown: 0,
		isFull: true,
	});
	assert.deepEqual(computeAisleCapacity(stalls, ""), {
		aisle: "",
		total: 0,
		free: 0,
		occupied: 0,
		unknown: 0,
		isFull: true,
	});
	assert.deepEqual(computeAisleCapacity(stalls, null), {
		aisle: "",
		total: 0,
		free: 0,
		occupied: 0,
		unknown: 0,
		isFull: true,
	});
});

test("missing aisle yields total 0 isFull false (isFull needs total>0)", () => {
	const r = computeAisleCapacity(stalls, "Z");
	assert.deepEqual(r, {
		aisle: "Z",
		total: 0,
		free: 0,
		occupied: 0,
		unknown: 0,
		isFull: false,
	});
});
