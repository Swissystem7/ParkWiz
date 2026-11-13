// ParkWiz — driver alert path core (research digest 2026-11, section ה item 7
// "מסלול התראה", item 8 "מסך הפעלה למנהל", and ה "התראה עם חותמת זמן, תפוגה,
// ביטול כשנתפס, אין שמירת מקום").
// The alert holds only a spot id, a state and times: no image, URL or plate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PWAlertPath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // The digest gives no expiry number; reuse the repo's 5-minute freshness limit.
  var EXPIRE_AFTER_SEC = 300;
  var NO_RESERVATION = "אין שמירת מקום — המקום יכול להיתפס לפני שתגיעו";

  function mins(sec) {
    return sec < 60 ? sec + " שניות" : Math.floor(sec / 60) + " דקות";
  }

  // stage: 'occupied' | 'freed' | 'available' | 'taken'; ageSec since the spot
  // freed; ops: {pauseAlerts, closeZone, measureOnly} from the operator screen.
  function alertCard(input) {
    var stage = input && input.stage;
    var age = Math.max(0, Math.round(Number(input && input.ageSec) || 0));
    var ops = (input && input.ops) || {};
    if (ops.pauseAlerts || ops.closeZone || ops.measureOnly) {
      return { shown: false, status: "suppressed", textHe: "אין התראות לנהגים — " + (ops.closeZone ? "האזור סגור" : ops.measureOnly ? "מדידה בלבד" : "התראות מושהות") + " (החלטת מפעיל)" };
    }
    if (stage === "taken") return { shown: false, status: "cancelled", textHe: "ההתראה בוטלה — המקום נתפס" };
    if (stage !== "freed" && stage !== "available") return { shown: false, status: "none", textHe: "אין התראה — אין מקום פנוי" };
    if (age >= EXPIRE_AFTER_SEC) return { shown: false, status: "expired", textHe: "ההתראה פגה — המידע כבר לא עדכני" };
    return {
      shown: true,
      status: "active",
      textHe: "מקום A1 פנוי · עודכן לפני " + mins(age) + " · תפוגה בעוד " + mins(EXPIRE_AFTER_SEC - age) + ". " + NO_RESERVATION,
    };
  }

  return { EXPIRE_AFTER_SEC: EXPIRE_AFTER_SEC, NO_RESERVATION: NO_RESERVATION, alertCard: alertCard };
});
