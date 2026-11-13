const test = require("node:test");
const assert = require("node:assert/strict");
const { generateSpotIdList } = require("../src/lib/generateSpotIdList");

test("generates 8 spot ids for zone A starting at 1", () => {
	assert.deepStrictEqual(generateSpotIdList("A", 1, 8), [
		"A-01",
		"A-02",
		"A-03",
		"A-04",
		"A-05",
		"A-06",
		"A-07",
		"A-08",
	]);
});

test("generates 7 spot ids for zone B starting at 1", () => {
	assert.deepStrictEqual(generateSpotIdList("B", 1, 7), [
		"B-01",
		"B-02",
		"B-03",
		"B-04",
		"B-05",
		"B-06",
		"B-07",
	]);
});

test("converts lowercase zone letter to uppercase", () => {
	assert.deepStrictEqual(generateSpotIdList("a", 1, 3), [
		"A-01",
		"A-02",
		"A-03",
	]);
	assert.deepStrictEqual(generateSpotIdList("z", 5, 2), ["Z-05", "Z-06"]);
});

test("applies default arguments when startNum and count are omitted", () => {
	assert.deepStrictEqual(generateSpotIdList("C"), ["C-01"]);
});

test("generates spot ids with a start offset", () => {
	assert.deepStrictEqual(generateSpotIdList("D", 10, 3), [
		"D-10",
		"D-11",
		"D-12",
	]);
});

test("enforces upper bound at 99 and rejects out-of-range sequences", () => {
	assert.deepStrictEqual(generateSpotIdList("E", 95, 5), [
		"E-95",
		"E-96",
		"E-97",
		"E-98",
		"E-99",
	]);
	assert.deepStrictEqual(generateSpotIdList("E", 96, 5), []);
	assert.deepStrictEqual(generateSpotIdList("E", 100, 1), []);
});

test("returns [] for count 0, negative, non-integer, or > 100", () => {
	assert.deepStrictEqual(generateSpotIdList("F", 1, 0), []);
	assert.deepStrictEqual(generateSpotIdList("F", 1, -1), []);
	assert.deepStrictEqual(generateSpotIdList("F", 1, 2.5), []);
	assert.deepStrictEqual(generateSpotIdList("F", 1, 101), []);
	assert.deepStrictEqual(generateSpotIdList("F", 1, Number.NaN), []);
	assert.deepStrictEqual(generateSpotIdList("F", 1, "3"), []);
	assert.deepStrictEqual(generateSpotIdList("F", 1, null), []);
});

test("returns [] for invalid letters", () => {
	assert.deepStrictEqual(generateSpotIdList(""), []);
	assert.deepStrictEqual(generateSpotIdList("AB"), []);
	assert.deepStrictEqual(generateSpotIdList("1"), []);
	assert.deepStrictEqual(generateSpotIdList("א"), []);
	assert.deepStrictEqual(generateSpotIdList(null), []);
	assert.deepStrictEqual(generateSpotIdList(undefined), []);
	assert.deepStrictEqual(generateSpotIdList(123), []);
	assert.deepStrictEqual(generateSpotIdList(" "), []);
});

test("returns [] for startNum 0, negative, or non-integer", () => {
	assert.deepStrictEqual(generateSpotIdList("G", 0, 1), []);
	assert.deepStrictEqual(generateSpotIdList("G", -1, 1), []);
	assert.deepStrictEqual(generateSpotIdList("G", 1.5, 1), []);
	assert.deepStrictEqual(generateSpotIdList("G", Number.NaN, 1), []);
	assert.deepStrictEqual(generateSpotIdList("G", "1", 1), []);
	assert.deepStrictEqual(generateSpotIdList("G", null, 1), []);
});
