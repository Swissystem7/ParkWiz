function permitZoneMatch(point, zones) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    throw new TypeError('Invalid point: must have lat and lng as numbers');
  }
  if (!Array.isArray(zones)) {
    throw new TypeError('Invalid zones: must be an array');
  }
  function pointInPolygon(px, py, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
  for (const zone of zones) {
    const poly = zone.polygon;
    if (!Array.isArray(poly) || poly.length < 3) continue;
    let valid = true;
    for (const v of poly) {
      if (!Array.isArray(v) || v.length !== 2 || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    if (pointInPolygon(point.lat, point.lng, poly)) {
      return { zoneId: zone.zoneId, name: zone.name, permitTypes: zone.permitTypes };
    }
  }
  return null;
}
module.exports = { permitZoneMatch };
