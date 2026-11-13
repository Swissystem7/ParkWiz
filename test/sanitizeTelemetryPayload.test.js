const test = require("node:test");
const assert = require("node:assert/strict");
const {
	ALLOWED_FIELDS,
	BLOCKED_FIELDS,
	sanitizeTelemetryPayload,
} = require("../src/lib/sanitizeTelemetryPayload");

test("strips and lists every blocked field", () => {
	const payload = {
		id: "A-01",
		status: "free",
		plate: "blocked-plate-value",
		license_plate: "blocked-license-plate-value",
		lpr: "blocked-lpr-value",
		image: "blocked-image-value",
		frame: "blocked-frame-value",
		face: "blocked-face-value",
		video: "blocked-video-value",
		raw: "blocked-raw-value",
		base64: "blocked-base64-value",
		ts: 1700000000000,
		zone: "A",
	};

	const result = sanitizeTelemetryPayload(payload);

	assert.deepStrictEqual(result.sanitized, {
		id: "A-01",
		status: "free",
		ts: 1700000000000,
		zone: "A",
	});
	assert.deepStrictEqual(result.strippedFields, [
		"plate",
		"license_plate",
		"lpr",
		"image",
		"frame",
		"face",
		"video",
		"raw",
		"base64",
	]);
	assert.strictEqual(result.wasSanitized, true);
});

test("keeps allowed fields with identical values", () => {
	const payload = {
		id: "B-12",
		status: "occupied",
		ts: 1700000001234,
		zone: "B",
	};

	const result = sanitizeTelemetryPayload(payload);

	assert.strictEqual(result.sanitized.id, payload.id);
	assert.strictEqual(result.sanitized.status, payload.status);
	assert.strictEqual(result.sanitized.ts, payload.ts);
	assert.strictEqual(result.sanitized.zone, payload.zone);
	assert.deepStrictEqual(result.sanitized, payload);
	assert.deepStrictEqual(result.strippedFields, []);
});

test("drops unknown non-blocked fields without listing them", () => {
	const payload = {
		id: "C-03",
		status: "free",
		operatorNote: "unknown-note-value",
		deviceId: "unknown-device-value",
		extraFlag: true,
	};

	const result = sanitizeTelemetryPayload(payload);

	assert.deepStrictEqual(result.sanitized, { id: "C-03", status: "free" });
	assert.deepStrictEqual(result.strippedFields, []);
	assert.strictEqual(result.wasSanitized, false);
});

test("returns wasSanitized false for a clean payload", () => {
	const result = sanitizeTelemetryPayload({
		id: "A-02",
		status: "free",
		ts: 1700000002000,
		zone: "A",
	});

	assert.deepStrictEqual(result.sanitized, {
		id: "A-02",
		status: "free",
		ts: 1700000002000,
		zone: "A",
	});
	assert.deepStrictEqual(result.strippedFields, []);
	assert.strictEqual(result.wasSanitized, false);
	assert.deepStrictEqual(sanitizeTelemetryPayload({}), {
		sanitized: {},
		strippedFields: [],
		wasSanitized: false,
	});
});

test("returns an empty result for null and undefined payloads", () => {
	const expected = { sanitized: {}, strippedFields: [], wasSanitized: false };

	assert.deepStrictEqual(sanitizeTelemetryPayload(null), expected);
	assert.deepStrictEqual(sanitizeTelemetryPayload(undefined), expected);
	assert.deepStrictEqual(sanitizeTelemetryPayload(), expected);
});

test("returns an empty result for arrays and primitives", () => {
	const expected = { sanitized: {}, strippedFields: [], wasSanitized: false };

	assert.deepStrictEqual(sanitizeTelemetryPayload([]), expected);
	assert.deepStrictEqual(sanitizeTelemetryPayload(["id", "plate"]), expected);
	assert.deepStrictEqual(sanitizeTelemetryPayload("telemetry"), expected);
	assert.deepStrictEqual(sanitizeTelemetryPayload(42), expected);
	assert.deepStrictEqual(sanitizeTelemetryPayload(true), expected);
});

test("leaks no blocked keys or values into the serialized output", () => {
	const blockedValues = [
		"leak-check-plate-001",
		"leak-check-license-002",
		"leak-check-lpr-003",
		"leak-check-image-004",
		"leak-check-frame-005",
		"leak-check-face-006",
		"leak-check-video-007",
		"leak-check-raw-008",
		"leak-check-base64-009",
	];
	const payload = {
		id: "D-04",
		status: "occupied",
		ts: 1700000003000,
		zone: "D",
		plate: blockedValues[0],
		license_plate: blockedValues[1],
		lpr: blockedValues[2],
		image: blockedValues[3],
		frame: blockedValues[4],
		face: blockedValues[5],
		video: blockedValues[6],
		raw: blockedValues[7],
		base64: blockedValues[8],
	};

	const serialized = JSON.stringify(
		sanitizeTelemetryPayload(payload).sanitized,
	);

	for (const field of BLOCKED_FIELDS) {
		assert.strictEqual(serialized.includes(field), false);
	}
	for (const value of blockedValues) {
		assert.strictEqual(serialized.includes(value), false);
	}
});

test("does not mutate the input payload", () => {
	const payload = {
		id: "E-05",
		status: "free",
		plate: "blocked-plate-value",
		zone: "E",
		unknownField: "unknown-value",
	};
	const before = JSON.stringify(payload);

	const result = sanitizeTelemetryPayload(payload);

	assert.strictEqual(JSON.stringify(payload), before);
	assert.strictEqual(payload.plate, "blocked-plate-value");
	assert.deepStrictEqual(result.sanitized, {
		id: "E-05",
		status: "free",
		zone: "E",
	});
});

test("does not copy a __proto__ key or pollute prototypes", () => {
	const payload = JSON.parse(
		'{"__proto__": {"polluted": "yes"}, "id": "A-01", "status": "free"}',
	);

	const result = sanitizeTelemetryPayload(payload);

	assert.strictEqual(Object.hasOwn(result.sanitized, "__proto__"), false);
	assert.deepStrictEqual(result.sanitized, { id: "A-01", status: "free" });
	assert.strictEqual(Object.hasOwn(Object.prototype, "polluted"), false);
	assert.strictEqual(Object.getPrototypeOf(result.sanitized), Object.prototype);
});

test("never copies constructor or prototype keys", () => {
	const result = sanitizeTelemetryPayload({
		id: "F-06",
		constructor: "blocked-constructor-value",
		prototype: "blocked-prototype-value",
	});

	assert.deepStrictEqual(result.sanitized, { id: "F-06" });
	assert.strictEqual(Object.hasOwn(result.sanitized, "constructor"), false);
	assert.strictEqual(Object.hasOwn(result.sanitized, "prototype"), false);
	assert.deepStrictEqual(result.strippedFields, []);
	assert.strictEqual(result.wasSanitized, false);
});

test("lists stripped fields in payload key order", () => {
	const result = sanitizeTelemetryPayload({
		video: "blocked-video-value",
		id: "G-07",
		plate: "blocked-plate-value",
		image: "blocked-image-value",
		status: "free",
	});

	assert.deepStrictEqual(result.strippedFields, ["video", "plate", "image"]);
	assert.deepStrictEqual(result.sanitized, { id: "G-07", status: "free" });
	assert.strictEqual(result.wasSanitized, true);
});

test("exports frozen allowlist and blocklist constants", () => {
	assert.deepStrictEqual(ALLOWED_FIELDS, ["id", "status", "ts", "zone"]);
	assert.deepStrictEqual(BLOCKED_FIELDS, [
		"plate",
		"license_plate",
		"lpr",
		"image",
		"frame",
		"face",
		"video",
		"raw",
		"base64",
	]);
	assert.strictEqual(Object.isFrozen(ALLOWED_FIELDS), true);
	assert.strictEqual(Object.isFrozen(BLOCKED_FIELDS), true);
	assert.strictEqual(typeof sanitizeTelemetryPayload, "function");
});
