const test = require("node:test");
const assert = require("node:assert/strict");
const {
	calculateAisleProximity,
} = require("../src/lib/calculateAisleProximity");

test("returns distance 5 for a 3-4-5 triangle", () => {
	const waypoint = { id: "A1", x: 3, y: 4, name: "Aisle 1" };

	const result = calculateAisleProximity({ x: 0, y: 0 }, [waypoint]);

	assert.strictEqual(result.closestWaypoint, waypoint);
	assert.strictEqual(result.distance, 5);
});

test("returns distance 0 for an identical point", () => {
	const waypoint = { id: "A1", x: 2, y: 3, name: "Aisle 1" };

	const result = calculateAisleProximity({ x: 2, y: 3 }, [waypoint]);

	assert.strictEqual(result.closestWaypoint, waypoint);
	assert.strictEqual(result.distance, 0);
});

test("picks the nearest waypoint among several waypoints", () => {
	const far = { id: "F1", x: 10, y: 10, name: "Far aisle" };
	const near = { id: "N1", x: 1, y: 0, name: "Near aisle" };
	const mid = { id: "M1", x: 5, y: 5, name: "Mid aisle" };

	const result = calculateAisleProximity({ x: 0, y: 0 }, [far, near, mid]);

	assert.strictEqual(result.closestWaypoint, near);
	assert.strictEqual(result.distance, 1);
});

test("handles negative coordinates", () => {
	const waypoint = { id: "A1", x: -4, y: -5, name: "Aisle 1" };

	const result = calculateAisleProximity({ x: -1, y: -1 }, [waypoint]);

	assert.strictEqual(result.closestWaypoint, waypoint);
	assert.strictEqual(result.distance, 5);
});

test("rounds the distance to 2 decimal places", () => {
	const waypoint = { id: "A1", x: 1, y: 1, name: "Aisle 1" };

	const result = calculateAisleProximity({ x: 0, y: 0 }, [waypoint]);

	assert.strictEqual(result.closestWaypoint, waypoint);
	assert.strictEqual(result.distance, 1.41);
});

test("keeps the first waypoint when distances tie", () => {
	const first = { id: "A1", x: 3, y: 4, name: "First aisle" };
	const second = { id: "A2", x: 4, y: 3, name: "Second aisle" };

	const result = calculateAisleProximity({ x: 0, y: 0 }, [first, second]);

	assert.strictEqual(result.closestWaypoint, first);
	assert.strictEqual(result.distance, 5);
});

test("returns null for an empty waypoints array", () => {
	assert.strictEqual(calculateAisleProximity({ x: 0, y: 0 }, []), null);
});

test("returns null for invalid coords", () => {
	const waypoints = [{ id: "A1", x: 1, y: 1, name: "Aisle 1" }];

	assert.strictEqual(calculateAisleProximity(null, waypoints), null);
	assert.strictEqual(calculateAisleProximity(undefined, waypoints), null);
	assert.strictEqual(calculateAisleProximity("0,0", waypoints), null);
	assert.strictEqual(calculateAisleProximity(42, waypoints), null);
	assert.strictEqual(calculateAisleProximity({}, waypoints), null);
	assert.strictEqual(calculateAisleProximity({ x: 1 }, waypoints), null);
	assert.strictEqual(calculateAisleProximity({ y: 2 }, waypoints), null);
	assert.strictEqual(
		calculateAisleProximity({ x: Number.NaN, y: 0 }, waypoints),
		null,
	);
	assert.strictEqual(
		calculateAisleProximity({ x: 0, y: Number.NaN }, waypoints),
		null,
	);
	assert.strictEqual(
		calculateAisleProximity({ x: Infinity, y: 0 }, waypoints),
		null,
	);
	assert.strictEqual(
		calculateAisleProximity({ x: "1", y: 2 }, waypoints),
		null,
	);
});

test("returns null when waypoints is not an array", () => {
	const coords = { x: 0, y: 0 };

	assert.strictEqual(calculateAisleProximity(coords, null), null);
	assert.strictEqual(calculateAisleProximity(coords, undefined), null);
	assert.strictEqual(calculateAisleProximity(coords, "waypoints"), null);
	assert.strictEqual(calculateAisleProximity(coords, {}), null);
	assert.strictEqual(calculateAisleProximity(coords, 42), null);
});

test("skips waypoints that are not objects or lack finite x/y", () => {
	const valid = { id: "A1", x: 3, y: 4, name: "Aisle 1" };
	const waypoints = [
		null,
		"waypoint",
		42,
		{ id: "B1", y: 1, name: "Missing x" },
		{ id: "B2", x: 1, name: "Missing y" },
		{ id: "B3", x: Number.NaN, y: 1, name: "NaN x" },
		{ id: "B4", x: 1, y: Infinity, name: "Infinite y" },
		{ id: "B5", x: "1", y: 1, name: "String x" },
		valid,
	];

	const result = calculateAisleProximity({ x: 0, y: 0 }, waypoints);

	assert.strictEqual(result.closestWaypoint, valid);
	assert.strictEqual(result.distance, 5);
});

test("returns null when no waypoint is valid", () => {
	const coords = { x: 0, y: 0 };
	const waypoints = [
		null,
		"waypoint",
		{ id: "B1", y: 1, name: "Missing x" },
		{ id: "B2", x: Number.NaN, y: 1, name: "NaN x" },
	];

	assert.strictEqual(calculateAisleProximity(coords, waypoints), null);
});

test("does not mutate the inputs", () => {
	const coords = { x: 0, y: 0 };
	const near = { id: "N1", x: 1, y: 0, name: "Near aisle" };
	const far = { id: "F1", x: 10, y: 10, name: "Far aisle" };
	const waypoints = [far, near];
	const originalCoords = { ...coords };
	const originalWaypoints = JSON.parse(JSON.stringify(waypoints));

	const result = calculateAisleProximity(coords, waypoints);

	assert.strictEqual(result.closestWaypoint, near);
	assert.deepStrictEqual(coords, originalCoords);
	assert.deepStrictEqual(waypoints, originalWaypoints);
	assert.strictEqual(waypoints[0], far);
	assert.strictEqual(waypoints[1], near);
});
