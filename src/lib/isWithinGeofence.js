function toCoordinate(coord) {
	if (!coord || typeof coord !== "object" || Array.isArray(coord)) {
		return null;
	}

	if (
		typeof coord.x === "number" &&
		Number.isFinite(coord.x) &&
		typeof coord.y === "number" &&
		Number.isFinite(coord.y)
	) {
		return { x: coord.x, y: coord.y };
	}

	if (
		typeof coord.lat === "number" &&
		Number.isFinite(coord.lat) &&
		typeof coord.lng === "number" &&
		Number.isFinite(coord.lng)
	) {
		return { x: coord.lng, y: coord.lat };
	}

	return null;
}

function isWithinGeofence(point, polygon) {
	const pt = toCoordinate(point);
	if (!pt) {
		return false;
	}

	if (!Array.isArray(polygon) || polygon.length < 3) {
		return false;
	}

	const vertices = [];
	for (let i = 0; i < polygon.length; i += 1) {
		const v = toCoordinate(polygon[i]);
		if (!v) {
			return false;
		}
		vertices.push(v);
	}

	let inside = false;
	const px = pt.x;
	const py = pt.y;
	const count = vertices.length;

	for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
		const xi = vertices[i].x;
		const yi = vertices[i].y;
		const xj = vertices[j].x;
		const yj = vertices[j].y;

		if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}

	return inside;
}

module.exports = { isWithinGeofence };
