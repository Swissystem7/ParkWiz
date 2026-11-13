const COLOR_MAP = Object.freeze({
	blue: "blue",
	כחול: "blue",
	green: "green",
	ירוק: "green",
	red: "red",
	אדום: "red",
	yellow: "yellow",
	צהוב: "yellow",
});

function normalizeZoneToken(raw) {
	if (typeof raw !== "string") return null;
	const t = raw.trim().toLowerCase();
	if (!t) return null;
	if (COLOR_MAP[t]) return COLOR_MAP[t];
	return t.toUpperCase();
}

function filterStallsByZone(stalls, targetZone) {
	if (!Array.isArray(stalls)) return [];
	const target = normalizeZoneToken(
		typeof targetZone === "string" ? targetZone : "",
	);
	if (!target) return [];
	const out = [];
	for (const stall of stalls) {
		if (!stall || typeof stall !== "object" || Array.isArray(stall)) continue;
		const zoneTok = normalizeZoneToken(
			typeof stall.zone === "string" ? stall.zone : "",
		);
		const id = typeof stall.id === "string" ? stall.id.trim() : "";
		const idLetter = id ? id[0].toUpperCase() : "";
		const colorTok = normalizeZoneToken(
			typeof stall.color === "string" ? stall.color : "",
		);
		if (zoneTok === target || idLetter === target || colorTok === target) {
			out.push(stall);
		}
	}
	return out;
}

module.exports = { filterStallsByZone };
