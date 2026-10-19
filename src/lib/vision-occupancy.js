// ParkWiz — real occupancy from real camera frames, decided in the browser.
//
// This is the half of the camera demo that has to be correct: it turns the
// vehicle boxes a frame produced (via an in-browser detector such as
// TensorFlow.js COCO-SSD) into per-spot occupied/free state. It never touches
// the DOM, loads no model and sees no pixel — the page hands it boxes, it
// answers which spots changed — so the geometry and the debounce stay
// testable in node, away from WebGL. Privacy here is structural, not a
// promise: a detection is a class label, a box and a score, and no plate,
// crop or identity ever enters this pipeline.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizVisionOccupancy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // COCO classes that can occupy a bay. 'person' and 'bicycle' are
  // deliberately absent: a pedestrian crossing the aisle must not fill a spot.
  const VEHICLE_CLASSES = Object.freeze(['car', 'truck', 'bus', 'motorcycle']);
  const MIN_SCORE = 0.4;
  // Share of a spot a vehicle box must cover before the spot counts as taken.
  const DEFAULT_OVERLAP = 0.3;
  // Consecutive frames a changed state must hold before it is reported. The
  // detector drops a parked car for a frame or two when someone walks past;
  // without this, every blink fires a spot-freed event at the operator.
  const DEFAULT_DEBOUNCE = 3;
  // A box over this share of the frame is a detector artefact (a wall read as
  // a bus). Honouring it paints every spot red at once.
  const MAX_BOX_AREA = 0.45;
  // Smaller than this in either axis and a drag was a mis-click, not a bay.
  const MIN_SPOT_SIZE = 0.02;
  // The centroid shortcut below only applies to a box that is mostly inside
  // the spot. Without this floor, a car driving the aisle whose centre grazes
  // a bay's painted edge would claim the whole bay.
  const CENTROID_MIN_INSIDE = 0.5;

  function clamp01(n) {
    const v = Number(n);
    return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }

  function rect(o) {
    const x = clamp01(o && o.x), y = clamp01(o && o.y);
    return { x, y, w: Math.min(1 - x, clamp01(o && o.w)), h: Math.min(1 - y, clamp01(o && o.h)) };
  }

  // COCO-SSD reports pixel boxes against the frame it was given. Spots are
  // stored normalized (0..1) so one calibration survives a resized canvas, a
  // rotated phone and a camera that changes resolution. Convert once, here.
  function normalizeDetections(preds, opts) {
    const o = opts || {};
    const fw = Number(o.frameWidth) > 0 ? Number(o.frameWidth) : 1;
    const fh = Number(o.frameHeight) > 0 ? Number(o.frameHeight) : 1;
    const minScore = o.minScore != null ? Number(o.minScore) : MIN_SCORE;
    const allowed = new Set(o.classes || VEHICLE_CLASSES);
    const out = [];
    for (const p of Array.isArray(preds) ? preds : []) {
      if (!p) continue;
      const cls = String(p.class != null ? p.class : (p.cls || '')).toLowerCase();
      const score = Number(p.score != null ? p.score : p.confidence) || 0;
      if (!allowed.has(cls) || score < minScore) continue;
      const bb = Array.isArray(p.bbox) ? p.bbox : null;
      const box = bb
        ? rect({ x: bb[0] / fw, y: bb[1] / fh, w: bb[2] / fw, h: bb[3] / fh })
        : rect(p);
      if (box.w <= 0 || box.h <= 0 || box.w * box.h > MAX_BOX_AREA) continue;
      out.push({ x: box.x, y: box.y, w: box.w, h: box.h, cls, score });
    }
    return out;
  }

  function centroidIn(box, s) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    return cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h;
  }

  // How strongly one box claims one spot, 0..1: the share of the spot it
  // covers. A car parked nose-in covers most of its bay; a car driving the
  // aisle clips the near edge of two bays and claims neither. A car sitting
  // inside a bay that is painted larger than the car covers too little of it
  // to pass on coverage alone, so a box that is both centred in the spot and
  // mostly inside it claims the spot outright.
  function boxSpotScore(box, spot) {
    const s = rect(spot);
    const area = s.w * s.h;
    if (area <= 0 || !box) return 0;
    const ix = Math.max(0, Math.min(box.x + box.w, s.x + s.w) - Math.max(box.x, s.x));
    const iy = Math.max(0, Math.min(box.y + box.h, s.y + s.h) - Math.max(box.y, s.y));
    const inter = ix * iy;
    if (inter <= 0) return 0;
    const boxArea = Math.max(0, box.w) * Math.max(0, box.h);
    const inside = boxArea > 0 ? inter / boxArea : 0;
    if (centroidIn(box, s) && inside >= CENTROID_MIN_INSIDE) return 1;
    return inter / area;
  }

  // Two drag corners -> one spot, in the same schema as pilot/sample-spots.json
  // so a calibration drawn over a live frame also loads in the pilot kit.
  function spotFromDrag(a, b, id) {
    const x1 = clamp01(a && a.x), y1 = clamp01(a && a.y);
    const x2 = clamp01(b && b.x), y2 = clamp01(b && b.y);
    const w = Number(Math.abs(x2 - x1).toFixed(4)), h = Number(Math.abs(y2 - y1).toFixed(4));
    if (w < MIN_SPOT_SIZE || h < MIN_SPOT_SIZE) return null;
    return {
      id: String(id), w, h,
      x: Number(Math.min(x1, x2).toFixed(4)),
      y: Number(Math.min(y1, y2).toFixed(4)),
    };
  }

  // Per-spot state machine over a stream of frames. update() is the only way
  // state moves and it reports the transitions it just made, so the page can
  // fire parkwiz:spot-freed exactly once per real freeing.
  function createTracker(spots, opts) {
    const o = opts || {};
    const threshold = o.threshold != null ? Number(o.threshold) : DEFAULT_OVERLAP;
    const debounceFrames = Math.max(1, Math.round(
      o.debounceFrames != null ? o.debounceFrames : DEFAULT_DEBOUNCE
    ));
    let lanes = [];

    function setSpots(list) {
      lanes = (Array.isArray(list) ? list : []).map((sp, i) => ({
        id: String(sp && sp.id != null ? sp.id : 's' + (i + 1)),
        box: rect(sp || {}),
        occupied: false, // the reported, debounced state
        pending: false,  // the state the most recent frames argue for
        streak: 0,
        score: 0,
      }));
    }

    function snapshot(ts) {
      const occupied = lanes.filter((l) => l.occupied).length;
      const total = lanes.length;
      return {
        ts: ts != null ? String(ts) : new Date().toISOString(),
        total,
        occupied,
        free: total - occupied,
        rate: total > 0 ? occupied / total : 0,
        spots: lanes.map((l) => ({
          id: l.id, occupied: l.occupied, score: Number(l.score.toFixed(3)),
          x: l.box.x, y: l.box.y, w: l.box.w, h: l.box.h,
        })),
      };
    }

    function update(boxes, ts) {
      const list = Array.isArray(boxes) ? boxes : [];
      const freed = [], taken = [];
      for (const lane of lanes) {
        let best = 0;
        for (const b of list) {
          const s = boxSpotScore(b, lane.box);
          if (s > best) best = s;
        }
        lane.score = best;
        const seen = best >= threshold;
        if (seen === lane.pending) lane.streak += 1;
        else { lane.pending = seen; lane.streak = 1; }
        if (lane.pending !== lane.occupied && lane.streak >= debounceFrames) {
          lane.occupied = lane.pending;
          (lane.occupied ? taken : freed).push(lane.id);
        }
      }
      const state = snapshot(ts);
      state.freed = freed;
      state.taken = taken;
      return state;
    }

    setSpots(spots);
    return { update, snapshot, setSpots, threshold, debounceFrames };
  }

  // Shape a live reading as one src/lib/occupancy.js record, so the session
  // chart reads real detections through the same schema as the heuristic
  // pilot — one definition of what an occupancy reading is.
  function toRecord(state, opts) {
    const o = opts || {}, s = state || {};
    return {
      ts: s.ts || new Date().toISOString(),
      street: o.street || 'מצלמה מקומית',
      total: Number(s.total) || 0,
      occupied: Number(s.occupied) || 0,
      source: o.source || 'camera',
      confidence: o.confidence != null ? Number(o.confidence) : 0,
    };
  }

  return {
    VEHICLE_CLASSES, MIN_SCORE, DEFAULT_OVERLAP, DEFAULT_DEBOUNCE,
    MAX_BOX_AREA, MIN_SPOT_SIZE, CENTROID_MIN_INSIDE,
    normalizeDetections, boxSpotScore, spotFromDrag, createTracker, toRecord,
  };
});
