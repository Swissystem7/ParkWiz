function formatZoneGuidanceSummary(input) {
	if (input === null || typeof input !== "object" || Array.isArray(input))
		return [];
	const zones =
		input.zones &&
		typeof input.zones === "object" &&
		!Array.isArray(input.zones)
			? input.zones
			: input;
	if (zones === null || typeof zones !== "object" || Array.isArray(zones))
		return [];
	const keys = Object.keys(zones).sort();
	const lines = [];
	for (const zone of keys) {
		const entry = zones[zone];
		if (!entry || typeof entry !== "object") continue;
		const free = Number(entry.free);
		const total = Number(entry.total);
		if (!Number.isFinite(free) || !Number.isFinite(total)) continue;
		if (free === 0) {
			lines.push(`אזור ${zone}: מלא`);
		} else {
			lines.push(`אזור ${zone}: ${free} פנויות מתוך ${total}`);
		}
	}
	return lines;
}

module.exports = { formatZoneGuidanceSummary };
