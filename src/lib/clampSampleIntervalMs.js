function clampSampleIntervalMs(requestedMs, minMs = 500, maxMs = 60000) {
	if (
		typeof requestedMs !== "number" ||
		!Number.isFinite(requestedMs) ||
		requestedMs < 0 ||
		Object.is(requestedMs, -0)
	) {
		return 1000;
	}

	const rounded = Math.round(requestedMs);
	return Math.round(Math.min(Math.max(rounded, minMs), maxMs));
}

module.exports = { clampSampleIntervalMs };
