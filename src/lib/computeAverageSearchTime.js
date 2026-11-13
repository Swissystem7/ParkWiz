function computeAverageSearchTime(durationsSeconds) {
	if (!Array.isArray(durationsSeconds)) {
		return {
			averageSeconds: 0,
			formattedMinutes: "0.0 דקות",
			sampleCount: 0,
		};
	}

	let sum = 0;
	let n = 0;

	for (const item of durationsSeconds) {
		if (typeof item === "number" && Number.isFinite(item) && item > 0) {
			sum += item;
			n += 1;
		}
	}

	if (n === 0) {
		return {
			averageSeconds: 0,
			formattedMinutes: "0.0 דקות",
			sampleCount: 0,
		};
	}

	const avgSec = Math.round(sum / n);
	const avgMin = (avgSec / 60).toFixed(1);

	return {
		averageSeconds: avgSec,
		formattedMinutes: `${avgMin} דקות`,
		sampleCount: n,
	};
}

module.exports = { computeAverageSearchTime };
