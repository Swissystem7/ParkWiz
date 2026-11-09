const { normalizeSpotId } = require("./normalizeSpotId");

function normalize(id) {
	return normalizeSpotId?.(id) ?? id.trim().toUpperCase();
}

function serializeOccupancyEvent(spotId, status, timestamp = Date.now()) {
	if (typeof spotId !== "string" || spotId.trim() === "") {
		return null;
	}

	if (typeof status !== "string") {
		return null;
	}

	const normalizedStatus = status.toLowerCase();
	if (
		normalizedStatus !== "free" &&
		normalizedStatus !== "occupied" &&
		normalizedStatus !== "unknown"
	) {
		return null;
	}

	if (typeof timestamp === "boolean" || typeof timestamp === "symbol") {
		return null;
	}

	const ts = Number(timestamp);
	if (!Number.isFinite(ts) || ts <= 0) {
		return null;
	}

	const cleanId = normalize(spotId);

	return JSON.stringify({
		id: cleanId,
		status: normalizedStatus,
		ts: Math.round(ts),
	});
}

module.exports = { serializeOccupancyEvent };
