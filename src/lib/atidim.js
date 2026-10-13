// ParkWiz — Park Atidim lot model: spot inventory, hourly demand curve and
// synthetic occupancy transitions.
//
// Nothing here is a sensor, a camera or a survey. The lot layout in
// pilot/atidim-lot.json is a schematic drawn for the demo, and every occupancy
// number this module returns is generated from the curve below. A page showing
// it must say so, exactly like the rest of the pilot surfaces.
//
// The three public functions:
//
//   parseLotSpots(lot)        — validate a lot file into a flat bay list.
//   getHourlyCurve(opts)      — the 24-hour demand shape of an office park.
//   simulateOccupancyStep(..) — advance a lot state one tick toward the curve.
//
// There is no Math.random here, and there must never be: a demo that reshuffles
// the lot on every render cannot be screenshotted, compared or reviewed. Every
// transition comes from a hash of (seed, step, spot id), so the same seed
// replays the same day down to the individual bay.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAtidim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LOT_FILE = 'pilot/atidim-lot.json';

  // 08:00–17:00 is the paid/contested window of an office park: the hour a
  // commuter arrives and the hour the lot starts draining. Both ends included.
  const PEAK_START_HOUR = 8;
  const PEAK_END_HOUR = 17;

  // Occupancy as a fraction of capacity, index = local hour 0..23.
  // Sun–Thu is the Israeli work week, so the workday curve is the common case.
  const WORKDAY_CURVE = Object.freeze([
    0.06, 0.05, 0.05, 0.04, 0.05, 0.08, 0.15, 0.42,
    0.78, 0.92, 0.95, 0.96, 0.93, 0.94, 0.95, 0.90, 0.80, 0.60,
    0.35, 0.20, 0.14, 0.10, 0.08, 0.06,
  ]);
  // Friday is a short day: the same morning ramp, but it empties by early
  // afternoon instead of at 17:00.
  const FRIDAY_CURVE = Object.freeze([
    0.04, 0.04, 0.03, 0.03, 0.04, 0.05, 0.08, 0.18,
    0.34, 0.42, 0.44, 0.40, 0.30, 0.18, 0.10, 0.07, 0.06, 0.05,
    0.05, 0.06, 0.06, 0.05, 0.04, 0.04,
  ]);
  // Saturday: a handful of cars left overnight plus a thin daytime trickle.
  const SATURDAY_CURVE = Object.freeze([
    0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03,
    0.04, 0.05, 0.07, 0.08, 0.08, 0.07, 0.06, 0.06, 0.05, 0.05,
    0.05, 0.05, 0.04, 0.04, 0.03, 0.03,
  ]);

  // Day index matches availability-model.js: 0 = Sunday .. 6 = Saturday.
  // Sunday starts the week slightly softer, Thursday leaves earlier.
  const WORKDAY_FACTOR = Object.freeze({ 0: 0.97, 1: 1, 2: 1, 3: 0.99, 4: 0.95 });
  const DEFAULT_DAY = 1;

  // A bay whose `kind` is absent is a plain bay; a bay whose kind is a typo is
  // skipped rather than quietly counted as one.
  const SPOT_KINDS = Object.freeze(['regular', 'reserved', 'ev', 'accessible']);
  const KIND_LABELS = Object.freeze({
    regular: 'רגיל',
    reserved: 'מוקצה לדייר',
    ev: 'עמדת טעינה',
    accessible: 'חנייה נגישה',
  });
  // Fill order, lowest first. Permit-only bays stay free while general bays are
  // still available, so a full lot is the only reason to see them taken.
  const KIND_FILL_TIER = Object.freeze({ regular: 0, reserved: 0, ev: 1, accessible: 2 });

  const DEFAULT_STEP_MINUTES = 15;
  // Share of capacity that changes hands within an hour on top of the net
  // move toward the curve — visitors, lunch runs, a car swapping bays.
  const DEFAULT_CHURN_PER_HOUR = 0.06;
  const OFF_PEAK_CHURN_FACTOR = 0.4;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round3 = (value) => Math.round(value * 1000) / 1000;

  function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function hash32(n) {
    let x = (n + 0x9e3779b9) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  // FNV-1a over the id, then avalanched with the step so consecutive ticks pick
  // unrelated bays instead of walking down the row in order.
  function hashSpot(id, step, seed) {
    let h = 0x811c9dc5;
    const text = String(id);
    for (let i = 0; i < text.length; i++) {
      h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    }
    return hash32((h ^ hash32(finiteOr(step, 0) | 0)) + (finiteOr(seed, 0) | 0));
  }

  // ---------------------------------------------------------------- lot data

  function normalizeHour(hour) {
    const h = Math.floor(finiteOr(hour, 0));
    return ((h % 24) + 24) % 24;
  }

  // 0 = Sunday .. 6 = Saturday. Anything else is a workday: Number(null) is 0,
  // so a missing day would otherwise silently become Sunday's curve.
  function normalizeDay(day) {
    let d = NaN;
    if (typeof day === 'number') d = day;
    else if (typeof day === 'string' && day.trim() !== '') d = Number(day);
    if (!Number.isInteger(d) || d < 0 || d > 6) return DEFAULT_DAY;
    return d;
  }

  function isPeakHour(hour) {
    const h = normalizeHour(hour);
    return h >= PEAK_START_HOUR && h <= PEAK_END_HOUR;
  }

  function emptyLot(errors) {
    return {
      lotId: null,
      name: null,
      source: null,
      note: null,
      image: null,
      zones: [],
      spots: [],
      capacity: 0,
      byZone: {},
      byKind: {},
      skipped: [],
      errors,
    };
  }

  // A bay rect is stored as image fractions in 0..1, same convention as
  // pilot/sample-spots.json and src/lib/heuristic.js.
  const RECT_EPS = 1e-9;

  function rectProblem(rect) {
    for (const key of ['x', 'y', 'w', 'h']) {
      if (!Number.isFinite(Number(rect[key]))) return 'bad-rect';
    }
    if (Number(rect.w) <= 0 || Number(rect.h) <= 0) return 'bad-rect';
    if (Number(rect.x) < -RECT_EPS || Number(rect.y) < -RECT_EPS) return 'out-of-frame';
    if (Number(rect.x) + Number(rect.w) > 1 + RECT_EPS) return 'out-of-frame';
    if (Number(rect.y) + Number(rect.h) > 1 + RECT_EPS) return 'out-of-frame';
    return null;
  }

  // One source entry becomes either a single bay or, when it carries a numeric
  // `count`, a row of `count` identical bays laid out along `axis` with `gap`
  // between them. Hand-listing 134 near-identical rects would be unreviewable.
  function expandEntry(entry, index) {
    if (!entry || typeof entry !== 'object') return [{ index, raw: entry, invalid: 'not-an-object' }];
    if (entry.count === undefined && entry.idPrefix === undefined) {
      return [{ index, raw: entry, spot: entry, id: entry.id }];
    }
    const count = Number(entry.count);
    if (!Number.isInteger(count) || count < 1) return [{ index, raw: entry, invalid: 'bad-count' }];
    const axis = entry.axis === 'y' ? 'y' : 'x';
    const gap = finiteOr(entry.gap, 0);
    const span = axis === 'x' ? Number(entry.w) : Number(entry.h);
    if (!Number.isFinite(span) || !Number.isFinite(gap)) return [{ index, raw: entry, invalid: 'bad-rect' }];
    const prefix = entry.idPrefix === undefined ? `${index}-` : String(entry.idPrefix);
    const out = [];
    for (let i = 0; i < count; i++) {
      const offset = i * (span + gap);
      out.push({
        index,
        raw: entry,
        id: `${prefix}${i + 1}`,
        spot: Object.assign({}, entry, {
          x: axis === 'x' ? Number(entry.x) + offset : Number(entry.x),
          y: axis === 'y' ? Number(entry.y) + offset : Number(entry.y),
        }),
      });
    }
    return out;
  }

  // Accepts the parsed lot object or the raw JSON text. Malformed bays are
  // dropped into `skipped` with a reason instead of poisoning the whole lot:
  // one bad rect in an uploaded file must not blank the map. A root that is not
  // a lot at all returns an empty lot with `errors`, never null, so callers can
  // read `.capacity` without guarding every access.
  function parseLotSpots(input) {
    let lot = input;
    if (typeof lot === 'string') {
      try {
        lot = JSON.parse(lot);
      } catch (e) {
        return emptyLot(['unparseable-json']);
      }
    }
    if (!lot || typeof lot !== 'object' || Array.isArray(lot)) return emptyLot(['not-a-lot-object']);
    const entries = Array.isArray(lot.spots) ? lot.spots : null;
    if (!entries) return emptyLot(['no-spots-array']);

    const spots = [];
    const skipped = [];
    const seen = new Set();
    const byZone = {};
    const byKind = {};

    entries.forEach((entry, index) => {
      for (const candidate of expandEntry(entry, index)) {
        if (candidate.invalid) {
          skipped.push({ index, id: candidate.id ?? null, reason: candidate.invalid });
          continue;
        }
        const raw = candidate.spot;
        const id = String(candidate.id ?? '').trim();
        if (id === '') {
          skipped.push({ index, id: null, reason: 'missing-id' });
          continue;
        }
        if (seen.has(id)) {
          // Occupancy state is keyed by id; two bays sharing one would make the
          // simulated count disagree with the drawn lot.
          skipped.push({ index, id, reason: 'duplicate-id' });
          continue;
        }
        const problem = rectProblem(raw);
        if (problem) {
          skipped.push({ index, id, reason: problem });
          continue;
        }
        const kind = raw.kind === undefined ? 'regular' : String(raw.kind);
        if (!SPOT_KINDS.includes(kind)) {
          skipped.push({ index, id, reason: 'unknown-kind' });
          continue;
        }
        const level = raw.level === undefined ? 0 : Number(raw.level);
        if (!Number.isInteger(level)) {
          skipped.push({ index, id, reason: 'bad-level' });
          continue;
        }
        const zone = raw.zone === undefined ? '' : String(raw.zone).trim();
        seen.add(id);
        spots.push({
          id,
          zone,
          level,
          kind,
          label: KIND_LABELS[kind],
          // Source order is walking distance from the entrance: the first bay in
          // the file is the one a driver takes first. simulateOccupancyStep
          // relies on it, so parse must not reorder.
          order: spots.length,
          x: Number(raw.x),
          y: Number(raw.y),
          w: Number(raw.w),
          h: Number(raw.h),
        });
        byZone[zone] = (byZone[zone] || 0) + 1;
        byKind[kind] = (byKind[kind] || 0) + 1;
      }
    });

    return {
      lotId: lot.lotId === undefined ? null : String(lot.lotId),
      name: lot.name === undefined ? null : String(lot.name),
      source: lot.source === undefined ? null : String(lot.source),
      note: lot.note === undefined ? null : String(lot.note),
      image: Number.isFinite(Number(lot.imageWidth)) && Number.isFinite(Number(lot.imageHeight))
        ? { width: Number(lot.imageWidth), height: Number(lot.imageHeight) }
        : null,
      zones: Array.isArray(lot.zones) ? lot.zones.slice() : [],
      spots,
      capacity: spots.length,
      byZone,
      byKind,
      skipped,
      errors: [],
    };
  }

  // ------------------------------------------------------------ hourly curve

  function curveForDay(day) {
    const d = normalizeDay(day);
    if (d === 5) return { curve: FRIDAY_CURVE, factor: 1 };
    if (d === 6) return { curve: SATURDAY_CURVE, factor: 1 };
    return { curve: WORKDAY_CURVE, factor: WORKDAY_FACTOR[d] ?? 1 };
  }

  // Occupancy fraction at a point inside the hour. A 15-minute tick between
  // 07:00 (0.15) and 08:00 (0.78) must not jump the whole ramp at once, so the
  // two hours are interpolated linearly. Minutes past 23:00 interpolate toward
  // the same day's 00:00 — the overnight floor, where the curves agree anyway.
  function getTargetOccupancy(options) {
    const opts = options || {};
    const { curve, factor } = curveForDay(opts.day);
    const hour = normalizeHour(opts.hour);
    const minute = clamp(finiteOr(opts.minute, 0), 0, 59);
    const here = curve[hour];
    const next = curve[(hour + 1) % 24];
    const blended = here + (next - here) * (minute / 60);
    return round3(clamp(blended * factor, 0, 1));
  }

  // 24 rows, one per local hour. `occupied` is a bay count when a capacity is
  // given and null otherwise — an unknown count must read as unknown, not as a
  // confident zero cars.
  function getHourlyCurve(options) {
    const opts = options || {};
    const day = normalizeDay(opts.day);
    const capacityRaw = Number(opts.capacity);
    const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : null;
    const { curve, factor } = curveForDay(day);
    return curve.map((value, hour) => {
      const occupancy = round3(clamp(value * factor, 0, 1));
      return {
        hour,
        occupancy,
        occupied: capacity === null ? null : Math.round(occupancy * capacity),
        peak: isPeakHour(hour),
        day,
      };
    });
  }

  // -------------------------------------------------------------- simulation

  // Arrival order: whoever is driving in takes the closest general bay. Ties
  // inside a tier are broken by the per-step hash so the same row does not fill
  // left-to-right every single morning.
  //
  // `order` and `kind` come from parseLotSpots, but a caller may hand over a
  // bare bay list; position in that list is then the walking distance.
  //
  // A bay vacated by this same tick is pushed to the back: churn must show a
  // car moving to a different bay, not a departure and an arrival cancelling
  // out in place. It is still eligible last, so a lot with no other free bay
  // still reaches the curve's target.
  const JUST_FREED_PENALTY = 10000000;

  function arrivalRank(spot, index, step, seed, justFreed) {
    const tier = KIND_FILL_TIER[spot.kind] ?? 0;
    const order = finiteOr(spot.order, index);
    const jitter = hashSpot(spot.id, step, seed) % 97;
    return (justFreed ? JUST_FREED_PENALTY : 0) + tier * 100000 + order * 100 + jitter;
  }

  // Departure order: the car that has been there longest leaves first, so a
  // bay cannot be re-let twice a tick while a neighbour sits for a whole day.
  function departureRank(state, spot, step, seed) {
    const dwell = step - finiteOr(state.sinceStep, step);
    const jitter = hashSpot(spot.id, step + 7919, seed) % 97;
    return -(dwell * 100) + jitter;
  }

  function previousStates(state) {
    const list = Array.isArray(state) ? state : (state && Array.isArray(state.states) ? state.states : null);
    const map = new Map();
    if (!list) return map;
    for (const entry of list) {
      if (!entry || entry.id === undefined) continue;
      map.set(String(entry.id), {
        occupied: Boolean(entry.occupied),
        sinceStep: finiteOr(entry.sinceStep, 0),
      });
    }
    return map;
  }

  // Where the next tick lands on the clock: an explicit hour/minute wins,
  // otherwise the previous result is advanced by stepMinutes with day rollover,
  // so a caller can loop `s = simulateOccupancyStep(s, { spots })` for a day.
  // An explicit minute alone stays within the previous tick's hour instead of
  // throwing the clock back to midnight.
  function nextClock(state, options, stepMinutes) {
    const hasExplicit = options.hour !== undefined || options.minute !== undefined;
    const prev = Array.isArray(state) ? null : state;
    if (hasExplicit || !prev || prev.hour === undefined) {
      const fallbackHour = prev && prev.hour !== undefined ? prev.hour : 0;
      return {
        day: normalizeDay(options.day !== undefined ? options.day : (prev ? prev.day : DEFAULT_DAY)),
        hour: normalizeHour(options.hour !== undefined ? options.hour : fallbackHour),
        minute: clamp(Math.floor(finiteOr(options.minute, 0)), 0, 59),
      };
    }
    const total = normalizeHour(prev.hour) * 60 + clamp(finiteOr(prev.minute, 0), 0, 59) + stepMinutes;
    const dayShift = Math.floor(total / (24 * 60));
    const inDay = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const baseDay = normalizeDay(options.day !== undefined ? options.day : prev.day);
    return {
      day: ((baseDay + dayShift) % 7 + 7) % 7,
      hour: Math.floor(inDay / 60),
      minute: inDay % 60,
    };
  }

  // Advances a lot one tick toward the curve's target for that moment.
  //
  // `state` is the previous return value (or its `states` array, or null for a
  // cold start — a cold start fills straight to the target, so the first frame
  // of an 09:00 demo is a busy lot rather than an empty one).
  //
  // The net move to the target is exact whenever it is feasible; `churn` only
  // decides *which* bays change hands, never how many cars are in the lot.
  function simulateOccupancyStep(state, options) {
    const opts = options || {};
    const lot = Array.isArray(opts.spots) ? { spots: opts.spots } : parseLotSpots(opts.spots || opts.lot);
    const spots = lot.spots.filter((spot) => spot && spot.id !== undefined);
    const capacity = spots.length;
    const stepMinutes = Math.max(1, Math.floor(finiteOr(opts.stepMinutes, DEFAULT_STEP_MINUTES)));
    const prev = Array.isArray(state) ? null : state;
    const step = Number.isFinite(Number(opts.step))
      ? Math.floor(Number(opts.step))
      : (prev && Number.isFinite(Number(prev.step)) ? Math.floor(Number(prev.step)) + 1 : 0);
    const seed = Math.floor(finiteOr(opts.seed, prev ? finiteOr(prev.seed, 0) : 0));
    const clock = nextClock(state, opts, stepMinutes);
    const target = getTargetOccupancy({ day: clock.day, hour: clock.hour, minute: clock.minute });

    if (capacity === 0) {
      return {
        lotId: lot.lotId ?? null,
        day: clock.day, hour: clock.hour, minute: clock.minute,
        step, stepMinutes, seed,
        capacity: 0, occupied: 0, free: 0,
        occupancy: null, target, targetOccupied: 0,
        peak: isPeakHour(clock.hour),
        states: [], arrived: [], departed: [],
      };
    }

    const before = previousStates(state);
    const states = spots.map((spot) => {
      const seenBefore = before.get(String(spot.id));
      return {
        id: spot.id,
        occupied: seenBefore ? seenBefore.occupied : false,
        sinceStep: seenBefore ? seenBefore.sinceStep : step,
      };
    });

    const current = states.reduce((n, s) => (s.occupied ? n + 1 : n), 0);
    const targetOccupied = clamp(Math.round(target * capacity), 0, capacity);
    const churnRate = Math.max(0, finiteOr(opts.churn, DEFAULT_CHURN_PER_HOUR));
    const churn = Math.round(
      capacity * churnRate * (stepMinutes / 60) * (isPeakHour(clock.hour) ? 1 : OFF_PEAK_CHURN_FACTOR)
    );

    const departures = Math.min(current, Math.max(0, current - targetOccupied) + churn);
    const departed = states
      .map((s, i) => ({ s, spot: spots[i] }))
      .filter(({ s }) => s.occupied)
      .sort((a, b) => departureRank(a.s, a.spot, step, seed) - departureRank(b.s, b.spot, step, seed))
      .slice(0, departures);
    for (const { s } of departed) {
      s.occupied = false;
      s.sinceStep = step;
    }

    const occupiedAfter = current - departed.length;
    const justFreed = new Set(departed.map(({ s }) => s.id));
    const arrivals = clamp(targetOccupied - occupiedAfter, 0, capacity - occupiedAfter);
    const rankOf = ({ spot, index }) => arrivalRank(spot, index, step, seed, justFreed.has(spot.id));
    const arrived = states
      .map((s, i) => ({ s, spot: spots[i], index: i }))
      .filter(({ s }) => !s.occupied)
      .sort((a, b) => rankOf(a) - rankOf(b))
      .slice(0, arrivals);
    for (const { s } of arrived) {
      s.occupied = true;
      s.sinceStep = step;
    }

    const occupied = states.reduce((n, s) => (s.occupied ? n + 1 : n), 0);
    return {
      lotId: lot.lotId ?? null,
      day: clock.day,
      hour: clock.hour,
      minute: clock.minute,
      step,
      stepMinutes,
      seed,
      capacity,
      occupied,
      free: capacity - occupied,
      occupancy: round3(occupied / capacity),
      target,
      targetOccupied,
      peak: isPeakHour(clock.hour),
      states,
      arrived: arrived.map(({ s }) => s.id),
      departed: departed.map(({ s }) => s.id),
    };
  }

  return {
    LOT_FILE,
    PEAK_START_HOUR,
    PEAK_END_HOUR,
    WORKDAY_CURVE,
    FRIDAY_CURVE,
    SATURDAY_CURVE,
    WORKDAY_FACTOR,
    SPOT_KINDS,
    KIND_LABELS,
    KIND_FILL_TIER,
    DEFAULT_STEP_MINUTES,
    DEFAULT_CHURN_PER_HOUR,
    isPeakHour,
    parseLotSpots,
    getHourlyCurve,
    getTargetOccupancy,
    simulateOccupancyStep,
  };
});
