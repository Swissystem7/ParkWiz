const ZONE_TRANSLATIONS = Object.freeze({
	blue: "כחול",
	green: "ירוק",
	red: "אדום",
	yellow: "צהוב",
	orange: "כתום",
	purple: "סגול",
});

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
		const translatedZone =
			ZONE_TRANSLATIONS[zone.trim().toLowerCase()] || zone.trim();
		parts.push(`אזור ${translatedZone}`);
	}

	parts.push(`חניה ${spotId.trim()}`);

	return parts.join(", ");
}

module.exports = { formatDriverGuidance, ZONE_TRANSLATIONS };
