const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBreadcrumbPath } = require("../src/lib/buildBreadcrumbPath");

test("finds path for a direct edge", () => {
	const graph = {
		ENTRY: ["SPOT_A01"],
		SPOT_A01: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("ENTRY", "SPOT_A01", graph), [
		"ENTRY",
		"SPOT_A01",
	]);
});

test("finds a multi-segment path", () => {
	const graph = {
		ENTRY: ["AISLE_B"],
		AISLE_B: ["SPOT_B04"],
		SPOT_B04: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("ENTRY", "SPOT_B04", graph), [
		"ENTRY",
		"AISLE_B",
		"SPOT_B04",
	]);
});

test("returns the shortest of two alternative paths", () => {
	const graph = {
		ENTRY: ["LONG_WAY", "SHORT_WAY"],
		LONG_WAY: ["MID_1"],
		MID_1: ["TARGET"],
		SHORT_WAY: ["TARGET"],
		TARGET: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("ENTRY", "TARGET", graph), [
		"ENTRY",
		"SHORT_WAY",
		"TARGET",
	]);
});

test("breaks ties using neighbour order on equal length paths", () => {
	const graph = {
		ENTRY: ["PATH_A", "PATH_B"],
		PATH_A: ["TARGET"],
		PATH_B: ["TARGET"],
		TARGET: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("ENTRY", "TARGET", graph), [
		"ENTRY",
		"PATH_A",
		"TARGET",
	]);
});

test("returns [startId] when start === target", () => {
	const graph = {
		ENTRY: ["AISLE_A"],
		AISLE_A: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("ENTRY", "ENTRY", graph), [
		"ENTRY",
	]);
});

test("returns null for disconnected nodes", () => {
	const graph = {
		ENTRY: ["AISLE_A"],
		AISLE_A: [],
		ISLAND: ["SPOT_X"],
		SPOT_X: [],
	};

	assert.strictEqual(buildBreadcrumbPath("ENTRY", "SPOT_X", graph), null);
});

test("returns null when target or start missing from the graph", () => {
	const graph = {
		ENTRY: ["AISLE_A"],
		AISLE_A: [],
	};

	assert.strictEqual(buildBreadcrumbPath("UNKNOWN", "AISLE_A", graph), null);
	assert.strictEqual(buildBreadcrumbPath("ENTRY", "UNKNOWN", graph), null);
	assert.strictEqual(buildBreadcrumbPath("UNKNOWN", "UNKNOWN", graph), null);
});

test("terminates on cyclic graph and still finds the path", () => {
	const graph = {
		A: ["B"],
		B: ["A", "C"],
		C: ["B", "D"],
		D: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("A", "D", graph), [
		"A",
		"B",
		"C",
		"D",
	]);

	const cyclicNoPath = {
		A: ["B"],
		B: ["A"],
		DISCONNECTED: [],
	};

	assert.strictEqual(
		buildBreadcrumbPath("A", "DISCONNECTED", cyclicNoPath),
		null,
	);
});

test("returns null for invalid graph (null, array, string)", () => {
	assert.strictEqual(buildBreadcrumbPath("A", "B", null), null);
	assert.strictEqual(buildBreadcrumbPath("A", "B", ["A", "B"]), null);
	assert.strictEqual(buildBreadcrumbPath("A", "B", "graph"), null);
	assert.strictEqual(buildBreadcrumbPath("A", "B", undefined), null);
	assert.strictEqual(buildBreadcrumbPath("A", "B", 123), null);
	assert.strictEqual(buildBreadcrumbPath("A", "B", true), null);
});

test("never mutates graph", () => {
	const graph = {
		ENTRY: ["AISLE_B", "AISLE_C"],
		AISLE_B: ["SPOT_B01"],
		AISLE_C: ["SPOT_C01"],
		SPOT_B01: [],
		SPOT_C01: [],
	};

	const clone = JSON.parse(JSON.stringify(graph));
	Object.freeze(graph);
	Object.freeze(graph.ENTRY);
	Object.freeze(graph.AISLE_B);
	Object.freeze(graph.AISLE_C);
	Object.freeze(graph.SPOT_B01);
	Object.freeze(graph.SPOT_C01);

	const result = buildBreadcrumbPath("ENTRY", "SPOT_B01", graph);
	assert.deepStrictEqual(result, ["ENTRY", "AISLE_B", "SPOT_B01"]);
	assert.deepStrictEqual(graph, clone);
});

test("handles malformed neighbour lists and nodes missing from graph gracefully", () => {
	const graph = {
		ENTRY: [123, null, "AISLE_A", undefined, {}, "AISLE_B"],
		AISLE_A: "not-an-array",
		AISLE_B: ["GHOST_NODE", "TARGET"],
		TARGET: [],
	};

	assert.deepStrictEqual(buildBreadcrumbPath("ENTRY", "TARGET", graph), [
		"ENTRY",
		"AISLE_B",
		"TARGET",
	]);
});
