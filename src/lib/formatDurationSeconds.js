function formatDurationSeconds(totalSeconds) {
	if (
		typeof totalSeconds !== "number" ||
		!Number.isFinite(totalSeconds) ||
		totalSeconds < 0
	) {
		return "0 שניות";
	}
	const sec = Math.round(totalSeconds);
	if (sec < 60) return `${sec} שניות`;
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, "0")} דקות`;
}
module.exports = { formatDurationSeconds };
// round-17 CI nudge
