// ParkWiz — שוליים (road shoulder) as a surface type of its own.
//
// WHY A SHOULDER NEEDS ITS OWN RULE
// A marked bay row and a shoulder are not the same object, so the same
// "chance" formula cannot serve both. Three properties of a shoulder are
// derivable from what a shoulder physically is, and only those three are
// encoded here:
//
// 1. Its capacity is a LENGTH, not a bay count. A bay row of N bays answers
//    "is one of N free?", and every free bay fits a car because a bay is
//    dimensioned for one. A shoulder answers a different question: "is the
//    free run at least as long as my car plus the room to swing into it?".
//    So the shoulder answer depends on two absolute metres — the free run and
//    the vehicle — while the bay answer depends only on a free fraction.
//    Consequence encoded: 40% free of a 30 m shoulder (12 m) holds a van;
//    40% free of a 4 m shoulder (1.6 m) holds nothing. A fraction alone
//    cannot tell those apart, which is exactly why the bay rule is wrong here.
//
// 2. It fills from one end. Drivers join the end of the standing row rather
//    than leaving a car-sized hole behind them, so the occupied part is one
//    contiguous run and the free part is one contiguous run. That is what
//    lets us compare a single free LENGTH against a single vehicle need. If
//    the free space were scattered we could not: five 2 m holes are 10 m of
//    "free" that fits no car. `freeRunM` therefore returns ONE run, and the
//    fill-from-one-end assumption is the whole reason it may.
//
// 3. It is the last to fill and the first to empty. A shoulder is the
//    less-preferred surface — unmarked, further, less certain — so a driver
//    takes a marked bay while one is left. Shoulder occupancy is therefore
//    not street occupancy: it is the SPILL past the point where the marked
//    bays stop absorbing demand, which is `spilloverOccupancy` below. Run the
//    same monotone function backwards and you get "first to empty" for free:
//    once street occupancy falls under the threshold the shoulder is clear.
//
// WHAT IS NOT DERIVED AND SO IS NOT HERE
// - Whether a driver may stop or park on a given shoulder. That is decided by
//   signs, road markings and municipal bylaws, is not in any data this repo
//   holds, and this module makes no claim about it in any direction. It
//   reports availability — how much room is likely to be free — and nothing
//   else. `NOTICE_HE` is the sentence the UI must show beside every shoulder
//   result.
// - Surface quality, width, whether the shoulder is paved, whether it abuts a
//   traffic lane, turnover rate, and the real length of any real shoulder.
//   `shoulderLengthM` is an input the caller supplies; in this repo it is demo
//   data, like every other number on the map.
//
// DEMO CONSTANTS (calibration, not derivation — same footing as the weights in
// predict.js): SPILLOVER_START, CONFIDENT_RUN_RATIO, MIN_FIT_PCT, MAX_FIT_PCT.
// MANOEUVRE_CLEARANCE_M is not a new invention: it is the 0.4 m the vehicle-fit
// model on the map already adds to a car's length, reused so two parts of the
// product do not disagree about what "fits" means.
//
// No Math.random, no clock, no network: same inputs, same number, always.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizShoulder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SURFACE = 'shoulder';

  // Street occupancy at which marked bays stop absorbing demand and cars
  // start standing on the shoulder. Demo constant.
  const SPILLOVER_START = 0.6;
  // Room to swing in, on top of the car's own length. Mirrors fitInfo() on the map.
  const MANOEUVRE_CLEARANCE_M = 0.4;
  // A free run worth this many vehicle-needs earns the top reported chance.
  const CONFIDENT_RUN_RATIO = 3;
  // A run of exactly one vehicle-need fits the car with nothing to spare, and the
  // run itself is an estimate — so that case reports the floor, not certainty.
  const MIN_FIT_PCT = 20;
  // Never 100: this is an estimate of free space, not a reservation.
  const MAX_FIT_PCT = 95;

  const LABEL_HE = '🛞 שוליים';
  const SHORT_LABEL_HE = 'שוליים';
  const CURB_LABEL_HE = 'שוליים (לא מסומן) — שילוט קובע';
  const TARIFF_HE = '💰 תעריף חניה: לא ידוע לשוליים — שילוט ותמרור קובעים';
  const NOTICE_HE = '🛞 שוליים — הערכת זמינות בלבד: כמה מקום פנוי צפוי להיות. ParkWiz אינו מכריע אם לעצור או להחנות כאן — שילוט, תמרור וסימון הכביש קובעים, ובדיקה בשטח לפני שחונים.';
  const WHY_HE = 'שוליים מתמלאים מקצה אחד, אחרונים אחרי הכחול-לבן — לכן הסיכוי כאן נגזר מאורך הקטע הפנוי מול אורך הרכב שלך, ולא מאחוז תפוסה.';

  // Strict on purpose: Number(null) is 0 and Number(false) is 0, and a missing
  // shoulder length must never quietly become "the street is empty".
  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function isShoulder(type) {
    return type === SURFACE;
  }

  // Property 3. Street occupancy 0..1 in, shoulder occupancy 0..1 out.
  // Flat zero while the marked bays still have room, then linear in the spill.
  function spilloverOccupancy(streetOccupancy, spilloverStart) {
    const occ = num(streetOccupancy);
    if (occ === null) return null;
    const start = num(spilloverStart) === null ? SPILLOVER_START : Number(spilloverStart);
    if (!(start >= 0 && start < 1)) return null;
    const o = clamp01(occ);
    if (o <= start) return 0;
    return (o - start) / (1 - start);
  }

  function streetOccupancyFromAvailPct(streetAvailPct) {
    const pct = num(streetAvailPct);
    if (pct === null) return null;
    return clamp01(1 - pct / 100);
  }

  // Property 2. One contiguous run, because a shoulder fills from one end.
  function freeRunM(shoulderLengthM, streetAvailPct, spilloverStart) {
    const len = num(shoulderLengthM);
    if (len === null || len < 0) return null;
    const occ = spilloverOccupancy(streetOccupancyFromAvailPct(streetAvailPct), spilloverStart);
    if (occ === null) return null;
    return len * (1 - occ);
  }

  // Property 1. The car's own length plus the room to swing into the run.
  function vehicleNeedM(vehicleLenM, clearanceM) {
    const len = num(vehicleLenM);
    if (len === null || len <= 0) return null;
    const clear = num(clearanceM) === null ? MANOEUVRE_CLEARANCE_M : Number(clearanceM);
    if (clear < 0) return null;
    return len + clear;
  }

  // Whole answer: metres of free run against metres of vehicle need.
  // Returns an integer percent 0..MAX_FIT_PCT, or null if the inputs cannot
  // support an answer (which the caller must surface as "no estimate", never
  // as a low chance).
  function shoulderAvailabilityPct(opts) {
    const o = opts || {};
    const run = freeRunM(o.shoulderLengthM, o.streetAvailPct, o.spilloverStart);
    const need = vehicleNeedM(o.vehicleLenM, o.clearanceM);
    if (run === null || need === null) return null;
    const ratio = run / need;
    if (ratio < 1) return 0; // the car physically does not go in
    const t = Math.min(1, (ratio - 1) / (CONFIDENT_RUN_RATIO - 1));
    return Math.round(MIN_FIT_PCT + (MAX_FIT_PCT - MIN_FIT_PCT) * t);
  }

  // How many cars of this size the free run could hold. For the UI copy only —
  // it is a capacity estimate, never a count of observed empty spaces.
  function vehicleLengthsFree(opts) {
    const o = opts || {};
    const run = freeRunM(o.shoulderLengthM, o.streetAvailPct, o.spilloverStart);
    const need = vehicleNeedM(o.vehicleLenM, o.clearanceM);
    if (run === null || need === null) return null;
    return Math.floor(run / need);
  }

  return {
    SURFACE,
    SPILLOVER_START,
    MANOEUVRE_CLEARANCE_M,
    CONFIDENT_RUN_RATIO,
    MIN_FIT_PCT,
    MAX_FIT_PCT,
    LABEL_HE,
    SHORT_LABEL_HE,
    CURB_LABEL_HE,
    TARIFF_HE,
    NOTICE_HE,
    WHY_HE,
    isShoulder,
    spilloverOccupancy,
    streetOccupancyFromAvailPct,
    freeRunM,
    vehicleNeedM,
    shoulderAvailabilityPct,
    vehicleLengthsFree,
  };
});
