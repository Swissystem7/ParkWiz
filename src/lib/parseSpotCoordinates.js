function parseCoordinate(value) {
	if (typeof value !== "number" && typeof value !== "string") {
		return null;
	}
	if (typeof value === "string" && value.trim() === "") {
		return null;
	}
	const num = Number(value);
	if (!Number.isFinite(num)) {
		return null;
	}
	return num;
}

function parseSpotCoordinates(spotRecord) {
	if (
		spotRecord === null ||
		typeof spotRecord !== "object" ||
		Array.isArray(spotRecord)
	) {
		return null;
	}

	let rawX;
	let rawY;

	if (
		spotRecord.x !== undefined &&
		spotRecord.x !== null &&
		spotRecord.y !== undefined &&
		spotRecord.y !== null
	) {
		rawX = spotRecord.x;
		rawY = spotRecord.y;
	} else if (
		Array.isArray(spotRecord.coords) &&
		spotRecord.coords.length >= 2
	) {
		rawX = spotRecord.coords[0];
		rawY = spotRecord.coords[1];
	} else if (
		spotRecord.location !== null &&
		typeof spotRecord.location === "object" &&
		!Array.isArray(spotRecord.location) &&
		spotRecord.location.x !== undefined &&
		spotRecord.location.x !== null &&
		spotRecord.location.y !== undefined &&
		spotRecord.location.y !== null
	) {
		rawX = spotRecord.location.x;
		rawY = spotRecord.location.y;
	} else {
		return null;
	}

	const x = parseCoordinate(rawX);
	const y = parseCoordinate(rawY);

	if (x === null || y === null) {
		return null;
	}

	return { x, y };
}

module.exports = { parseSpotCoordinates };
