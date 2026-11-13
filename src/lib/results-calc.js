// ParkWiz — pilot results calculator core (research digest 2026-11, section ה
// item 4: "מחשבון תוצאות — התראות נבדקו/נכונות/הוחמצו → תוצאה רק אחרי הזנה").
// No number is produced before valid input. Opening targets are the digest's
// *proposed* targets (ה "פיילוט 4 שבועות"), shown as proposals, not promises.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PWResultsCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TARGETS = { precision: 98, recall: 90 };

  function num(v) {
    if (v === "" || v === null || v === undefined) return NaN;
    var n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  }
  function pct(a, b) {
    return Math.round((a / b) * 1000) / 10;
  }

  // checked: "free" alerts checked against a manual count; correct: of those,
  // the spot really was free; missed: spots that freed with no alert.
  function alerts(input) {
    var checked = num(input && input.checked);
    var correct = num(input && input.correct);
    var missed = num(input && input.missed);
    if ([checked, correct, missed].some(isNaN)) {
      return { ok: false, textHe: "עדיין לא הוזנו נתונים — אין תוצאה להציג." };
    }
    if (checked < 1 || correct > checked) {
      return { ok: false, textHe: "בדקו את ההזנה: צריך לפחות התראה אחת שנבדקה, והנכונות לא מעל הנבדקות." };
    }
    var precision = pct(correct, checked);
    var recall = correct + missed > 0 ? pct(correct, correct + missed) : null;
    return {
      ok: true,
      precision: precision,
      recall: recall,
      falseFree: checked - correct,
      meetsPrecision: precision >= TARGETS.precision,
      meetsRecall: recall !== null && recall >= TARGETS.recall,
    };
  }

  return { TARGETS: TARGETS, alerts: alerts };
});
