function roundToTwo(val) {
	const rounded = Math.round(val * 100) / 100;
	return Object.is(rounded, -0) ? 0 : rounded;
}

function computeCameraViewBounds(camX, camY, mountHeight, fovDegrees = 120) {
	if (
		!Number.isFinite(camX) ||
		!Number.isFinite(camY) ||
		!Number.isFinite(mountHeight) ||
		mountHeight <= 0 ||
		!Number.isFinite(fovDegrees) ||
		fovDegrees <= 0 ||
		fovDegrees >= 180
	) {
		return null;
	}

	const rad = (fovDegrees * Math.PI) / 180;
	const radius = mountHeight * Math.tan(rad / 2);

	const minX = roundToTwo(camX - radius);
	const maxX = roundToTwo(camX + radius);
	const minY = roundToTwo(camY - radius);
	const maxY = roundToTwo(camY + radius);
	const coverageDiameter = roundToTwo(radius * 2);

	return {
		minX,
		maxX,
		minY,
		maxY,
		coverageDiameter,
	};
}

module.exports = { computeCameraViewBounds };
