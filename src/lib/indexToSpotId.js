function indexToSpotId(index, zoneLetter) {
	if (arguments.length < 2) zoneLetter = "A";
	if (!Number.isInteger(index) || index < 0 || index > 98) return null;
	if (typeof zoneLetter !== "string" || !/^[A-Za-z]$/.test(zoneLetter)) return null;
	const spotNum = index + 1;
	return `${zoneLetter.toUpperCase()}-${String(spotNum).padStart(2, "0")}`;
}
module.exports = { indexToSpotId };
