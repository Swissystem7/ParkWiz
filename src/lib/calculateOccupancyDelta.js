function calculateOccupancyDelta(previousCount, currentCount) {
	const safe =
		Number.isInteger(previousCount) &&
		Number.isInteger(currentCount) &&
		previousCount >= 0 &&
		currentCount >= 0;
	if (!safe) {
		return { delta: 0, direction: "unchanged", text: "ללא שינוי" };
	}
	const diff = currentCount - previousCount;
	if (diff > 0) {
		return {
			delta: diff,
			direction: "increase",
			text: diff === 1 ? "עלייה של רכב אחד" : `עלייה של ${diff} רכבים`,
		};
	}
	if (diff < 0) {
		const abs = Math.abs(diff);
		return {
			delta: diff,
			direction: "decrease",
			text: abs === 1 ? "ירידה של רכב אחד" : `ירידה של ${abs} רכבים`,
		};
	}
	return { delta: 0, direction: "unchanged", text: "ללא שינוי" };
}
module.exports = { calculateOccupancyDelta };
