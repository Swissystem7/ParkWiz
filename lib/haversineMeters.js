'use strict';

const R = 6371000; // Earth radius in meters
const toRad = (deg) => (deg * Math.PI) / 180;

// haversineMeters: great-circle distance in meters between two lat/lng points.
// Edge cases: identical points -> 0; antipodal points -> ~pi*R; clamps sqrt
// argument to [0,1] so floating-point drift never yields NaN from asin.
function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

module.exports = { haversineMeters };