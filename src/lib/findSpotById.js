const { normalizeSpotId } = require("./normalizeSpotId");

function normalize(id) {
	if (typeof id !== "string") {
		return null;
	}
	const canonical = normalizeSpotId(id);
	if (canonical !== null) {
		return canonical;
	}
	const trimmed = id.trim();
	return trimmed === "" ? null : trimmed.toUpperCase();
}

function findSpotById(spots, targetId) {
	if (!Array.isArray(spots)) {
		return null;
	}

	if (typeof targetId !== "string" || targetId.trim() === "") {
		return null;
	}

	const normalizedTarget = normalize(targetId);
	if (!normalizedTarget) {
		return null;
	}

	for (const spot of spots) {
		if (spot === null || typeof spot !== "object" || Array.isArray(spot)) {
			continue;
		}

		if (typeof spot.id !== "string") {
			continue;
		}

		if (normalize(spot.id) === normalizedTarget) {
			return spot;
		}
	}

	return null;
}

module.exports = { findSpotById };
