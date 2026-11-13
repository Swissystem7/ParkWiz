function estimateBleBatteryLifeMonths(batteryCapacityMah, advIntervalMs = 150) {
	if (
		typeof batteryCapacityMah !== "number" ||
		!Number.isFinite(batteryCapacityMah) ||
		batteryCapacityMah <= 0
	) {
		return null;
	}
	if (
		typeof advIntervalMs !== "number" ||
		!Number.isFinite(advIntervalMs) ||
		advIntervalMs <= 0
	) {
		return null;
	}
	const avgCurrentUa = 2.5 + 5000 / advIntervalMs;
	const currentMa = avgCurrentUa / 1000;
	const hours = (batteryCapacityMah * 0.85) / currentMa;
	const estimatedMonths = Math.round(hours / 730);
	return {
		estimatedMonths,
		avgCurrentUa,
		isAboveTwoYears: estimatedMonths >= 24,
	};
}
module.exports = { estimateBleBatteryLifeMonths };
