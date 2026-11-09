function formatDriverGuidance(spotId, level = -1, zone = "Blue") {
	if (typeof spotId !== "string" || spotId.trim() === "") {
		return "עקוב אחר שילוט החניון הפנוי";
	}

	const parts = [];

	if (Number.isInteger(level)) {
		if (level < 0) {
			parts.push(`מפלס ${Math.abs(level)}-`);
		} else if (level === 0) {
			parts.push("קומת קרקע");
		} else {
			parts.push(`מפלס ${level}`);
		}
	}

	if (typeof zone === "string" && zone.trim() !== "") {
		parts.push(`אזור ${zone.trim()}`);
	}

	parts.push(`חניה ${spotId.trim()}`);

	return parts.join(", ");
}

module.exports = { formatDriverGuidance };
