function clampOccupancyCount(occupiedCount, totalSpots) {
	if (
		typeof totalSpots !== "number" ||
		!Number.isFinite(totalSpots) ||
		totalSpots <= 0
	) {
		return 0;
	}

	if (typeof occupiedCount !== "number" || !Number.isFinite(occupiedCount)) {
		return 0;
	}

	return Math.min(
		Math.max(0, Math.round(occupiedCount)),
		Math.round(totalSpots),
	);
}

module.exports = { clampOccupancyCount };
