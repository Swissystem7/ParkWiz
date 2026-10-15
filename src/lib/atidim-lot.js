// ParkWiz — Park Atidim (CityZone) parking-lot occupancy model.
// Pure functions, zero dependencies, UMD pattern.
// Specifically tailored for lot operators (camera stream overlay, occupancy stats, hourly curve).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAtidimLot = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ATIDIM_LOT = Object.freeze({
    id: 'atidim',
    name: 'חניון פארק עתידים — תל אביב',
    operator: 'Park Atidim / CityZone',
    totalCapacity: 220,
    zones: [
      { id: 'A', name: 'אזור A (קרקע)', capacity: 80 },
      { id: 'B', name: 'אזור B (מפלס -1)', capacity: 90 },
      { id: 'C', name: 'אזור C (מתחם 7)', capacity: 50 },
    ],
    cameras: [
      { id: 'cam-01', name: 'מצלמה 01 · כניסה מזרחית', spotsMonitored: 24, streamType: 'RTSP/ONVIF' },
      { id: 'cam-02', name: 'מצלמה 02 · מפלס תחתון -1', spotsMonitored: 30, streamType: 'RTSP/ONVIF' },
      { id: 'cam-03', name: 'מצלמה 03 · מתחם עתידים 7', spotsMonitored: 26, streamType: 'RTSP/ONVIF' },
    ],
  });

  // Typical hourly occupancy curve at Park Atidim (commercial / hi-tech park)
  // Rates between 0.0 and 1.0 (clamped).
  const HOURLY_RATES = Object.freeze([
    0.08, 0.06, 0.05, 0.05, 0.06, 0.09, // 00:00 - 05:00
    0.18, 0.42, 0.76, 0.89, 0.92, 0.91, // 06:00 - 11:00
    0.90, 0.88, 0.86, 0.82, 0.70, 0.52, // 12:00 - 17:00
    0.34, 0.22, 0.16, 0.14, 0.11, 0.09, // 18:00 - 23:00
  ]);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function getHourlyCurve(capacity = ATIDIM_LOT.totalCapacity) {
    const cap = Math.max(1, Math.round(Number(capacity) || ATIDIM_LOT.totalCapacity));
    return HOURLY_RATES.map((rate, hour) => {
      const occupied = Math.round(rate * cap);
      return {
        hour,
        label: (hour < 10 ? '0' : '') + hour + ':00',
        rate,
        percentage: Math.round(rate * 100),
        occupied,
        available: Math.max(0, cap - occupied),
        isPeak: rate >= 0.85,
      };
    });
  }

  // Initial camera view spots (normalized coordinates 0..1 for responsive canvas overlay)
  function createDefaultCameraSpots() {
    const spots = [];
    const rows = 2;
    const cols = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = 'A-' + (r * cols + c + 1).toString().padStart(2, '0');
        // Perspective layout coordinates
        const x = 0.06 + c * 0.075;
        const y = r === 0 ? 0.38 : 0.62;
        const w = 0.065;
        const h = r === 0 ? 0.18 : 0.26;
        // Seed initial occupancy: ~65% occupied
        const isOccupied = ((c * 3 + r * 5 + 2) % 7) > 2;
        spots.push({
          id,
          x,
          y,
          w,
          h,
          occupied: isOccupied,
          confidence: 0.91 + ((c + r) % 8) * 0.01,
        });
      }
    }
    return spots;
  }

  function calculateOccupancy(spots, lotCapacity = ATIDIM_LOT.totalCapacity) {
    const list = Array.isArray(spots) ? spots : [];
    const capacity = Math.max(1, Math.round(Number(lotCapacity) || ATIDIM_LOT.totalCapacity));
    const occupiedInView = list.filter((s) => Boolean(s && s.occupied)).length;
    const totalInView = list.length;
    const viewRate = totalInView > 0 ? occupiedInView / totalInView : 0;

    // Extrapolate to whole lot if spots represent a sample zone, or use direct if capacity matches
    const estimatedLotOccupied = totalInView === capacity
      ? occupiedInView
      : Math.round(viewRate * capacity);
    const clampedOccupied = clamp(estimatedLotOccupied, 0, capacity);
    const available = capacity - clampedOccupied;

    return {
      capacity,
      totalInView,
      occupiedInView,
      availableInView: Math.max(0, totalInView - occupiedInView),
      estimatedLotOccupied: clampedOccupied,
      available,
      rate: Number((clampedOccupied / capacity).toFixed(3)),
      percentage: Math.round((clampedOccupied / capacity) * 100),
      status: clampedOccupied / capacity > 0.9 ? 'full' : (clampedOccupied / capacity > 0.75 ? 'busy' : 'available'),
      statusHe: clampedOccupied / capacity > 0.9 ? 'עמוס מאוד' : (clampedOccupied / capacity > 0.75 ? 'תפוסה בינונית' : 'זמינות גבוהה'),
    };
  }

  // Simulate a single arrival or departure event
  function transitionSpot(spots, action = 'toggle') {
    if (!Array.isArray(spots) || spots.length === 0) return [];
    const next = spots.map((s) => Object.assign({}, s));
    if (action === 'arrive') {
      const free = next.filter((s) => !s.occupied);
      if (free.length > 0) {
        const target = free[Math.floor(Math.random() * free.length)];
        target.occupied = true;
        target.confidence = 0.95;
      }
    } else if (action === 'leave') {
      const taken = next.filter((s) => s.occupied);
      if (taken.length > 0) {
        const target = taken[Math.floor(Math.random() * taken.length)];
        target.occupied = false;
        target.confidence = 0.94;
      }
    } else {
      // Toggle a random spot
      const idx = Math.floor(Math.random() * next.length);
      next[idx].occupied = !next[idx].occupied;
    }
    return next;
  }

  // Strict Privacy Checker: Ensures payload complies with zero-PII / zero-LPR mandate
  const FORBIDDEN_PII = ['plate', 'licensePlate', 'lpr', 'alpr', 'face', 'identity', 'imageBlob', 'videoChunk', 'macAddress'];

  function validatePrivacyCompliance(record) {
    if (!record || typeof record !== 'object') return { valid: true, violations: [] };
    const violations = [];
    for (const key of Object.keys(record)) {
      const lower = key.toLowerCase();
      for (const forbidden of FORBIDDEN_PII) {
        if (lower.includes(forbidden.toLowerCase())) {
          violations.push(key);
        }
      }
    }
    return {
      valid: violations.length === 0,
      violations,
    };
  }

  return {
    ATIDIM_LOT,
    HOURLY_RATES,
    getHourlyCurve,
    createDefaultCameraSpots,
    calculateOccupancy,
    transitionSpot,
    validatePrivacyCompliance,
  };
});
