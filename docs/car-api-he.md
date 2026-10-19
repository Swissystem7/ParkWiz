# ParkWiz — חוזה האירועים בין האפליקציה לרכב מחובר (#267)

גרסה אנגלית: [car-api.md](./car-api.md). מימוש ייחוס:
[`src/lib/car-api.js`](../src/lib/car-api.js). סימולטור חי:
[`demo/car-demo.html`](../demo/car-demo.html).

**מצב: חוזה וסימולטור בלבד.** אין ממסר מתארח, אין מנוי Smartcar בתשלום ואין מטען
מחובר. כל מה שלמטה ממומש כפונקציות טהורות ונבדק ב־`test/car-api.test.js`;
דף הדמו מריץ את הממסר בתוך לשונית דפדפן אחת.

## 1. האירועים

שלושה סוגים, פרוטוקול `v: 1`. JSON ב־POST ל־HTTPS של הממסר, או מעל ה־WebSocket
שלו. חותמות הזמן הן ISO-8601 ב־UTC.

### `spot-freed` — רכב התפנה ממקום

```json
{
  "v": 1,
  "type": "spot-freed",
  "id": "evt-91f3",
  "ts": "2026-10-19T09:04:11.000Z",
  "ttlS": 120,
  "spot": { "id": "netanya-herzl-14", "kind": "street", "lat": 32.3215, "lon": 34.8532 },
  "confidence": 0.8,
  "source": { "kind": "car", "carId": "ev-sim-1", "consent": "opt-in" }
}
```

תא טעינה חשמלי מסומן ב־`kind: "charger"` ונושא את המחבר שאליו הוא שייך:

```json
"spot": {
  "id": "netanya-ev-cp01-1", "kind": "charger", "lat": 32.3268, "lon": 34.8560,
  "charger": { "ocppId": "CP-01", "connectorId": 1, "kw": 22 }
}
```

### `spot-claim` — רכב בדרך למקום

```json
{ "v": 1, "type": "spot-claim", "id": "evt-91f4", "ts": "2026-10-19T09:04:13.000Z",
  "spot": { "id": "netanya-herzl-14" }, "etaS": 90,
  "source": { "kind": "car", "carId": "ev-sim-1", "consent": "opt-in" } }
```

### `spot-release` — התפיסה הסתיימה

`reason` הוא אחד מ־`taken`, `gave-up`, `expired`.

```json
{ "v": 1, "type": "spot-release", "id": "evt-91f5", "ts": "2026-10-19T09:06:02.000Z",
  "spot": { "id": "netanya-herzl-14" }, "reason": "gave-up",
  "source": { "kind": "car", "carId": "ev-sim-1", "consent": "opt-in" } }
```

### כללי השדות

| שדה | כלל |
|---|---|
| `type` | חייב להיות אחד משלושת הסוגים. כל דבר אחר נדחה, לא מושתק. |
| `id` | מפתח למניעת כפילות. הממסר מוסר כל `id` פעם אחת לכל היותר. |
| `ts` | חובה; חותמת זמן שלא ניתן לפענח נדחית. |
| `ttlS` | 1–900, ברירת מחדל 120. אחרי ה־TTL המנוי חייב לבדוק מחדש, לא לנסוע. |
| `spot.lat/lon` | חובה ב־`spot-freed` (הממסר מפזר לפי גאו־פנס). ב־claim/release מותר לנקוב במקום לפי `id` בלבד. |
| `confidence` | ב־`spot-freed` בלבד, 0–1. דיווח קהילתי ≈0.8; סטטוס OCPP 0.95. |
| `source.consent` | חייב להיות `"opt-in"`. כל ערך אחר נדחה. |

## 2. סמנטיקת הממסר (EPIC #265 שורה 3)

`createRelay()` ב־`src/lib/car-api.js` הוא החוזה שהממסר המתארח חייב לשמור, כדי
ששרת יוכל לעשות `require()` לאותו קובץ:

- **פיזור לפי גאו־פנס.** מנוי נרשם עם `{carId, at, radiusM}`; ברירת מחדל 800 מ׳,
  מקסימום 5000 מ׳. רחוק מזה — הרכב מתעורר למקומות שלא יספיק להגיע אליהם לפני
  שה־TTL נגמר.
- **לכל היותר פעם אחת לכל `id`.** פרסום חוזר של אותו `id` מחזיר `duplicate`.
- **בלי הד.** אירוע לא נמסר בחזרה ל־`carId` ששלח אותו.
- **זריקה לפי TTL.** אירוע שפג כבר בהגעה נדחה.

## 3. הרשאה (auth)

`Authorization: Bearer pw1.<carId>.<expEpochSeconds>.<scope+scope>.<sig>`

ה־scopes הם `spot:read` ו־`spot:write`. ה־`sig` הוא HMAC-SHA256 על
`pw1.<carId>.<exp>.<scopes>` עם הסוד המשותף של הממסר, שנקרא מ־`CAR_RELAY_SECRET`
בסביבה.

`checkAuth()` בודק את **המבנה**: קידומת, מזהה רכב, תוקף, scopes מוכרים, ה־scope
הנדרש, וקיום חתימה. הוא **לא** מממש HMAC בכוונה — דמו בדפדפן אסור שיהיה מקום
שבו יושב סוד משותף. מעבירים `opts.verify(canonical, sig)` בסביבה שבה יש סוד;
התוצאה מחזירה `signatureChecked`, כדי שאי אפשר יהיה לבלבל בדיקת מבנה עם אימות
חתימה.

## 4. פרטיות

הצטרפות מרצון בלבד, ובלי לוחיות — בדיוק ההבטחה ש־`offer.html` ו־`pilot-privacy.html`
נותנים לעירייה.

- `source.consent` שאינו `"opt-in"` → נדחה.
- `normalizeEvent()` **מוחק** שדות מזהים בכל עומק לפני הפרסום: `plate`,
  `plateNumber`, `licensePlate`, `vin`, `driverName`, `phone`, `email`, `imei`,
  `deviceId`. הנתיבים שהוסרו מדווחים ב־`droppedFields`, כך שהשומר נראה ולא רק
  מובטח. בדף הדמו יש כפתור שמנסה לפרסם לוחית ומראה אותה נמחקת.
- `source.carId` הוא מזהה בצד האפליקציה, לא מזהה רכב של היצרן.
- נשמר רק המקום שהתפנה — לא היסטוריית המסלול של הרכב.
- OCPP הוא קריאה בלבד: אין פקודת שליטה, אין נתוני חיוב ואין זיהוי מי טוען.

## 5. Smartcar (סימולציה / מצב בדיקה בלבד)

`fromSmartcar(payload)` מנרמל קריאת רכב ל־
`{carId, at:{lat,lon}, batteryPct, rangeKm, mode, droppedFields}`.
Smartcar מדווחת `battery.percentRemaining` כשבר בין 0 ל־1; הנרמול הופך אותו
לאחוזים שלמים. ה־scopes המבוקשים: `read_location`, `read_battery`.

`smartcarConfig(env)` קורא תצורה מהסביבה ו**לא מחזיר את הסוד** — רק `hasSecret`:

| משתנה סביבה | משמעות |
|---|---|
| `SMARTCAR_CLIENT_ID` | מזהה לקוח OAuth |
| `SMARTCAR_CLIENT_SECRET` | סוד הלקוח (רק קיומו נבדק; לעולם לא מוחזר) |
| `SMARTCAR_REDIRECT_URI` | כתובת חזרה אחרי הסכמה |
| `SMARTCAR_MODE` | `simulated` (ברירת מחדל), `test`/`sandbox`, או `live` |
| `SMARTCAR_ALLOW_LIVE` | חייב להיות `1` כדי ש־`live` ייכבד |

`SMARTCAR_MODE=live` בלי `SMARTCAR_ALLOW_LIVE=1` מחזיר
`{ok: false, reason: "live-mode-not-enabled"}`. לפרויקט הזה אין מנוי Smartcar
בתשלום, ולכן ברירת המחדל נשארת סימולציה ושום מפתח לא נשמר בריפו
(`.env` כבר ב־gitignore).

מסלול ההסכמה, כשיהיה מנוי: הנהג מאשר חיבור → מסך ההסכמה של Smartcar Connect
(מיקום וסוללה בלבד) → הממסר שומר את ה־access token בצד השרת → האפליקציה קוראת
מיקום וסוללה ומדרגת מקומות פנויים.

## 6. לאיזה מקום שולחים את הרכב

`rankSpots({car, spots})` מנקד כל מקום כ"עיקוף אפקטיבי במטרים", כך שהנימוק תמיד
ניתן להסבר לנהג:

- `nearest` — המקום הפנוי הקרוב ביותר.
- `charger-low-battery` — הסוללה על `LOW_BATTERY_PCT` (25%) או פחות, ולכן תא
  טעינה שווה עד `CHARGER_BONUS_M` (600 מ׳) של נסיעה נוספת.

## 7. מתאם OCPP (קריאה בלבד)

`fromOcppStatusNotification(msg, spotMap)` ממפה `StatusNotification` של
OCPP 1.6J ל־`{ocppId, connectorId, status, state, spot, readOnly: true}`:

- `Available` → `free`
- `Preparing`, `Charging`, `SuspendedEV`, `SuspendedEVSE`, `Finishing`,
  `Reserved` → `occupied`
- כל השאר, כולל `Faulted` ו־`Unavailable` → `unknown`

`unknown` לא מפורסם אף פעם כמקום פנוי. `ocppFreedEvent()` הופך מעבר ל־`Available`
ל־`spot-freed` עם `confidence: 0.95` ו־`source.kind: "ocpp"`; כל סטטוס אחר מחזיר
`null`. ParkWiz לא שולח שום הודעת OCPP — הוא לא יכול להתחיל, לעצור, לשריין או
לשחרר טעינה. `createOcppSimulator()` מריץ מטענים במעגל הסטטוסים, כך שהדמו לא
צריך מטען אמיתי.

## 8. Android Auto / Automotive

ראו [car-android-auto.md](./car-android-auto.md) — מסמך תכנון ותוכנית אבטיפוס
להתראות. לא מפורסם לשום חנות אפליקציות.
