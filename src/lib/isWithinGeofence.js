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

/**
 * Returns true if point `p` lies exactly on the line segment `a`‑`b`.
 * Uses a small epsilon to tolerate floating‑point rounding errors.
 */
function pointOnSegment(p, a, b) {
	const epsilon = 1e-12;

	// Vector cross product should be zero for colinearity
	const cross =
		(b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
	if (Math.abs(cross) > epsilon) {
		return false;
	}

	// Dot product to ensure p is between a and b (inclusive)
	const dot =
		(p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
	if (dot < -epsilon) {
		return false;
	}

	const lenSq =
		(b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
	if (dot - lenSq > epsilon) {
		return false;
	}

	return true;
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

	// 1️⃣  Boundary check – if the point lies on any edge (including vertices) → inside
	const count = vertices.length;
	for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
		if (pointOnSegment(pt, vertices[i], vertices[j])) {
			return true;
		}
	}

	// 2️⃣  Ray‑casting algorithm for strict interior
	let inside = false;
	const px = pt.x;
	const py = pt.y;

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
