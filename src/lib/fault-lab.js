// ParkWiz — fault-lab core (research digest 2026-11, section ה item 1).
// Pure logic for demo/fault-lab.html: a fault or old data turns a spot into
// "לא ידוע" (unknown), hides the driver alert and tells the operator to check.
// Output carries only state + freshness text: no image, no URL, no plate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PWFaultLab = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // Same 5-minute limit as src/lib/freshness.js ("לא עדכני — יותר מ-5 דקות").
  var STALE_AFTER_SEC = 300;
  var FAULTS = {
    camera: "מצלמה נותקה",
    view: "ראות חסומה",
    stale: "מידע לא עדכני",
  };

  function ageText(sec) {
    if (sec < 60) return sec + " שניות";
    return Math.floor(sec / 60) + " דקות";
  }

  // reading: 'free' | 'occupied'; fault: null | 'camera' | 'view' | 'stale';
  // ageSec: seconds since the last reading from the site.
  function spotView(input) {
    var reading = input && input.reading === "occupied" ? "occupied" : "free";
    var fault = input && FAULTS[input.fault] ? input.fault : null;
    var age = Math.max(0, Math.round(Number(input && input.ageSec) || 0));
    if (!fault && age > STALE_AFTER_SEC) fault = "stale";
    if (fault) {
      return {
        state: "unknown",
        labelHe: "לא ידוע",
        reasonHe: FAULTS[fault],
        stampHe: "עדכון אחרון לפני " + ageText(age) + " — לא מציגים כעדכני",
        alertVisible: false,
        alertHe: "התראה לנהג מוסתרת עד שהמידע חוזר להיות אמין",
        operatorHe: "צריך לבדוק: " + FAULTS[fault],
      };
    }
    var free = reading === "free";
    return {
      state: reading,
      labelHe: free ? "פנוי" : "תפוס",
      reasonHe: "",
      stampHe: "עודכן לפני " + ageText(age),
      alertVisible: free,
      alertHe: free ? "מקום פנוי נכון לרגע העדכון — אין שמירת מקום, ויכול להיתפס" : "אין התראה — המקום תפוס",
      operatorHe: "תקין",
    };
  }

  return { STALE_AFTER_SEC: STALE_AFTER_SEC, FAULTS: FAULTS, spotView: spotView };
});
