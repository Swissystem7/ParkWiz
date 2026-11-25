function formatDurationSeconds(totalSeconds) {
	if (
		typeof totalSeconds !== "number" ||
		!Number.isFinite(totalSeconds) ||
		totalSeconds < 0
	) {
		return "0 שניות";
	}
	const sec = Math.round(totalSeconds);
	if (sec < 60) {
		return `${sec} שניות`;
	}
	if (sec < 120) {
		const s = sec % 60;
		return `1:${String(s).padStart(2, "0")} דקה`;
	}
	if (sec < 3600) {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${String(s).padStart(2, "0")} דקות`;
	}
	const h = Math.floor(sec / 3600);
	const remainder = sec % 3600;
	const m = Math.floor(remainder / 60);
	const s = remainder % 60;
	const timeStr = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	const unit = h === 1 ? "שעה" : "שעות";
	return `${timeStr} ${unit}`;
}

module.exports = { formatDurationSeconds };
