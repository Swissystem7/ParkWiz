function diffOccupancyStates(
	previousSpots,
	currentSpots,
	timestamp = Date.now(),
) {
	if (!Array.isArray(currentSpots)) {
		return [];
	}

	const previousMap = new Map();
	if (Array.isArray(previousSpots)) {
		for (const spot of previousSpots) {
			if (
				spot !== null &&
				typeof spot === "object" &&
				!Array.isArray(spot) &&
				spot.id !== undefined &&
				spot.id !== null &&
				(typeof spot.id !== "string" || spot.id.trim() !== "")
			) {
				previousMap.set(spot.id, spot);
			}
		}
	}

	const events = [];

	for (const spot of currentSpots) {
		if (
			spot === null ||
			typeof spot !== "object" ||
			Array.isArray(spot) ||
			spot.id === undefined ||
			spot.id === null ||
			(typeof spot.id === "string" && spot.id.trim() === "")
		) {
			continue;
		}

		const prev = previousMap.get(spot.id);
		if (!prev || prev.status !== spot.status) {
			events.push({
				id: spot.id,
				previousStatus: prev?.status || "unknown",
				currentStatus: spot.status,
				changedAt: timestamp,
			});
		}
	}

	return events;
}

module.exports = { diffOccupancyStates };
