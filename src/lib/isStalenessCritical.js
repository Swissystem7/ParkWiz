function isStalenessCritical(dataAgeSec, criticalThresholdSec = 180) {
	const age = Number(dataAgeSec);
	const thr = Number(criticalThresholdSec);
	const threshold = Number.isFinite(thr) && thr > 0 ? thr : 180;
	if (!Number.isFinite(age) || age < 0) {
		return {
			isCritical: true,
			ageSec: Number.isFinite(age) ? Math.round(age) : null,
			alarmLevel: "critical",
		};
	}
	const ageSec = Math.round(age);
	if (age > threshold) {
		return { isCritical: true, ageSec, alarmLevel: "critical" };
	}
	if (age > 60) {
		return { isCritical: false, ageSec, alarmLevel: "stale" };
	}
	return { isCritical: false, ageSec, alarmLevel: "nominal" };
}
module.exports = { isStalenessCritical };
