const { normalizeSpotId } = require("./normalizeSpotId");

// Callers pass only strings: targetId is checked non-empty and spot ids are checked to be strings.
function normalize(id) {
	return normalizeSpotId(id) ?? id.trim().toUpperCase();
}

function findSpotById(spots, targetId) {
	if (!Array.isArray(spots)) {
		return null;
	}

	if (typeof targetId !== "string" || targetId.trim() === "") {
		return null;
	}

	const normalizedTarget = normalize(targetId);

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
