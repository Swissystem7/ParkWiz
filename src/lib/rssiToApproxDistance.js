function rssiToApproxDistance(rssi, txPower = -59, n = 3.4) {
	if (!Number.isFinite(rssi) || rssi >= 0) {
		return null;
	}
	if (!Number.isFinite(txPower) || !Number.isFinite(n) || n <= 0) {
		return null;
	}

	const d = 10 ** ((txPower - rssi) / (10 * n));
	if (!Number.isFinite(d)) {
		return null;
	}

	const clamped = Math.min(50, Math.max(0.1, d));
	return Math.round(clamped * 100) / 100;
}

module.exports = { rssiToApproxDistance };
