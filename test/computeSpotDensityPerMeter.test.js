const test = require("node:test");
const assert = require("node:assert/strict");
const {
	computeSpotDensityPerMeter,
} = require("../src/lib/computeSpotDensityPerMeter");

test("computes density for typical numbers (8 spots in 20 meters -> 0.4)", () => {
	assert.strictEqual(computeSpotDensityPerMeter(8, 20), 0.4);
});

test("returns 0 when spot count is 0", () => {
	assert.strictEqual(computeSpotDensityPerMeter(0, 20), 0);
	assert.strictEqual(computeSpotDensityPerMeter(0, 100), 0);
});

test("rounds density to 3 decimal places (1 spot in 3 meters -> 0.333)", () => {
	assert.strictEqual(computeSpotDensityPerMeter(1, 3), 0.333);
});

test("rounds density upwards to 3 decimal places (2 spots in 3 meters -> 0.667)", () => {
	assert.strictEqual(computeSpotDensityPerMeter(2, 3), 0.667);
});

test("returns 0 when aisle length is 0", () => {
	assert.strictEqual(computeSpotDensityPerMeter(8, 0), 0);
	assert.strictEqual(computeSpotDensityPerMeter(0, 0), 0);
});

test("returns 0 when aisle length is negative", () => {
	assert.strictEqual(computeSpotDensityPerMeter(8, -1), 0);
	assert.strictEqual(computeSpotDensityPerMeter(8, -20), 0);
});

test("returns 0 when aisle length is NaN or non-finite", () => {
	assert.strictEqual(computeSpotDensityPerMeter(8, Number.NaN), 0);
	assert.strictEqual(
		computeSpotDensityPerMeter(8, Number.POSITIVE_INFINITY),
		0,
	);
	assert.strictEqual(
		computeSpotDensityPerMeter(8, Number.NEGATIVE_INFINITY),
		0,
	);
});

test("returns 0 when aisle length is a string or non-number type", () => {
	assert.strictEqual(computeSpotDensityPerMeter(8, "20"), 0);
	assert.strictEqual(computeSpotDensityPerMeter(8, ""), 0);
	assert.strictEqual(computeSpotDensityPerMeter(8, null), 0);
	assert.strictEqual(computeSpotDensityPerMeter(8, {}), 0);
});

test("returns 0 when spot count is negative", () => {
	assert.strictEqual(computeSpotDensityPerMeter(-1, 20), 0);
	assert.strictEqual(computeSpotDensityPerMeter(-8, 20), 0);
});

test("returns 0 when spot count is a string or non-number type", () => {
	assert.strictEqual(computeSpotDensityPerMeter("8", 20), 0);
	assert.strictEqual(computeSpotDensityPerMeter("", 20), 0);
	assert.strictEqual(computeSpotDensityPerMeter(null, 20), 0);
	assert.strictEqual(computeSpotDensityPerMeter({}, 20), 0);
});

test("returns 0 when spot count is NaN or non-finite", () => {
	assert.strictEqual(computeSpotDensityPerMeter(Number.NaN, 20), 0);
	assert.strictEqual(
		computeSpotDensityPerMeter(Number.POSITIVE_INFINITY, 20),
		0,
	);
	assert.strictEqual(
		computeSpotDensityPerMeter(Number.NEGATIVE_INFINITY, 20),
		0,
	);
});

test("returns 0 when arguments are omitted or undefined", () => {
	assert.strictEqual(computeSpotDensityPerMeter(), 0);
	assert.strictEqual(computeSpotDensityPerMeter(undefined, 20), 0);
	assert.strictEqual(computeSpotDensityPerMeter(8, undefined), 0);
	assert.strictEqual(computeSpotDensityPerMeter(undefined, undefined), 0);
});
