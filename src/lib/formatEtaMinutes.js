function formatEtaMinutes(distanceMeters, speedKmh = 10) {
	if (
		typeof distanceMeters !== "number" ||
		!Number.isFinite(distanceMeters) ||
		distanceMeters < 0
	) {
		return null;
	}

	if (
		typeof speedKmh !== "number" ||
		!Number.isFinite(speedKmh) ||
		speedKmh <= 0
	) {
		return null;
	}

	const speedMps = (speedKmh * 1000) / 3600;
	const sec = distanceMeters / speedMps;
	const min = Math.ceil(sec / 60);

	if (distanceMeters < 30 || min < 1) {
		return "< דקה";
	}
	if (min === 1) {
		return "דקה אחת";
	}
	if (min === 2) {
		return "2 דקות";
	}
	return `${min} דקות`;
}

module.exports = { formatEtaMinutes };
