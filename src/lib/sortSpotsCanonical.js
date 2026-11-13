const { normalizeSpotId } = require("./normalizeSpotId");

function sortSpotsCanonical(spots) {
	if (!Array.isArray(spots)) {
		return [];
	}

	const decorated = spots.map((item, index) => {
		if (item === null || typeof item !== "object" || Array.isArray(item)) {
			return { item, index, valid: false };
		}

		const normalized = normalizeSpotId(item.id);
		if (!normalized) {
			return { item, index, valid: false };
		}

		const zone = normalized.charAt(0);
		const cell = Number(normalized.slice(2));

		return { item, index, valid: true, zone, cell };
	});

	decorated.sort((a, b) => {
		if (a.valid && !b.valid) {
			return -1;
		}
		if (!a.valid && b.valid) {
			return 1;
		}
		if (!a.valid && !b.valid) {
			return a.index - b.index;
		}

		if (a.zone !== b.zone) {
			return a.zone < b.zone ? -1 : 1;
		}

		if (a.cell !== b.cell) {
			return a.cell - b.cell;
		}

		return a.index - b.index;
	});

	return decorated.map((entry) => entry.item);
}

module.exports = { sortSpotsCanonical };
