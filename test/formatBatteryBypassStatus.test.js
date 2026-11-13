const test = require("node:test");
const assert = require("node:assert/strict");
const {
	formatBatteryBypassStatus,
} = require("../src/lib/formatBatteryBypassStatus");

test("4.15 plugged OK returns operational status", () => {
	const result = formatBatteryBypassStatus(4.15, true);
	assert.deepStrictEqual(result, {
		isOperational: true,
		statusText: "מתח תקין (4.15V)",
		warning: null,
	});
});

test("3.80 undervoltage returns undervoltage warning", () => {
	const result = formatBatteryBypassStatus(3.8, true);
	assert.deepStrictEqual(result, {
		isOperational: false,
		statusText: "מתח נמוך (3.80V)",
		warning: "UNDERVOLTAGE_BROWNOUT_RISK",
	});
});

test("4.35 overvoltage returns overvoltage warning", () => {
	const result = formatBatteryBypassStatus(4.35, true);
	assert.deepStrictEqual(result, {
		isOperational: false,
		statusText: "מתח יתר (4.35V)",
		warning: "OVERVOLTAGE_RISK",
	});
});

test("isPlugged false returns power disconnected warning", () => {
	const result = formatBatteryBypassStatus(4.15, false);
	assert.deepStrictEqual(result, {
		isOperational: false,
		statusText: "אין הזנת חשמל (מנותק)",
		warning: "POWER_DISCONNECTED",
	});

	const resultWithInvalidVoltage = formatBatteryBypassStatus(Number.NaN, false);
	assert.deepStrictEqual(resultWithInvalidVoltage, {
		isOperational: false,
		statusText: "אין הזנת חשמל (מנותק)",
		warning: "POWER_DISCONNECTED",
	});
});

test("NaN edge case returns invalid voltage warning", () => {
	const result = formatBatteryBypassStatus(Number.NaN, true);
	assert.deepStrictEqual(result, {
		isOperational: false,
		statusText: "מתח לא מאומת",
		warning: "INVALID_VOLTAGE",
	});
});

test("string edge cases return invalid voltage warning", () => {
	assert.deepStrictEqual(formatBatteryBypassStatus("4.15", true), {
		isOperational: false,
		statusText: "מתח לא מאומת",
		warning: "INVALID_VOLTAGE",
	});

	assert.deepStrictEqual(formatBatteryBypassStatus("", true), {
		isOperational: false,
		statusText: "מתח לא מאומת",
		warning: "INVALID_VOLTAGE",
	});
});

test("0 edge case returns undervoltage warning with 0.00V", () => {
	const result = formatBatteryBypassStatus(0, true);
	assert.deepStrictEqual(result, {
		isOperational: false,
		statusText: "מתח נמוך (0.00V)",
		warning: "UNDERVOLTAGE_BROWNOUT_RISK",
	});
});

test("non-finite / non-number edge cases return invalid voltage warning", () => {
	assert.deepStrictEqual(
		formatBatteryBypassStatus(Number.POSITIVE_INFINITY, true),
		{
			isOperational: false,
			statusText: "מתח לא מאומת",
			warning: "INVALID_VOLTAGE",
		},
	);
	assert.deepStrictEqual(
		formatBatteryBypassStatus(Number.NEGATIVE_INFINITY, true),
		{
			isOperational: false,
			statusText: "מתח לא מאומת",
			warning: "INVALID_VOLTAGE",
		},
	);
	assert.deepStrictEqual(formatBatteryBypassStatus(null, true), {
		isOperational: false,
		statusText: "מתח לא מאומת",
		warning: "INVALID_VOLTAGE",
	});
	assert.deepStrictEqual(formatBatteryBypassStatus(undefined, true), {
		isOperational: false,
		statusText: "מתח לא מאומת",
		warning: "INVALID_VOLTAGE",
	});
});

test("exact voltage thresholds (3.95V and 4.25V) are operational", () => {
	assert.deepStrictEqual(formatBatteryBypassStatus(3.95, true), {
		isOperational: true,
		statusText: "מתח תקין (3.95V)",
		warning: null,
	});

	assert.deepStrictEqual(formatBatteryBypassStatus(4.25, true), {
		isOperational: true,
		statusText: "מתח תקין (4.25V)",
		warning: null,
	});
});
