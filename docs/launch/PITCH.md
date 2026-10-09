# ParkWiz — סקר תפוסת חניה ממצלמה שכבר קיימת (עמוד אחד)

> מצב 28.9.2026: **דיוק מול ספירה ידנית בשטח עדיין בשלב מדידה.** אין כאן מספר דיוק, ואין להוסיף אחד עד שמדידת 100 הפריימים ב־[PILOT-KIT.md](./PILOT-KIT.md) הושלמה.

## הלקוח

1. **עירייה** — יחידת חדשנות / אגף תנועה וחניה (נתניה, הרצליה).
2. **משרד יועצי תנועה** שמכין נספחי חניה ובדיקות תפוסה לרשויות ולפרויקטים.

## הכאב (עם מקור)

- סקר תפוסה נעשה היום «בדרך כלל באמצעות מנייני תנועה אוטומטיים או ידניים» — [consultants.co.il, יועץ תנועה וחניה](https://consultants.co.il/services/engineering/traffic-parking/) (נקרא 28.9.2026). ספירה ידנית = אנשים בשטח, שעה אחרי שעה.
- בהרצליה «יותר מ־1,300 מצלמות… מתחילות לעבור מתיעוד בדיעבד לניתוח מידע» בפיילוט — [TheMarker, 17.9.2026](https://www.themarker.com/labels/hartzlia2026/2026-09-17/ty-article-labels/000001a0-9bc4-d9a4-a3a7-9ff6aaa20000). כלומר המצלמות כבר שם; חסר מספר תפוסה מהן.
- זיהוי לוחיות לאכיפה נחסם בלי חוק ([gov.il — עת״מ 12825-12-24](https://www.gov.il/he/pages/license_plate_cctv); הקישור מ־README, החזיר 403 לסביבת הבדיקה ב־28.9). תפוס/פנוי בלי לוחיות הוא מדידה אחרת, לא אכיפה.

## מה הכלי עושה היום (רק מה שיש בקוד)

כל אלה דפי דפדפן ב־[GitHub Pages](https://swissystem7.github.io/ParkWiz/), בלי שרת:

| דף | מה עושה |
|---|---|
| [ערכת פיילוט](https://swissystem7.github.io/ParkWiz/pilot-kit.html) | מסמנים מלבני חניה על צילום (snapshot) → הערכת תפוס/פנוי בהיוריסטיקת בהירות (לא בינה מלאכותית) → ייצוא `occupancy.json` / CSV |
| [כיול 3 דק׳](https://swissystem7.github.io/ParkWiz/pilot-calibrate.html) | אשף סימון מקומות ושמירת `calibration.json` |
| [השוואת דיוק](https://swissystem7.github.io/ParkWiz/pilot-compare.html) | זוגות «הערכת מערכת מול ספירה ידנית» → אחוז הסכמה + רווח סמך Wilson + פסק CONTINUE/PARK |
| [דוח פיילוט](https://swissystem7.github.io/ParkWiz/pilot-report.html) | עקומת תפוסה ומפת חום שעתית לתכנון, ייצוא CSV/JSON |
| [תקציר לעירייה](https://swissystem7.github.io/ParkWiz/pilot-brief.html) · [בקשת גישה / פרטיות](https://swissystem7.github.io/ParkWiz/pilot-privacy.html) | עמוד להדפסה + טיוטת בקשת גישה (מצלמה אחת, בלי LPR) |

**מה אין:** צינור מצלמה חי, זיהוי לוחיות, אכיפה, שרת, לקוח משלם, ודיוק שדה (בשלב מדידה).

## ההצעה

- **סקר תפוסה חד־פעמי ממצלמה שכבר קיימת:** צילומי snapshot מהמצלמה → עקומת תפוסה לפי שעה + מפת חום + קובץ CSV. מספרים בלבד (תפוס/פנוי), בלי לוחיות ובלי שמירת וידאו.
- **הסקר הראשון חינם** (בדומה לפיילוט 0 ₪ ב־[offer.html](https://swissystem7.github.io/ParkWiz/offer.html)), בתמורה לגישת snapshot ולמשוב.
- **מחיר לסקר בתשלום: לא נקבע.** לא נמצא מחירון ישראלי לסקר תפוסה (דוח 28.9). עוגן חיצוני בלבד: Parkinto מפרסמת 69 $ למצלמה לחודש ([מחירון](https://parkinto.com/pricing/), נקרא 28.9.2026) — מוצר מנוי, לא סקר.

## מה מבקשים

דבר אחד קטן: **שיחה של 10 דקות** — האם אצלכם סקר תפוסה ממצלמה קיימת היה חוסך ספירה ידנית, ואיזו מצלמה/רחוב היו מתאימים לניסיון.

## ערוץ פנייה

[טופס Google «משוב על האפליקציות» (ממולא מראש: ParkWiz)](https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=ParkWiz) — זה הערך של `CONTACT` ב־[`src/lib/contact.js`](../../src/lib/contact.js).

— אבירן
