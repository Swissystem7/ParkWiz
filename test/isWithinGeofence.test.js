const test = require("node:test");
const assert = require("node:assert/strict");
const { isWithinGeofence } = require("../src/lib/isWithinGeofence");

test("returns true for a point clearly inside a square", () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 },
	];
	assert.strictEqual(isWithinGeofence({ x: 5, y: 5 }, square), true);
});

test("returns false for points clearly outside a polygon", () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 },
	];
	assert.strictEqual(isWithinGeofence({ x: 20, y: 20 }, square), false);
	assert.strictEqual(isWithinGeofence({ x: -5, y: 5 }, square), false);
	assert.strictEqual(isWithinGeofence({ x: 15, y: 5 }, square), false);
	assert.strictEqual(isWithinGeofence({ x: 5, y: -5 }, square), false);
});

test("handles concave L-shaped polygon with points in notch and arms", () => {
	const lShape = [
		{ x: 0, y: 0 },
		{ x: 6, y: 0 },
		{ x: 6, y: 3 },
		{ x: 3, y: 3 },
		{ x: 3, y: 6 },
		{ x: 0, y: 6 },
	];
	assert.strictEqual(isWithinGeofence({ x: 4, y: 4 }, lShape), false);
	assert.strictEqual(isWithinGeofence({ x: 1, y: 4 }, lShape), true);
	assert.strictEqual(isWithinGeofence({ x: 4, y: 1 }, lShape), true);
});

test("supports lat/lng point and polygon coordinates", () => {
	const geoFence = [
		{ lat: 32.0, lng: 34.0 },
		{ lat: 32.0, lng: 35.0 },
		{ lat: 33.0, lng: 35.0 },
		{ lat: 33.0, lng: 34.0 },
	];
	assert.strictEqual(
		isWithinGeofence({ lat: 32.5, lng: 34.5 }, geoFence),
		true,
	);
	assert.strictEqual(
		isWithinGeofence({ lat: 31.5, lng: 34.5 }, geoFence),
		false,
	);
});

test("determines points inside and outside a triangle", () => {
	const triangle = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 5, y: 10 },
	];
	assert.strictEqual(isWithinGeofence({ x: 5, y: 3 }, triangle), true);
	assert.strictEqual(isWithinGeofence({ x: 1, y: 8 }, triangle), false);
	assert.strictEqual(isWithinGeofence({ x: 5, y: 12 }, triangle), false);
});

test("returns false when polygon has fewer than 3 vertices or is empty", () => {
	const point = { x: 5, y: 5 };
	assert.strictEqual(isWithinGeofence(point, []), false);
	assert.strictEqual(isWithinGeofence(point, [{ x: 0, y: 0 }]), false);
	assert.strictEqual(
		isWithinGeofence(point, [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		]),
		false,
	);
	assert.strictEqual(isWithinGeofence(point, null), false);
	assert.strictEqual(isWithinGeofence(point, undefined), false);
	assert.strictEqual(isWithinGeofence(point, "polygon"), false);
});

test("returns false for null, non-numeric, or NaN point", () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 },
	];
	assert.strictEqual(isWithinGeofence(null, square), false);
	assert.strictEqual(isWithinGeofence(undefined, square), false);
	assert.strictEqual(isWithinGeofence("invalid", square), false);
	assert.strictEqual(isWithinGeofence(123, square), false);
	assert.strictEqual(isWithinGeofence([], square), false);
	assert.strictEqual(isWithinGeofence({}, square), false);
	assert.strictEqual(isWithinGeofence({ x: Number.NaN, y: 5 }, square), false);
	assert.strictEqual(isWithinGeofence({ x: 5, y: Number.NaN }, square), false);
	assert.strictEqual(
		isWithinGeofence({ x: Number.POSITIVE_INFINITY, y: 5 }, square),
		false,
	);
	assert.strictEqual(isWithinGeofence({ x: "5", y: 5 }, square), false);
	assert.strictEqual(
		isWithinGeofence({ lat: Number.NaN, lng: 34 }, square),
		false,
	);
});

test("returns false when polygon contains an invalid vertex", () => {
	const point = { x: 5, y: 5 };
	assert.strictEqual(
		isWithinGeofence(point, [{ x: 0, y: 0 }, null, { x: 10, y: 10 }]),
		false,
	);
	assert.strictEqual(
		isWithinGeofence(point, [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: "10", y: 10 },
			{ x: 0, y: 10 },
		]),
		false,
	);
	assert.strictEqual(
		isWithinGeofence(point, [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: Number.NaN, y: 10 },
		]),
		false,
	);
	assert.strictEqual(
		isWithinGeofence(point, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { lat: 10 }]),
		false,
	);
});

test("does not mutate point or polygon input", () => {
	const point = Object.freeze({ x: 5, y: 5 });
	const v1 = Object.freeze({ x: 0, y: 0 });
	const v2 = Object.freeze({ x: 10, y: 0 });
	const v3 = Object.freeze({ x: 10, y: 10 });
	const v4 = Object.freeze({ x: 0, y: 10 });
	const polygon = Object.freeze([v1, v2, v3, v4]);

	const result = isWithinGeofence(point, polygon);
	assert.strictEqual(result, true);
	assert.deepStrictEqual(point, { x: 5, y: 5 });
	assert.deepStrictEqual(polygon, [v1, v2, v3, v4]);
});
