function validateSpotRecord(record) {
	if (record === null || typeof record !== "object" || Array.isArray(record)) {
		return { valid: false, errors: ["Record must be a non-null object"] };
	}

	const errors = [];

	if (typeof record.id !== "string" || record.id.trim().length === 0) {
		errors.push("id must be a non-empty string");
	}

	if (
		record.status !== "free" &&
		record.status !== "occupied" &&
		record.status !== "unknown"
	) {
		errors.push("status must be one of: free, occupied, unknown");
	}

	if (!Number.isFinite(record.ts) || record.ts <= 0) {
		errors.push("ts must be a positive finite number");
	}

	return { valid: errors.length === 0, errors };
}

module.exports = { validateSpotRecord };
