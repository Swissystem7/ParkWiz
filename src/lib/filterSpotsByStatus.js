function filterSpotsByStatus(spots, targetStatus) {
	if (
		!Array.isArray(spots) ||
		spots.length === 0 ||
		typeof targetStatus !== "string" ||
		targetStatus.trim() === ""
	) {
		return [];
	}

	const normalizedTargetStatus = targetStatus.trim().toLowerCase();
	return spots.filter((spot) => {
		if (
			spot === null ||
			typeof spot !== "object" ||
			typeof spot.status !== "string"
		) {
			return false;
		}

		return spot.status.trim().toLowerCase() === normalizedTargetStatus;
	});
}

module.exports = { filterSpotsByStatus };
