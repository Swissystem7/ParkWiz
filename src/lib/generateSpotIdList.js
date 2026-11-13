function generateSpotIdList(zoneLetter, startNum = 1, count = 1) {
	if (
		typeof zoneLetter !== "string" ||
		!/^[A-Za-z]$/.test(zoneLetter) ||
		!Number.isInteger(startNum) ||
		startNum < 1 ||
		!Number.isInteger(count) ||
		count < 1 ||
		count > 100 ||
		startNum + count - 1 > 99
	) {
		return [];
	}

	const zone = zoneLetter.toUpperCase();
	const spots = [];
	for (let i = 0; i < count; i += 1) {
		spots.push(`${zone}-${String(startNum + i).padStart(2, "0")}`);
	}
	return spots;
}

module.exports = { generateSpotIdList };
