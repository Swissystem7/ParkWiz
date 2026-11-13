const { isValidParkingLevel } = require("./isValidParkingLevel.js");

function filterSpotsByLevel(spots, targetLevel) {
	if (!Array.isArray(spots) || !isValidParkingLevel(targetLevel)) {
		return [];
	}

	return spots.filter((item) => {
		if (item === null || typeof item !== "object" || Array.isArray(item)) {
			return false;
		}

		const itemLevel = Number.isInteger(item.level) ? item.level : -1;
		return itemLevel === targetLevel;
	});
}

module.exports = { filterSpotsByLevel };
