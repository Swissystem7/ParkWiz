const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSpotRecord } = require("../src/lib/validateSpotRecord");

test("accepts a fully valid free record", () => {
	assert.deepStrictEqual(
		validateSpotRecord({ id: "A-01", status: "free", ts: 1700000000000 }),
		{ valid: true, errors: [] },
	);
});

test("accepts a fully valid occupied record", () => {
	assert.deepStrictEqual(
		validateSpotRecord({ id: "B-02", status: "occupied", ts: 1700000000000 }),
		{ valid: true, errors: [] },
	);
});

test("accepts a fully valid unknown record", () => {
	assert.deepStrictEqual(
		validateSpotRecord({ id: "C-03", status: "unknown", ts: 1700000000000 }),
		{ valid: true, errors: [] },
	);
});

test("reports each missing field", () => {
	assert.deepStrictEqual(
		validateSpotRecord({ status: "free", ts: 1700000000000 }),
		{
			valid: false,
			errors: ["id must be a non-empty string"],
		},
	);
	assert.deepStrictEqual(
		validateSpotRecord({ id: "A-01", ts: 1700000000000 }),
		{
			valid: false,
			errors: ["status must be one of: free, occupied, unknown"],
		},
	);
	assert.deepStrictEqual(validateSpotRecord({ id: "A-01", status: "free" }), {
		valid: false,
		errors: ["ts must be a positive finite number"],
	});
});

test("rejects empty and whitespace-only id values", () => {
	for (const id of ["", "   ", "\t\n"]) {
		assert.deepStrictEqual(
			validateSpotRecord({ id, status: "free", ts: 1700000000000 }),
			{
				valid: false,
				errors: ["id must be a non-empty string"],
			},
		);
	}
});

test("rejects non-string id values", () => {
	for (const id of [42, null, undefined, true, {}, []]) {
		assert.deepStrictEqual(
			validateSpotRecord({ id, status: "free", ts: 1700000000000 }),
			{
				valid: false,
				errors: ["id must be a non-empty string"],
			},
		);
	}
});

test("rejects invalid status values", () => {
	for (const status of [
		"FREE",
		"",
		null,
		"busy",
		undefined,
		"Free",
		" free ",
	]) {
		assert.deepStrictEqual(
			validateSpotRecord({ id: "A-01", status, ts: 1700000000000 }),
			{
				valid: false,
				errors: ["status must be one of: free, occupied, unknown"],
			},
		);
	}
});

test("rejects negative, zero, NaN, Infinity, and string ts values", () => {
	for (const ts of [
		-1,
		0,
		NaN,
		Infinity,
		-Infinity,
		"1700000000000",
		null,
		undefined,
	]) {
		assert.deepStrictEqual(
			validateSpotRecord({ id: "A-01", status: "free", ts }),
			{
				valid: false,
				errors: ["ts must be a positive finite number"],
			},
		);
	}
});

test("returns three errors in id, status, ts order for an empty object", () => {
	assert.deepStrictEqual(validateSpotRecord({}), {
		valid: false,
		errors: [
			"id must be a non-empty string",
			"status must be one of: free, occupied, unknown",
			"ts must be a positive finite number",
		],
	});
});

test("rejects null, array, and number inputs as non-object records", () => {
	for (const record of [null, [], ["A-01"], 42, "A-01", undefined, true]) {
		assert.deepStrictEqual(validateSpotRecord(record), {
			valid: false,
			errors: ["Record must be a non-null object"],
		});
	}
});

test("does not mutate the input record", () => {
	const record = { id: "A-01", status: "free", ts: 1700000000000 };
	const snapshot = { ...record };

	validateSpotRecord(record);

	assert.deepStrictEqual(record, snapshot);

	const invalid = { id: "  ", status: "busy", ts: -1 };
	const invalidSnapshot = { ...invalid };

	validateSpotRecord(invalid);

	assert.deepStrictEqual(invalid, invalidSnapshot);
});
