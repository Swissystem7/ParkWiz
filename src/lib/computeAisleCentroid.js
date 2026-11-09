const { parseSpotCoordinates } = require("./parseSpotCoordinates");

function computeAisleCentroid(stalls) {
	if (!Array.isArray(stalls) || stalls.length === 0) return null;
	let sumX = 0;
	let sumY = 0;
	let n = 0;
	for (const stall of stalls) {
		if (!stall || typeof stall !== "object" || Array.isArray(stall)) continue;
		let x = null;
		let y = null;
		if (Number.isFinite(Number(stall.x)) && Number.isFinite(Number(stall.y))) {
			x = Number(stall.x);
			y = Number(stall.y);
		} else {
			const parsed = parseSpotCoordinates(stall);
			if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
				x = parsed.x;
				y = parsed.y;
			}
		}
		if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
			continue;
		}
		sumX += x;
		sumY += y;
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
