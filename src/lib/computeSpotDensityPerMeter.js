function computeSpotDensityPerMeter(spotCount, aisleLengthMeters) {
	if (
		typeof spotCount !== "number" ||
		!Number.isFinite(spotCount) ||
		spotCount < 0 ||
		typeof aisleLengthMeters !== "number" ||
		!Number.isFinite(aisleLengthMeters) ||
		aisleLengthMeters <= 0
	) {
		return 0;
	}

	return Math.round((spotCount / aisleLengthMeters) * 1000) / 1000;
}

module.exports = { computeSpotDensityPerMeter };
