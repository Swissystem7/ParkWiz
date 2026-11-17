function spotIdToIndex(spotId) {
	if (typeof spotId !== "string") return -1;
	const trimmed = spotId.trim();
	if (!trimmed) return -1;
	const m = /^([A-Za-z]+)-?(\d+)$/.exec(trimmed);
	if (!m) return -1;
	const num = Number(m[2]);
	if (!Number.isSafeInteger(num) || num < 1) return -1;
	return num - 1;
}
module.exports = { spotIdToIndex };
// round-17 CI recover 20261109-203016
