function formatAisleDisplay(level, zone, freeCount) {
	let levelStr;
	if (typeof level === "number" && Number.isInteger(level)) {
		if (level < 0) {
			levelStr = `מפלס ${Math.abs(level)}-`;
		} else if (level === 0) {
			levelStr = "קומת קרקע";
		} else {
			levelStr = `מפלס ${level}`;
		}
	} else {
		levelStr = "מפלס לא ידוע";
	}

	let zoneStr;
	if (typeof zone === "string") {
		const trimmed = zone.trim();
		if (trimmed === "") {
			zoneStr = "?";
		} else {
			const lower = trimmed.toLowerCase();
			if (lower === "blue") {
				zoneStr = "כחול";
			} else if (lower === "green") {
				zoneStr = "ירוק";
			} else {
				zoneStr = trimmed;
			}
		}
	} else {
		zoneStr = "?";
	}

	let statusStr;
	if (
		typeof freeCount !== "number" ||
		!Number.isFinite(freeCount) ||
		freeCount <= 0
	) {
		statusStr = "מלא";
	} else {
		const floored = Math.floor(freeCount);
		if (floored <= 0) {
			statusStr = "מלא";
		} else if (floored === 1) {
			statusStr = "חניה אחת פנויה";
		} else {
			statusStr = `${floored} פנויות`;
		}
	}

	return `${levelStr} | אזור ${zoneStr}: ${statusStr}`;
}

module.exports = { formatAisleDisplay };
