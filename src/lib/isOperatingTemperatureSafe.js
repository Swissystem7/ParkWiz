function isOperatingTemperatureSafe(currentTempC, maxTempC = 55) {
	if (typeof currentTempC !== "number" || !Number.isFinite(currentTempC)) {
		return false;
	}

	const safeMaxTempC =
		typeof maxTempC === "number" && Number.isFinite(maxTempC) ? maxTempC : 55;

	return currentTempC >= -10 && currentTempC <= safeMaxTempC;
}

module.exports = { isOperatingTemperatureSafe };
