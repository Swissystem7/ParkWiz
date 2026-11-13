function computeTurnAngleDegrees(headingFromDeg, headingToDeg) {
	const from = Number(headingFromDeg);
	const to = Number(headingToDeg);
	if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
	let delta = (to - from) % 360;
	if (delta > 180) delta -= 360;
	if (delta <= -180) delta += 360;
	return Math.round(delta * 10) / 10;
}
module.exports = { computeTurnAngleDegrees };
