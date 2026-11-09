const test = require("node:test");
const assert = require("node:assert/strict");
const { sortSpotsCanonical } = require("../src/lib/sortSpotsCanonical");

test("sorts shuffled spot objects into canonical order by zone and cell", () => {
	const input = [
		{ id: "B-02" },
		{ id: "A-10" },
		{ id: "A-01" },
		{ id: "B-01" },
	];
	const expected = [
		{ id: "A-01" },
		{ id: "A-10" },
		{ id: "B-01" },
		{ id: "B-02" },
	];

	assert.deepStrictEqual(sortSpotsCanonical(input), expected);
});

test("sorts numerically rather than lexicographically (A-2 before A-10)", () => {
	const input = [{ id: "A-10" }, { id: "a2" }, { id: "A-01" }, { id: "A-20" }];
	const expected = [
		{ id: "A-01" },
		{ id: "a2" },
		{ id: "A-10" },
		{ id: "A-20" },
	];

	assert.deepStrictEqual(sortSpotsCanonical(input), expected);
});

test("normalizes diverse id formats while preserving original spot objects", () => {
	const b02 = { id: "b_02", status: "free" };
	const a01 = { id: " a1 ", status: "occupied" };
	const b01 = { id: "B1", status: "unknown" };
	const a02 = { id: "A02", status: "free" };

	const input = [b02, a01, b01, a02];
	const result = sortSpotsCanonical(input);

	assert.deepStrictEqual(result, [a01, a02, b01, b02]);
	assert.strictEqual(result[0], a01);
	assert.strictEqual(result[1], a02);
	assert.strictEqual(result[2], b01);
	assert.strictEqual(result[3], b02);
});

test("places invalid ids, null items, and missing ids at the end in original relative order", () => {
	const validA = { id: "A-02" };
	const validB = { id: "A-01" };
	const nullItem = null;
	const nonObject = "string-spot";
	const invalidId = { id: "XYZ" };
	const missingId = { name: "no-id" };
	const outOfRange = { id: "A-100" };
	const nullId = { id: null };
	const arrayItem = [1, 2, 3];

	const input = [
		nullItem,
		validA,
		invalidId,
		validB,
		missingId,
		nonObject,
		outOfRange,
		nullId,
		arrayItem,
	];

	const result = sortSpotsCanonical(input);

	assert.deepStrictEqual(result, [
		validB,
		validA,
		nullItem,
		invalidId,
		missingId,
		nonObject,
		outOfRange,
		nullId,
		arrayItem,
	]);
});

test("preserves original relative order on ties (stable sort)", () => {
	const tie1 = { id: "A-01", tag: "first" };
	const tie2 = { id: "a1", tag: "second" };
	const tie3 = { id: " a_01 ", tag: "third" };
	const other = { id: "A-02", tag: "other" };

	const input = [tie1, other, tie2, tie3];
	const result = sortSpotsCanonical(input);

	assert.deepStrictEqual(result, [tie1, tie2, tie3, other]);
	assert.strictEqual(result[0], tie1);
	assert.strictEqual(result[1], tie2);
	assert.strictEqual(result[2], tie3);
	assert.strictEqual(result[3], other);
});

test("does not mutate the input array or its item objects and returns a new array reference", () => {
	const spotA = { id: "B-02", occupied: false, custom: { count: 1 } };
	const spotB = { id: "a2", occupied: true };
	const input = [spotA, spotB];
	const inputSnapshot = input.slice();
	const spotASnapshot = JSON.stringify(spotA);
	const spotBSnapshot = JSON.stringify(spotB);

	const result = sortSpotsCanonical(input);

	assert.notStrictEqual(result, input);
	assert.deepStrictEqual(input, inputSnapshot);
	assert.strictEqual(JSON.stringify(spotA), spotASnapshot);
	assert.strictEqual(JSON.stringify(spotB), spotBSnapshot);
	assert.strictEqual(result[0], spotB);
	assert.strictEqual(result[1], spotA);
});

test("returns a new empty array for empty array input", () => {
	const empty = [];
	const result = sortSpotsCanonical(empty);

	assert.deepStrictEqual(result, []);
	assert.notStrictEqual(result, empty);
});

test("returns an empty array for non-array inputs", () => {
	assert.deepStrictEqual(sortSpotsCanonical(null), []);
	assert.deepStrictEqual(sortSpotsCanonical(undefined), []);
	assert.deepStrictEqual(sortSpotsCanonical({}), []);
	assert.deepStrictEqual(sortSpotsCanonical("A-01"), []);
	assert.deepStrictEqual(sortSpotsCanonical(123), []);
	assert.deepStrictEqual(sortSpotsCanonical(true), []);
	assert.deepStrictEqual(sortSpotsCanonical(Symbol("spots")), []);
});

test("sorts spots across multiple zones (A-Z) with multiple cells", () => {
	const input = [
		{ id: "C-02" },
		{ id: "B-10" },
		{ id: "A-05" },
		{ id: "B-02" },
		{ id: "A-01" },
		{ id: "C-01" },
	];
	const expected = [
		{ id: "A-01" },
		{ id: "A-05" },
		{ id: "B-02" },
		{ id: "B-10" },
		{ id: "C-01" },
		{ id: "C-02" },
	];

	assert.deepStrictEqual(sortSpotsCanonical(input), expected);
});
