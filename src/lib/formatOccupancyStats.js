const { computeZoneSummary } = require("./computeZoneSummary");
const { formatOccupancyRate } = require("./formatOccupancyRate");
const { categorizeOccupancyLevel } = require("./categorizeOccupancyLevel");

function formatOccupancyStats(spots) {
	if (!Array.isArray(spots) || spots.length === 0) {
		return {
			total: 0,
			free: 0,
			occupied: 0,
			unknown: 0,
			ratePercent: "0.0%",
			category: "low",
		};
	}

	const counts = computeZoneSummary(spots).total;
	const percent = counts.total > 0 ? (counts.occupied / counts.total) * 100 : 0;
	const ratePercent = formatOccupancyRate(counts.occupied, counts.total);
	const category = categorizeOccupancyLevel(percent);

	return {
		total: counts.total,
		free: counts.free,
		occupied: counts.occupied,
		unknown: counts.unknown,
		ratePercent,
		category,
	};
}

module.exports = { formatOccupancyStats };
