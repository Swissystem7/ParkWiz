function isValidParkingLevel(level, minLevel = -5, maxLevel = 5) {
	if (
		!Number.isInteger(level) ||
		!Number.isInteger(minLevel) ||
		!Number.isInteger(maxLevel) ||
		minLevel > maxLevel
	) {
		return false;
	}

	return level >= minLevel && level <= maxLevel;
}

module.exports = { isValidParkingLevel };
