// ParkWiz — first fit check (research digest 2026-11, section ה item 9
// "שאלון התאמה ראשונית → מה לברר"). Questions come from section ד "מה לברר
// בסיור עתידים" and the IT question in section ב. Output is a to-clarify
// list only: no score and no promise of fit.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PWFitCheck = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var QUESTIONS = [
    { id: "problem", qHe: "ידוע מתי ובאיזו קומה נהגים מסתובבים אף שיש מקום פנוי?", todoHe: "הבעיה: באילו שעות ובאילו קומות" },
    { id: "authority", qHe: "ידוע מי מוסמך לאשר את המצלמות ואת העיבוד?", todoHe: "בעל הסמכות למצלמות ולעיבוד, ומי הישות החותמת" },
    { id: "cameras", qHe: "ידועים דגמי המצלמות, הזוויות וה-NVR/VMS, והאם מותר להוסיף צרכן לזרם?", todoHe: "דגמי מצלמות, זוויות, NVR/VMS, והאם מותר להוסיף צרכן" },
    { id: "network", qHe: "יש רשת/PoE ומקום לקופסת עיבוד באתר?", todoHe: "רשת, PoE ומקום לקופסת עיבוד" },
    { id: "reception", qHe: "ידועה הקליטה בכל מפלס — לציוד ולנהגים בנפרד?", todoHe: "קליטה לציוד ולנהגים, בנפרד" },
    { id: "eligibility", qHe: "ידוע מי זכאי לאיזה מקום (מנויים, מבקרים, נכים, טעינה)?", todoHe: "זכאות לחניה — \"פנוי\" אינו \"מותר\"" },
    { id: "privacy", qHe: "יש אישור בכתב לשימוש בווידאו למטרת הכוונה (IT ופרטיות)?", todoHe: "פרטיות: אישור בכתב לשימוש בווידאו למטרה החדשה" },
    { id: "metrics", qHe: "הוסכמו מדדי הצלחה מול ספירה ידנית?", todoHe: "מדדי הצלחה: פנוי/תפוס בנפרד, \"הוצג פנוי אך תפוס\" מול ספירה ידנית" },
    { id: "end", qHe: "ידוע מי מסיר את הציוד, מה נמחק ומי מחליט על המשך?", todoHe: "סיום: מי מסיר, מה נמחק, מי מחליט על המשך" },
  ];
  // Section ב: "האיסור הוא על התקנה במצלמה, על חיבור לרשת, או על כל גישה
  // לווידאו?" + "סדר עדיפות". Directions to check, not decisions.
  var LIMITS = {
    unknown: "לברר עם IT מה בדיוק אסור — כל תשובה מובילה לפתרון אחר",
    install: "אין צורך להתקין תוכנה במצלמות: לבדוק זרם מקומי מורשה לקריאה בלבד ועיבוד בקופסה נפרדת באתר",
    network: "לבדוק מצלמה ייעודית או טלפון עם אפליקציה ייעודית, בלי חיבור לרשת האתר",
    video: "לבדוק מצלמה ייעודית או טלפון עם אפליקציה ייעודית",
    images: "לבדוק חיישן שאינו מצלמה (המחיר לא אומת)",
  };

  // answers: {problem:'yes'|'no'|'unknown', ...}; limit: key of LIMITS.
  // Anything not answered "yes" goes on the list.
  function toClarify(answers, limit) {
    var a = answers || {};
    var items = QUESTIONS.filter(function (q) { return a[q.id] !== "yes"; }).map(function (q) { return q.todoHe; });
    return {
      items: items,
      directionHe: LIMITS[limit] || LIMITS.unknown,
      noteHe: "אין ציון ואין הבטחת התאמה — זו רשימה למה לברר בסיור.",
    };
  }

  return { QUESTIONS: QUESTIONS, LIMITS: LIMITS, toClarify: toClarify };
});
