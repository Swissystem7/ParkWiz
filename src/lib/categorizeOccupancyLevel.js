function categorizeOccupancyLevel(occupancyPercent) {
	if (
		typeof occupancyPercent !== "number" ||
		!Number.isFinite(occupancyPercent) ||
		occupancyPercent < 0 ||
		occupancyPercent > 100
	) {
		return "unknown";
	}

	if (occupancyPercent >= 98) {
		return "full";
	}
	if (occupancyPercent >= 80) {
		return "high";
	}
	if (occupancyPercent >= 50) {
		return "medium";
	}

	return "low";
}

module.exports = { categorizeOccupancyLevel };
