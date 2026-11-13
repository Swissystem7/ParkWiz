const test = require("node:test");
const assert = require("node:assert/strict");
const { parseBlePayload } = require("../src/lib/parseBlePayload");

test("parses basement payload with zone letter: major 101, minor 66 -> beaconId '101-66', floorLevel -1, zoneLetter 'B'", () => {
	const result = parseBlePayload({ major: 101, minor: 66 });
	assert.deepStrictEqual(result, {
		beaconId: "101-66",
		floorLevel: -1,
		zoneLetter: "B",
		rssi: -100,
		txPower: -59,
	});
});

test("parses ground floor payload: major 0, minor 65 -> floor 0, 'A'", () => {
	const result = parseBlePayload({ major: 0, minor: 65 });
	assert.strictEqual(result?.beaconId, "0-65");
	assert.strictEqual(result?.floorLevel, 0);
	assert.strictEqual(result?.zoneLetter, "A");
});

test("calculates basement floor level for major 102 -> -2", () => {
	const result = parseBlePayload({ major: 102, minor: 70 });
	assert.strictEqual(result?.floorLevel, -2);
	assert.strictEqual(result?.beaconId, "102-70");
});

test("calculates above-ground floor level for major 3 -> 3", () => {
	const result = parseBlePayload({ major: 3, minor: 67 });
	assert.strictEqual(result?.floorLevel, 3);
	assert.strictEqual(result?.beaconId, "3-67");
});

test("assigns 'GENERAL' zoneLetter for minor 64, 91 and 7", () => {
	const res64 = parseBlePayload({ major: 1, minor: 64 });
	const res91 = parseBlePayload({ major: 1, minor: 91 });
	const res7 = parseBlePayload({ major: 1, minor: 7 });

	assert.strictEqual(res64?.zoneLetter, "GENERAL");
	assert.strictEqual(res91?.zoneLetter, "GENERAL");
	assert.strictEqual(res7?.zoneLetter, "GENERAL");
});

test("handles rssi / txPower given as numbers or numeric strings and defaults -100 / -59 when missing or invalid", () => {
	const numeric = parseBlePayload({
		major: 1,
		minor: 65,
		rssi: -72,
		txPower: -60,
	});
	assert.strictEqual(numeric?.rssi, -72);
	assert.strictEqual(numeric?.txPower, -60);

	const numericStrings = parseBlePayload({
		major: 1,
		minor: 65,
		rssi: "-85",
		txPower: "-55",
	});
	assert.strictEqual(numericStrings?.rssi, -85);
	assert.strictEqual(numericStrings?.txPower, -55);

	const defaultsMissing = parseBlePayload({ major: 1, minor: 65 });
	assert.strictEqual(defaultsMissing?.rssi, -100);
	assert.strictEqual(defaultsMissing?.txPower, -59);

	const defaultsInvalid = parseBlePayload({
		major: 1,
		minor: 65,
		rssi: "invalid",
		txPower: "unknown",
	});
	assert.strictEqual(defaultsInvalid?.rssi, -100);
	assert.strictEqual(defaultsInvalid?.txPower, -59);
});

test("returns null for missing packet, null, array, missing major or minor", () => {
	assert.strictEqual(parseBlePayload(), null);
	assert.strictEqual(parseBlePayload(undefined), null);
	assert.strictEqual(parseBlePayload(null), null);
	assert.strictEqual(parseBlePayload([]), null);
	assert.strictEqual(parseBlePayload([{ major: 1, minor: 65 }]), null);
	assert.strictEqual(parseBlePayload({ minor: 65 }), null);
	assert.strictEqual(parseBlePayload({ major: 1 }), null);
	assert.strictEqual(parseBlePayload({}), null);
});

test("returns null for negative major/minor, string major/minor ('101'), NaN, 1.5", () => {
	assert.strictEqual(parseBlePayload({ major: -1, minor: 65 }), null);
	assert.strictEqual(parseBlePayload({ major: 1, minor: -1 }), null);
	assert.strictEqual(parseBlePayload({ major: "101", minor: 65 }), null);
	assert.strictEqual(parseBlePayload({ major: 101, minor: "66" }), null);
	assert.strictEqual(parseBlePayload({ major: Number.NaN, minor: 65 }), null);
	assert.strictEqual(parseBlePayload({ major: 101, minor: Number.NaN }), null);
	assert.strictEqual(parseBlePayload({ major: 1.5, minor: 65 }), null);
	assert.strictEqual(parseBlePayload({ major: 101, minor: 65.5 }), null);
});

test("does not mutate input and does not return uuid", () => {
	const input = Object.freeze({
		major: 101,
		minor: 66,
		rssi: -75,
		txPower: -58,
		uuid: "fda50693-a4e2-4fb1-afcf-c6eb07647825",
	});
	const copy = { ...input };

	const result = parseBlePayload(input);

	assert.deepStrictEqual(input, copy);
	assert.strictEqual(result?.beaconId, "101-66");
	assert.strictEqual(result?.floorLevel, -1);
	assert.strictEqual(result?.zoneLetter, "B");
	assert.strictEqual(result?.rssi, -75);
	assert.strictEqual(result?.txPower, -58);
	assert.strictEqual(Object.hasOwn(result ?? {}, "uuid"), false);
});

test("handles boundary values: major 100 -> floor 0, and minor 65 / 90 -> 'A' / 'Z'", () => {
	const res100 = parseBlePayload({ major: 100, minor: 90 });
	assert.strictEqual(res100?.floorLevel, 0);
	assert.strictEqual(res100?.zoneLetter, "Z");
});
