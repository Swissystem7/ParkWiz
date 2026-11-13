function extractZoneFromSpotId(spotId) {
	if (typeof spotId !== "string") {
		return null;
	}

	const match = spotId.trim().match(/^([A-Za-z])/);
	return match ? match[1].toUpperCase() : null;
}

module.exports = { extractZoneFromSpotId };
