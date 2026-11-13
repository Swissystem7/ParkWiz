function normalizeSpotId(rawId) {
	if (typeof rawId !== "string" || rawId.trim() === "") {
		return null;
	}

	const match = rawId.trim().match(/^([a-z])[\s_-]?0*(\d{1,2})$/i);
	if (!match) {
		return null;
	}

	const num = Number(match[2]);
	if (num < 1 || num > 99) {
		return null;
	}

	return `${match[1].toUpperCase()}-${String(num).padStart(2, "0")}`;
}

module.exports = { normalizeSpotId };
