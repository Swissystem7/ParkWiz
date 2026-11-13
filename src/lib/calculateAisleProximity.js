function calculateAisleProximity(coords, waypoints) {
	if (
		coords === null ||
		typeof coords !== "object" ||
		!Number.isFinite(coords.x) ||
		!Number.isFinite(coords.y)
	) {
		return null;
	}

	if (!Array.isArray(waypoints) || waypoints.length === 0) {
		return null;
	}

	let closestWaypoint = null;
	let minDist = Infinity;

	for (const waypoint of waypoints) {
		if (
			waypoint === null ||
			typeof waypoint !== "object" ||
			!Number.isFinite(waypoint.x) ||
			!Number.isFinite(waypoint.y)
		) {
			continue;
		}

		const dist = Math.sqrt(
			(coords.x - waypoint.x) ** 2 + (coords.y - waypoint.y) ** 2,
		);
		if (dist < minDist) {
			minDist = dist;
			closestWaypoint = waypoint;
		}
	}

	if (closestWaypoint === null) {
		return null;
	}

	return {
		closestWaypoint,
		distance: Math.round(minDist * 100) / 100,
	};
}

module.exports = { calculateAisleProximity };
