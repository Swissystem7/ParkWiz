const test = require("node:test");
const assert = require("node:assert/strict");
const {
	computeCameraViewBounds,
} = require("../src/lib/computeCameraViewBounds");

test("computes view bounds for height 2.5 with default fov 120 centered at origin", () => {
	const bounds = computeCameraViewBounds(0, 0, 2.5);
	assert.deepStrictEqual(bounds, {
		minX: -4.33,
		maxX: 4.33,
		minY: -4.33,
		maxY: 4.33,
		coverageDiameter: 8.66,
	});
});

test("centers view bounds around arbitrary camera coordinates", () => {
	const bounds = computeCameraViewBounds(10, 25, 2.5, 120);
	assert.deepStrictEqual(bounds, {
		minX: 5.67,
		maxX: 14.33,
		minY: 20.67,
		maxY: 29.33,
		coverageDiameter: 8.66,
	});

	const negativeCoords = computeCameraViewBounds(-12.5, -30.2, 2.5, 120);
	assert.deepStrictEqual(negativeCoords, {
		minX: -16.83,
		maxX: -8.17,
		minY: -34.53,
		maxY: -25.87,
		coverageDiameter: 8.66,
	});
});

test("computes accurate coverage with custom valid fov degrees", () => {
	const bounds90 = computeCameraViewBounds(0, 0, 5, 90);
	assert.deepStrictEqual(bounds90, {
		minX: -5,
		maxX: 5,
		minY: -5,
		maxY: 5,
		coverageDiameter: 10,
	});

	const bounds60 = computeCameraViewBounds(20, 30, 10, 60);
	assert.deepStrictEqual(bounds60, {
		minX: 14.23,
		maxX: 25.77,
		minY: 24.23,
		maxY: 35.77,
		coverageDiameter: 11.55,
	});
});

test("returns null for mountHeight that is zero or negative", () => {
	assert.strictEqual(computeCameraViewBounds(0, 0, 0), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, -2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, -0.001), null);
});

test("returns null for fovDegrees <= 0 or >= 180", () => {
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, 0), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, -10), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, 180), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, 180.5), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, 270), null);
});

test("returns null for NaN and non-finite parameters", () => {
	assert.strictEqual(computeCameraViewBounds(0, 0, Number.NaN), null);
	assert.strictEqual(
		computeCameraViewBounds(0, 0, Number.POSITIVE_INFINITY),
		null,
	);
	assert.strictEqual(
		computeCameraViewBounds(0, 0, Number.NEGATIVE_INFINITY),
		null,
	);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, Number.NaN), null);
	assert.strictEqual(
		computeCameraViewBounds(0, 0, 2.5, Number.POSITIVE_INFINITY),
		null,
	);
	assert.strictEqual(
		computeCameraViewBounds(0, 0, 2.5, Number.NEGATIVE_INFINITY),
		null,
	);
	assert.strictEqual(computeCameraViewBounds(Number.NaN, 0, 2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, Number.NaN, 2.5), null);
	assert.strictEqual(
		computeCameraViewBounds(Number.POSITIVE_INFINITY, 0, 2.5),
		null,
	);
	assert.strictEqual(
		computeCameraViewBounds(0, Number.NEGATIVE_INFINITY, 2.5),
		null,
	);
});

test("returns null for non-numeric types", () => {
	assert.strictEqual(computeCameraViewBounds("0", 0, 2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, "0", 2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, "2.5"), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, "120"), null);
	assert.strictEqual(computeCameraViewBounds(null, 0, 2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, null, 2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, null), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, 2.5, null), null);
	assert.strictEqual(computeCameraViewBounds({}, 0, 2.5), null);
	assert.strictEqual(computeCameraViewBounds(0, 0, {}), null);
});
