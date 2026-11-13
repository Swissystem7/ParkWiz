function findNearestFreeSpot(spots, referenceCoords = { x: 0, y: 0 }) {
	if (!Array.isArray(spots) || spots.length === 0) {
		return null;
	}

	const ref =
		referenceCoords &&
		Number.isFinite(referenceCoords.x) &&
		Number.isFinite(referenceCoords.y)
			? referenceCoords
			: { x: 0, y: 0 };

	let bestSpot = null;
	let minDistance = Infinity;

	for (const spot of spots) {
		if (
			!spot ||
			typeof spot !== "object" ||
			spot.status !== "free" ||
			!Number.isFinite(spot.x) ||
			!Number.isFinite(spot.y)
		) {
			continue;
		}

		const distance = Math.sqrt((spot.x - ref.x) ** 2 + (spot.y - ref.y) ** 2);

		if (distance < minDistance) {
			minDistance = distance;
			bestSpot = spot;
		}
	}

	if (!bestSpot) {
		return null;
	}

	return {
		...bestSpot,
		distance: Math.round(minDistance * 100) / 100,
	};
}

module.exports = { findNearestFreeSpot };
