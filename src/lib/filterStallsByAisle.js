const { extractZoneFromSpotId } = require("./extractZoneFromSpotId");

function normalizeAisle(aisle) {
	if (typeof aisle === "string") {
		return aisle.trim().toUpperCase();
	}
	if (typeof aisle === "number" && Number.isFinite(aisle)) {
		return String(aisle);
	}
	return null;
}

function filterStallsByAisle(stalls, targetAisle) {
	if (
		!Array.isArray(stalls) ||
		typeof targetAisle !== "string" ||
		targetAisle.trim() === ""
	) {
		return [];
	}

	const cleanTarget = targetAisle.trim().toUpperCase();

	const result = [];
	for (const stall of stalls) {
		if (stall === null || typeof stall !== "object" || Array.isArray(stall)) {
			continue;
		}

		const aisleMatch = normalizeAisle(stall.aisle) === cleanTarget;
		const idZone = extractZoneFromSpotId(stall.id);
		const idMatch = idZone === cleanTarget;

		if (aisleMatch || idMatch) {
			result.push(stall);
		}
	}

	return result;
}

module.exports = { filterStallsByAisle };
