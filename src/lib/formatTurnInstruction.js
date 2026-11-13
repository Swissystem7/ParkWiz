function formatTurnInstruction(turnAngleDeg, thresholdDeg = 25) {
	const angle = Number(turnAngleDeg);
	const threshold = Number(thresholdDeg);
	const thr = Number.isFinite(threshold) ? Math.abs(threshold) : 25;
	const a = Number.isFinite(angle) ? angle : 0;
	const absAngle = Math.abs(a);
	let action = "straight";
	let textHe = "המשך ישר";
	if (absAngle <= thr) {
		action = "straight";
		textHe = "המשך ישר";
	} else if (absAngle > 120) {
		action = "u-turn";
		textHe = "פנה פניית פרסה";
	} else if (a > 0) {
		action = "right";
		textHe = "פנה ימינה";
	} else {
		action = "left";
		textHe = "פנה שמאלה";
	}
	return { action, textHe, angleDeg: Math.round(a * 10) / 10 };
}
module.exports = { formatTurnInstruction };
