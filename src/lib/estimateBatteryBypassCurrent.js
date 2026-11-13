function estimateBatteryBypassCurrent(
	isCameraActive,
	isNpuActive,
	baseIdleMa = 120,
	supplyVoltage = 4.15,
) {
	const idle =
		typeof baseIdleMa === "number" &&
		Number.isFinite(baseIdleMa) &&
		baseIdleMa > 0
			? baseIdleMa
			: 120;
	const voltage =
		typeof supplyVoltage === "number" &&
		Number.isFinite(supplyVoltage) &&
		supplyVoltage > 0
			? supplyVoltage
			: 4.15;
	let totalMa = idle;
	if (isCameraActive) totalMa += 450;
	if (isNpuActive) totalMa += 1200;
	const totalWatts = Math.round((totalMa / 1000) * voltage * 100) / 100;
	return {
		totalMa,
		totalWatts,
		isWithinPsuLimit: totalMa <= 3000,
	};
}

module.exports = { estimateBatteryBypassCurrent };
