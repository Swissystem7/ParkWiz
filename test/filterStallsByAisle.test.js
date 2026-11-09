const test = require("node:test");
const assert = require("node:assert/strict");
const { filterStallsByAisle } = require("../src/lib/filterStallsByAisle");

const createPilotStalls = () => [
	{ id: "A-01", aisle: "A", status: "free" },
	{ id: "A-02", aisle: "a", status: "occupied" },
	{ id: "A-03", status: "free" },
	{ id: "104", aisle: "A", status: "occupied" },
	{ id: "a-05", aisle: " A ", status: "free" },
	{ id: "B-01", aisle: "B", status: "free" },
	{ id: "B-02", aisle: "b", status: "occupied" },
	{ id: "B-03", status: "free" },
	{ id: "109", aisle: "B", status: "occupied" },
	{ id: "b-05", status: "free" },
	{ id: "C-01", aisle: "C", status: "free" },
	{ id: "C-02", aisle: "c", status: "occupied" },
	{ id: "C-03", status: "free" },
	{ id: "114", aisle: "C", status: "occupied" },
	{ id: "c-05", status: "free" },
];

test("pilot list has exactly 15 stalls", () => {
	const stalls = createPilotStalls();
	assert.strictEqual(stalls.length, 15);
});

test("filters aisle A from 15-stall pilot list", () => {
	const stalls = createPilotStalls();
	const expected = stalls.slice(0, 5);

	const result = filterStallsByAisle(stalls, "A");
	assert.strictEqual(result.length, 5);
	assert.deepStrictEqual(result, expected);
});

test("filters aisle B from 15-stall pilot list", () => {
	const stalls = createPilotStalls();
	const expected = stalls.slice(5, 10);

	const result = filterStallsByAisle(stalls, "B");
	assert.strictEqual(result.length, 5);
	assert.deepStrictEqual(result, expected);
});

test("lowercase 'a' matches aisle A", () => {
	const stalls = createPilotStalls();
	const expected = stalls.slice(0, 5);

	const result = filterStallsByAisle(stalls, "a");
	assert.deepStrictEqual(result, expected);
});

test("lowercase 'b' with whitespace matches aisle B", () => {
	const stalls = createPilotStalls();
	const expected = stalls.slice(5, 10);

	const result = filterStallsByAisle(stalls, "  b  ");
	assert.deepStrictEqual(result, expected);
});

test("missing aisle returns empty array []", () => {
	const stalls = createPilotStalls();

	assert.deepStrictEqual(filterStallsByAisle(stalls, "Z"), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, "NonExistent"), []);
});

test("empty stalls array returns []", () => {
	assert.deepStrictEqual(filterStallsByAisle([], "A"), []);
});

test("non-array stalls returns []", () => {
	assert.deepStrictEqual(filterStallsByAisle(null, "A"), []);
	assert.deepStrictEqual(filterStallsByAisle(undefined, "A"), []);
	assert.deepStrictEqual(filterStallsByAisle({}, "A"), []);
	assert.deepStrictEqual(filterStallsByAisle("A-01", "A"), []);
	assert.deepStrictEqual(filterStallsByAisle(123, "A"), []);
	assert.deepStrictEqual(filterStallsByAisle(true, "A"), []);
});

test("invalid or empty targetAisle returns []", () => {
	const stalls = createPilotStalls();

	assert.deepStrictEqual(filterStallsByAisle(stalls, ""), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, "   "), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, null), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, undefined), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, 123), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, {}), []);
	assert.deepStrictEqual(filterStallsByAisle(stalls, []), []);
});

test("does not mutate input array or stall objects, returns a new array", () => {
	const stalls = createPilotStalls();
	const originalStalls = stalls.map((s) => ({ ...s }));

	const result = filterStallsByAisle(stalls, "A");

	assert.notStrictEqual(result, stalls);
	assert.deepStrictEqual(stalls, originalStalls);
	assert.strictEqual(result[0], stalls[0]);
});

test("safely skips malformed items in stalls array", () => {
	const validStall = { id: "A-01", aisle: "A" };
	const mixed = [
		null,
		undefined,
		42,
		"invalid",
		[],
		{},
		{ id: null },
		{ aisle: null },
		{ id: 123 },
		validStall,
	];

	assert.deepStrictEqual(filterStallsByAisle(mixed, "A"), [validStall]);
});
