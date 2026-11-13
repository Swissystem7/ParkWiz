const { parseSpotCoordinates } = require("./parseSpotCoordinates");

function readXY(stall) {
	if (!stall || typeof stall !== "object" || Array.isArray(stall)) return null;
	if (
		stall.x !== undefined &&
		stall.x !== null &&
		stall.y !== undefined &&
		stall.y !== null
	) {
		const x = Number(stall.x);
		const y = Number(stall.y);
		if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
	}
	const parsed = parseSpotCoordinates(stall);
	if (
		parsed &&
		Number.isFinite(parsed.x) &&
		Number.isFinite(parsed.y)
	) {
		return { x: parsed.x, y: parsed.y };
	}
	return null;
}

function computeAisleCentroid(stalls) {
	if (!Array.isArray(stalls) || stalls.length === 0) return null;
	let sumX = 0;
	let sumY = 0;
	let n = 0;
	for (const stall of stalls) {
		const xy = readXY(stall);
		if (!xy) continue;
		sumX += xy.x;
		sumY += xy.y;
		n += 1;
	}
	if (!n) return null;
	return {
		x: Math.round((sumX / n) * 100) / 100,
		y: Math.round((sumY / n) * 100) / 100,
		stallCount: n,
	};
}

module.exports = { computeAisleCentroid };
