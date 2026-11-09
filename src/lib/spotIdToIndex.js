function spotIdToIndex(spotId) {
	if (typeof spotId !== "string") return -1;
	const m = /^([A-Za-z]+)-?(\d+)$/.exec(spotId.trim());
	if (!m) return -1;
	const num = Number(m[2]);
	if (!Number.isInteger(num) || num < 1) return -1;
	return num - 1;
}
module.exports = { spotIdToIndex };
// round-17 CI nudge
