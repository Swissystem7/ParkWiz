const { validateSpotRecord } = require("./validateSpotRecord");

function isSpotAvailable(spot, maxStalenessSeconds = 60, now = Date.now()) {
	if (!validateSpotRecord(spot).valid) {
		return false;
	}

	if (spot.status !== "free") {
		return false;
	}

	if (
		typeof maxStalenessSeconds !== "number" ||
		!Number.isFinite(maxStalenessSeconds) ||
		maxStalenessSeconds < 0
	) {
		return false;
	}

	if (typeof now !== "number" || !Number.isFinite(now)) {
		return false;
	}

	if (spot.ts > now) {
		return false;
	}

	if (now - spot.ts > maxStalenessSeconds * 1000) {
		return false;
	}

	return true;
}

module.exports = { isSpotAvailable };
