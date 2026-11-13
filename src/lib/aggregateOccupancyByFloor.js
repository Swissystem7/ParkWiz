const { formatOccupancyRate } = require("./formatOccupancyRate.js");

function aggregateOccupancyByFloor(spots) {
	if (!Array.isArray(spots) || spots.length === 0) {
		return { floors: {}, totalSpots: 0 };
	}

	const floors = {};

	for (const item of spots) {
		if (item === null || typeof item !== "object" || Array.isArray(item)) {
			continue;
		}

		const level = Number.isInteger(item.level) ? item.level : -1;
		if (!floors[level]) {
			floors[level] = { total: 0, free: 0, occupied: 0, unknown: 0 };
		}

		floors[level].total += 1;
		if (item.status === "free") {
			floors[level].free += 1;
		} else if (item.status === "occupied") {
			floors[level].occupied += 1;
		} else {
			floors[level].unknown += 1;
		}
	}

	for (const floor of Object.values(floors)) {
		floor.ratePercent = formatOccupancyRate(floor.occupied, floor.total);
	}

	return {
		floors,
		totalSpots: spots.length,
	};
}

module.exports = { aggregateOccupancyByFloor };
