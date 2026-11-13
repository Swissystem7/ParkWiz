// ParkWiz — "free, but for whom?" core (research digest 2026-11, section ה
// item 2; section ד "זכאות לחניה": "פנוי" ≠ "מותר").
// A spot is suggested to a driver only when it is free AND allowed for that
// driver type. Unknown or occupied spots are never suggested. Spot data holds
// only kind and state: no plate, no driver id, no image.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PWEligibility = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // Which driver types may use each spot kind. Safe default: a special spot
  // (reserved / charging / accessible) is only for its own driver type; a
  // regular spot is open to everyone.
  var ALLOWED = {
    regular: ["visitor", "reserved", "ev", "accessible"],
    reserved: ["reserved"],
    ev: ["ev"],
    accessible: ["accessible"],
  };

  function isAllowed(kind, user) {
    return (ALLOWED[kind] || []).indexOf(user) > -1;
  }

  // -> {verdict:'suggest'|'not-allowed'|'not-free'|'unknown', textHe}
  function judge(spot, user) {
    var allowed = isAllowed(spot.kind, user);
    if (spot.state === "unknown") return { verdict: "unknown", textHe: "לא ידוע — לא מוצע" };
    if (spot.state !== "free") return { verdict: "not-free", textHe: allowed ? "תפוס" : "תפוס — וגם לא מותר לך" };
    if (!allowed) return { verdict: "not-allowed", textHe: "פנוי — אבל לא מותר לך" };
    return { verdict: "suggest", textHe: "פנוי וגם מותר לך" };
  }

  function suggest(spots, user) {
    return spots.filter(function (s) { return judge(s, user).verdict === "suggest"; });
  }

  return { ALLOWED: ALLOWED, isAllowed: isAllowed, judge: judge, suggest: suggest };
});
