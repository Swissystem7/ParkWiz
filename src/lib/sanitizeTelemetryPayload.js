const ALLOWED_FIELDS = Object.freeze(["id", "status", "ts", "zone"]);

const BLOCKED_FIELDS = Object.freeze([
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

function sanitizeTelemetryPayload(rawPayload) {
	if (rawPayload === null || typeof rawPayload !== "object") {
		return { sanitized: {}, strippedFields: [], wasSanitized: false };
	}

	if (Array.isArray(rawPayload)) {
		return { sanitized: {}, strippedFields: [], wasSanitized: false };
	}

	const prototype = Object.getPrototypeOf(rawPayload);
	if (prototype !== Object.prototype && prototype !== null) {
		return { sanitized: {}, strippedFields: [], wasSanitized: false };
	}

	const sanitized = {};
	const strippedFields = [];

	for (const key of Object.keys(rawPayload)) {
		if (ALLOWED_FIELDS.includes(key)) {
			sanitized[key] = rawPayload[key];
		} else if (BLOCKED_FIELDS.includes(key)) {
			strippedFields.push(key);
		}
	}

	return { sanitized, strippedFields, wasSanitized: strippedFields.length > 0 };
}

module.exports = { ALLOWED_FIELDS, BLOCKED_FIELDS, sanitizeTelemetryPayload };
