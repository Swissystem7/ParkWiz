function enforcementRoute(violations, start, maxStops = 10) {
  if (!Array.isArray(violations)) throw new TypeError("violations must be an array");
  if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lng) || Math.abs(start.lat) > 90 || Math.abs(start.lng) > 180) throw new TypeError("invalid start");

  maxStops = Number.isFinite(maxStops) ? Math.max(1, Math.min(50, Math.floor(maxStops))) : 10;

  const valid = violations.filter(v => 
    v && typeof v.lat === "number" && typeof v.lng === "number" && 
    isFinite(v.lat) && isFinite(v.lng) && 
    v.lat >= -90 && v.lat <= 90 && v.lng >= -180 && v.lng <= 180
  );

  if (valid.length === 0) return [];

  const toRad = deg => deg * Math.PI / 180;
  const haversineKm = (p1, p2) => {
    const R = 6371;
    const dLat = toRad(p2.lat - p1.lat);
    const dLng = toRad(p2.lng - p1.lng);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const visited = [];
  const used = new Set();
  let current = { lat: start.lat, lng: start.lng };
  let cumKm = 0;

  for (let step = 0; step < maxStops; step++) {
    let best = null;
    let bestScore = -Infinity;
    let bestIdx = -1;

    for (let i = 0; i < valid.length; i++) {
      if (used.has(i)) continue;
      const v = valid[i];
      const dist = haversineKm(current, v);
      const score = v.severity / (1 + dist);
      if (score > bestScore || (score === bestScore && String(v.id).localeCompare(String(best?.violation.id)) < 0)) {
        bestScore = score;
        best = v;
        bestIdx = i;
        best = { violation: v, dist };
      }
    }

    if (best === null) break;

    used.add(bestIdx);
    const legKm = Math.round(best.dist * 100) / 100;
    cumKm = Math.round((cumKm + legKm) * 100) / 100;
    visited.push({
      id: best.violation.id,
      lat: best.violation.lat,
      lng: best.violation.lng,
      legKm: legKm,
      cumKm: cumKm
    });
    current = { lat: best.violation.lat, lng: best.violation.lng };
  }

  return visited;
}

module.exports = { enforcementRoute };
