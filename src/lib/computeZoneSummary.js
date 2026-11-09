function createCounter() {
	return { total: 0, free: 0, occupied: 0, unknown: 0 };
}

function computeZoneSummary(spots) {
	const total = createCounter();
	const zones = {};

	if (!Array.isArray(spots)) {
		return { total, zones };
	}

	spots.forEach((item) => {
		if (item === null || typeof item !== "object") {
			return;
		}

		let zone = typeof item.zone === "string" ? item.zone.trim() : "";
		if (!zone) {
			const id = typeof item.id === "string" ? item.id : "";
			zone = id ? id[0] : "DEFAULT";
			if (/^[a-z]$/i.test(zone)) {
				zone = zone.toUpperCase();
			}
		}

		if (!Object.hasOwn(zones, zone)) {
			zones[zone] = createCounter();
		}

		const status =
			typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
		const counter =
			status === "free" || status === "occupied" ? status : "unknown";
		zones[zone].total += 1;
		zones[zone][counter] += 1;
		total.total += 1;
		total[counter] += 1;
	});

	return { total, zones };
}

module.exports = { computeZoneSummary };
