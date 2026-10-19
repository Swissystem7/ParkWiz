// ParkWiz — the driver agent (#269 item 1, with the EV rule of #267 folded in).
//
// It watches `spot-freed` on the bus and answers one question for one waiting
// driver: is this the stall worth walking to? Scoring is a transparent sum, not
// a model — walking distance costs a point per 50 m, a charger is worth a lot
// to a car that needs one and a mismatch costs almost as much, and an
// accessible need is a hard filter rather than a weight. No Math.random: the
// same stall and the same driver always produce the same alert.
//
// When it alerts it also places the soft hold of #265 row 4 — the stall is
// marked as promised so the lot does not offer it to a second driver — and it
// is the agent's own job to let go: tick() releases the hold the moment the
// window expires, so a driver who never showed up cannot park a stall forever.
// Switching to a newly freed, better stall needs SWITCH_MARGIN of improvement,
// otherwise two near-identical stalls would ping the driver back and forth.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizDriverAgent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const NAME = 'driver';
  const DEFAULT_HOLD_SECONDS = 90;
  const DEFAULT_MAX_WALK_M = 400;
  // #267: below this charge the driver is treated as needing a charger even if
  // they never asked for one.
  const EV_LOW_PCT = 20;
  const BASE_SCORE = 10;
  const WALK_PER_M = 1 / 50;
  const EV_BONUS = 6;
  const EV_MISS_PENALTY = 4;
  const TYPE_MATCH_BONUS = 2;
  const SWITCH_MARGIN = 1.5;

  // Number(null) is 0 and Number(true) is 1, so a plain Number() would read an
  // unknown battery level as a flat battery and an unknown distance as "you are
  // standing on it". Same shape as finiteOr in src/lib/margin.js.
  function finiteOr(value, fallback) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value !== 'string' || value.trim() === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function needsCharger(profile) {
    if (!profile) return false;
    // 101 — above any real charge, so an unknown battery never looks low.
    return Boolean(profile.needsEv) || finiteOr(profile.batteryPct, 101) <= EV_LOW_PCT;
  }

  // ll= when the caller knows where the stall is, q= by name otherwise. We do
  // not invent coordinates for a lot: a wrong pin sends the driver to the wrong
  // gate, which is worse than letting Waze search for the lot by name.
  function wazeLink(spot) {
    const lat = Number(spot.lat);
    const lon = Number(spot.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return 'https://waze.com/ul?ll=' + lat + '%2C' + lon + '&navigate=yes';
    }
    const q = String(spot.lotName || spot.zone || spot.spotId || '');
    return 'https://waze.com/ul?q=' + encodeURIComponent(q) + '&navigate=yes';
  }

  // null means "not for this driver" — too far, or the wrong kind of stall.
  function scoreSpot(spot, profile) {
    if (!spot || !spot.spotId) return null;
    const maxWalk = finiteOr(profile.maxWalkM, DEFAULT_MAX_WALK_M);
    // An unknown distance ranks worst-but-still-acceptable rather than best:
    // defaulting it to 0 would make every stall with no geometry beat a real
    // one measured 20 m from the driver.
    const distance = finiteOr(spot.distanceM, maxWalk);
    if (distance > maxWalk) return null;
    if (profile.spotType === 'accessible' && spot.spotType !== 'accessible') return null;

    const reasons = [Math.round(distance) + ' מ׳ הליכה'];
    let score = BASE_SCORE - distance * WALK_PER_M;
    if (needsCharger(profile)) {
      if (spot.evCharger) {
        score += EV_BONUS;
        reasons.push('עמדת טעינה');
      } else {
        score -= EV_MISS_PENALTY;
        reasons.push('ללא עמדת טעינה');
      }
    }
    if (spot.spotType && spot.spotType === profile.spotType) {
      score += TYPE_MATCH_BONUS;
      reasons.push('סוג תא מתאים');
    }
    return { score: Number(score.toFixed(3)), reasons };
  }

  function createDriverAgent(options) {
    const opts = options || {};
    const holdMs = Math.max(1, finiteOr(opts.holdSeconds, DEFAULT_HOLD_SECONDS)) * 1000;
    let profile = null;
    let offer = null;
    let alerts = 0;
    let releases = 0;

    function release(reasonHe, kind, at) {
      const spotId = offer.spotId;
      offer = null;
      releases += 1;
      return {
        type: 'hold-release',
        spotId,
        reason: kind,
        at,
        textHe: 'שחרור שמירה על תא ' + spotId + ' — ' + reasonHe,
      };
    }

    function alert(spot, scored, at) {
      const holdSeconds = Math.round(holdMs / 1000);
      offer = { spotId: spot.spotId, score: scored.score, holdUntil: at + holdMs, wazeUrl: wazeLink(spot) };
      alerts += 1;
      return {
        type: 'driver-alert',
        spotId: spot.spotId,
        driverId: profile.driverId || null,
        score: scored.score,
        wazeUrl: offer.wazeUrl,
        holdUntil: offer.holdUntil,
        holdSeconds,
        textHe: 'התפנה תא ' + spot.spotId + ' · ' + scored.reasons.join(' · ') +
          ' · נשמר לך ל-' + holdSeconds + ' שניות · ניווט ב-Waze',
      };
    }

    function onEvent(evt) {
      if (evt.type === 'driver-waiting') {
        profile = {
          driverId: evt.driverId || null,
          maxWalkM: finiteOr(evt.maxWalkM, DEFAULT_MAX_WALK_M),
          needsEv: Boolean(evt.needsEv),
          batteryPct: finiteOr(evt.batteryPct, null),
          spotType: evt.spotType || null,
        };
        return null;
      }
      // A driver who parked or gave up must not keep a stall held.
      if (evt.type === 'driver-done') {
        const out = offer ? [release('הנהג סיים את החיפוש', 'driver-done', evt.at)] : [];
        profile = null;
        return out;
      }
      if (evt.type === 'spot-taken') {
        return offer && offer.spotId === evt.spotId ? [release('התא נתפס', 'taken', evt.at)] : null;
      }
      if (evt.type !== 'spot-freed' || !profile) return null;

      const scored = scoreSpot(evt, profile);
      if (!scored) return null;
      if (offer && evt.at < offer.holdUntil && scored.score <= offer.score + SWITCH_MARGIN) return null;

      const actions = [];
      if (offer) actions.push(release('נמצא תא עדיף', 'upgraded', evt.at));
      actions.push(alert(evt, scored, evt.at));
      return actions;
    }

    function tick(now) {
      if (!offer || now < offer.holdUntil) return null;
      return [release('חלון השמירה הסתיים', 'expired', now)];
    }

    function report() {
      return {
        waiting: Boolean(profile),
        heldSpotId: offer ? offer.spotId : null,
        // The panel renders this as the live "navigate there" link, so it has
        // to disappear the moment the hold does.
        wazeUrl: offer ? offer.wazeUrl : null,
        alerts,
        releases,
        textHe: offer
          ? 'שמור כרגע: תא ' + offer.spotId + ' · ' + alerts + ' התראות נשלחו'
          : (profile ? 'נהג ממתין — אין תא מתאים כרגע' : 'אין נהג ממתין'),
      };
    }

    return { name: NAME, labelHe: 'סוכן נהג', onEvent, tick, report };
  }

  return {
    createDriverAgent,
    scoreSpot,
    wazeLink,
    needsCharger,
    NAME,
    EV_LOW_PCT,
    SWITCH_MARGIN,
    DEFAULT_HOLD_SECONDS,
    DEFAULT_MAX_WALK_M,
  };
});
