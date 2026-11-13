function computeZoneAvailabilityScore(freeSpots, totalSpots) {
	if (
		typeof freeSpots !== "number" ||
		!Number.isFinite(freeSpots) ||
		typeof totalSpots !== "number" ||
		!Number.isFinite(totalSpots) ||
		totalSpots <= 0
	) {
		return 0;
	}

	const free = Math.min(Math.max(0, freeSpots), totalSpots);
	return Math.round((free / totalSpots) * 1000) / 1000;
}

module.exports = { computeZoneAvailabilityScore };
