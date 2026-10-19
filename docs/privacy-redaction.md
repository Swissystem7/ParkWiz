# טשטוש פנים ולוחיות במכשיר — ParkWiz

# On-Device Face & Plate Redaction — ParkWiz

> מסמך הסבר ליועמ״ש ולהנהלת הפארק. גרסה עברית למעלה, English below.
> קוד: [`src/lib/redact.js`](../src/lib/redact.js) · בדיקות: `test/redact*.test.js`
> נוגע לנושא #281 (פיילוט פארק עתידים).

---

## עברית

### 1. מה הבעיה שהמסמך הזה פותר

מצלמת חניון מצלמת מרחב ציבורי, ולכן כל פריים יכול לכלול פני אדם ולוחית רישוי —
שני סוגי מידע שהם «מידע אישי» לפי חוק הגנת הפרטיות ותיקון 13 לו. בדצמבר 2025
קבע בית המשפט המחוזי (עת״מ 12825-12-24) שאכיפת חניה בעזרת זיהוי לוחיות (LPR)
אינה חוקית, והרשות להגנת הפרטיות הבהירה שמדובר בפגיעה אסורה בפרטיות.

ParkWiz מודד **תפוס/פנוי** בלבד. אין לו שום צורך בפנים או בלוחיות, ולכן
העיקרון כאן הוא המחיקה המוקדמת ביותר האפשרית: המידע הרגיש נמחק בתוך הדפדפן
של המפעיל, לפני שהוא מוצג על המסך, לפני שהוא נשמר, ולפני שהוא נשלח לאן שהוא.

### 2. ההתחייבות בשלוש שורות

1. **הכול במכשיר.** הטשטוש רץ ב־JavaScript בדפדפן, בלי מודל להורדה, בלי שרת
   ובלי ענן. הדף עובד גם במצב לא מקוון, בדיוק כמו היוריסטיקת התפוסה.
2. **אין זיהוי.** אין OCR, אין LPR, אין תבנית ביומטרית ואין זהות בשום מקום
   בקוד. המודול *מאתר אזורים* לפי צבע כדי *למחוק אותם*. אחרי המחיקה גם ParkWiz
   עצמו לא יכול לדעת מי נראה בפריים או איזה רכב.
3. **אין פריים גולמי שנשמר.** הפריים הגולמי קיים רק בזיכרון, לשבריר שנייה,
   בתוך canvas שאינו מחובר למסך. מיד אחרי הטשטוש ה־blob URL הגולמי מבוטל
   (`URL.revokeObjectURL`). ל־localStorage ולקבצי הייצוא יוצאים **מספרים בלבד**
   (`spots.json`, `occupancy.json`, `occupancy.csv`) — אף פעם לא תמונה.

### 3. איך זה עובד בפועל

כל פריים — דוגמה כלולה, קובץ שהועלה, או צילום ישר ממצלמת הטלפון — נכנס דרך
שער יחיד בקוד (`ingestFrame` ב־`pilot-kit.html`):

```
פריים גולמי → canvas מוסתר → איתור אזורים → מחיקה הרסנית → עותק מטושטש
                                                              ↓
                                       תצוגה · מדידת תפוסה · ייצוא
```

**האיתור** הוא היוריסטיקת צבע על רשת תאים גסה (תא ≈ 1/48 מצלע הפריים הקצרה),
ולכן הוא זול מספיק לרוץ על כל פריים גם בטלפון אנדרואיד בינוני:

| מה | הסימן שמחפשים | המגבלה המוצהרת |
| --- | --- | --- |
| פנים | גוון עור בחלון הכרומה של YCbCr, עם יחס גבוה-רחב של פנים | פנים מוסתרות, מוסוות או קטנות מאוד עלולות להתפספס |
| לוחית | צהוב רווי — הפורמט הישראלי — בכתם רחב ושטוח | לוחית לבנה/זרה אינה מזוהה בכוונה (ראו למטה) |

**המחיקה** היא פיקסלציה (המלבן מחולק ל־3×3 בלוקים לפנים, 2×2 ללוחית, וכל בלוק
מקבל את הצבע הממוצע שלו) ואחריה טשטוש קופסה. הממוצע הוא פעולה חד־כיוונית: אין
«ביטול טשטוש», כי הפרטים לא הוסתרו — הם כבר לא נמצאים ב־buffer.

### 4. מה המודול לא עושה — ביודעין

- **לוחית לבנה (פורמט אירופי) אינה מזוהה.** המבחן שמזהה אותה נדלק גם על גג של
  רכב לבן, וטשטוש פס אקראי על רכבים בהירים גם נראה שבור וגם פוגע במדידת
  התפוסה באותו תא. בישראל כל פורמט לוחית הוא צהוב, ולכן בחרנו דיוק על פני כיסוי.
- **האיתור הוא היוריסטיקה, לא רשת נוירונים.** הוא יפספס מקרים. לכן ההתחייבות
  המשפטית אינה נשענת על האיתור לבדו אלא על המבנה: גם פריים שלא טושטש היטב
  לעולם אינו נשמר, אינו מיוצא ואינו נשלח. הפריים נמחק מהזיכרון בסיום הפעולה.
- **אין אכיפה.** אין בריפו מנוע הפרות, ואין קישור בין מספר תא לרכב מסוים.

### 5. «מצב פרטיות» בממשק המפעיל

בראש עמוד [ערכת הפיילוט](../pilot-kit.html) יש פאנל «פרטיות» עם מתג:

- **ברירת המחדל: פועל.** הדף נטען עם «מצב פרטיות פועל» לפני שהפריים הראשון נשלף.
- **בבילד ייצור לא ניתן לכבות.** המתג מוצג, אבל `disabled`, עם התווית
  «נעול בבילד ייצור». הכיבוי אפשרי רק ב־`localhost` / `127.0.0.1` / `*.local`
  או מקובץ מקומי (`file:`), לצורכי פיתוח. סביבה שלא ניתן לקרוא נחשבת ייצור —
  כלומר ברירת המחדל הבטוחה היא «נעול».
- הפאנל מציג מניה חיה: כמה אזורי פנים וכמה לוחיות טושטשו ובכמה פריימים.

כדי לראות את זה עובד: «טען דוגמת פרטיות (פנים + לוחיות)». הפריים
`pilot/sample-lot-privacy.svg` מכיל שתי דמויות הולכי רגל וחמש לוחיות צהובות,
וכולן מופיעות מטושטשות על המסך.

### 6. מדידת התפוסה לא נפגעת

הטשטוש כותב **רק בתוך** המלבנים שאותרו, ואף פעם לא מחוצה להם. בדיקה
(`test/redact-demo-frame.test.js`) מריצה את היוריסטיקת התפוסה פעמיים על אותו
פריים — לפני הטשטוש ואחריו — ודורשת אותה תוצאה בדיוק, תא אחר תא. כלומר הפרטיות
כאן לא עולה לפיילוט דיוק.

### 7. וידאו, webcam וקישור מצלמה

בריפו הזה **אין כרגע משטח וידאו חי** — העמודים מודדים צילום סטטי, וכל העמודים
מצהירים על כך במפורש. לכן השער לזרם חי מוכן בספרייה אך עדיין אינו בשימוש:

```js
const stream = ParkWizRedact.createStreamRedactor(videoEl, visibleCanvas, {
  onFrame: (report) => showCount(report.faces, report.plates),
});
stream.start();   // stream.stop() כשעוצרים
```

`createStreamRedactor` מצייר כל פריים ל־canvas, מטשטש אותו, ורק אז הוא נראה.
אלמנט ה־`<video>` עצמו **אינו** מוצג — מה שאפשר לראות על המסך הוא כבר העותק
המטושטש. כשייווסף משטח של וידאו שהועלה, webcam או קישור מצלמה, זהו המסלול
המחויב: אסור לחבר `<video>` ישירות לתצוגה או ל־`getImageData`.

### 8. איך מריצים את הבדיקות

```
npm test            # כל הריפו
node --test test/redact.test.js test/redact-sample-frame.test.js test/redact-demo-frame.test.js
```

---

## English

### 1. The problem

A parking camera records a public space, so any frame may contain a human face
or a licence plate — both personal data under the Israeli Privacy Protection Law
and its Amendment 13. In December 2025 the District Court held
(עת״מ 12825-12-24) that camera-based parking enforcement via plate recognition
(LPR) is unlawful, and the Privacy Protection Authority stated it is a
prohibited invasion of privacy.

ParkWiz only measures **occupied/free**. It has no use for faces or plates, so
the principle here is the earliest possible erasure: sensitive detail is
destroyed inside the operator's browser before it is drawn to screen, before it
is stored, and before it is sent anywhere.

### 2. The guarantee, in three lines

1. **Fully on-device.** Redaction is plain JavaScript in the browser — no model
   download, no server, no cloud. It works offline, like the occupancy
   heuristic.
2. **No recognition.** No OCR, no LPR, no biometric template, no identity
   anywhere in the code. The module *locates regions* by colour in order to
   *erase them*. After the pass, not even ParkWiz can say who or which vehicle
   was in the frame.
3. **No raw frame is retained.** The raw frame exists only in memory, for a
   fraction of a second, in a canvas that is never attached to the document. The
   raw blob URL is revoked (`URL.revokeObjectURL`) as soon as the redacted copy
   exists. Only **numbers** reach localStorage and the export files
   (`spots.json`, `occupancy.json`, `occupancy.csv`) — never an image.

### 3. How it works

Every frame — bundled sample, uploaded file, or a photo straight off the phone
camera — enters through a single gate in the code (`ingestFrame` in
`pilot-kit.html`):

```
raw frame → offscreen canvas → locate regions → destructive erase → redacted copy
                                                                        ↓
                                              display · occupancy read · export
```

**Detection** is a colour heuristic over a coarse cell grid (one cell ≈ 1/48 of
the frame's short edge), which is what makes a per-frame pass affordable on a
mid-range Android phone:

| What | Signal | Stated limit |
| --- | --- | --- |
| Faces | skin tone inside the YCbCr chroma window, face-like aspect ratio | an occluded, masked or very small face can be missed |
| Plates | saturated yellow — the Israeli format — in a wide, flat blob | white/foreign plates are deliberately not a class (below) |

**Erasure** is mosaicking (the box is split into 3×3 blocks for a face, 2×2 for
a plate, and each block is flattened to its own mean) followed by a box blur.
Averaging is one-way: there is no "unblur", because the detail was not hidden —
it is no longer in the buffer.

### 4. What it deliberately does not do

- **White (EU-format) plates are not detected.** The test that catches them also
  fires on the roof of a white car, and blurring a random band across
  light-coloured vehicles both looks broken and disturbs the occupancy read for
  that bay. Every Israeli plate format is yellow, so we chose precision over
  coverage.
- **Detection is a heuristic, not a neural net.** It will miss cases. The legal
  guarantee therefore does not rest on detection alone but on structure: a frame
  that was redacted imperfectly is still never stored, never exported and never
  transmitted, and is dropped from memory when the operation ends.
- **No enforcement.** There is no violations engine in the repo, and no link
  between a bay and a specific vehicle.

### 5. "Privacy mode" in the operator UI

The [pilot kit page](../pilot-kit.html) carries a "privacy" panel with a toggle:

- **Default: on.** The page renders "privacy mode ON" before the first frame is
  fetched.
- **Cannot be turned off in a production build.** The control stays visible but
  `disabled`, labelled "locked in production". It is only operable on
  `localhost` / `127.0.0.1` / `*.local` or from a local file (`file:`), for
  development. An environment that cannot be read counts as production — the
  safe default is locked.
- The panel shows a live count: how many face regions and how many plates were
  redacted, across how many frames.

To see it working, press "load privacy sample (faces + plates)". The frame
`pilot/sample-lot-privacy.svg` contains two pedestrians and five yellow plates,
and all of them appear blurred on screen.

### 6. Occupancy accuracy is unaffected

Redaction writes **only inside** the located boxes, never outside them. A test
(`test/redact-demo-frame.test.js`) runs the occupancy heuristic twice over the
same frame — before and after redaction — and requires the identical result, bay
by bay. Privacy costs the pilot no accuracy.

### 7. Video, webcam and camera links

This repo currently ships **no live video surface** — the pages measure a static
snapshot, and every page says so explicitly. The gate for a live stream is
therefore ready in the library but not yet in use:

```js
const stream = ParkWizRedact.createStreamRedactor(videoEl, visibleCanvas, {
  onFrame: (report) => showCount(report.faces, report.plates),
});
stream.start();   // stream.stop() when you are done
```

`createStreamRedactor` draws each frame to a canvas, redacts it, and only then
is it visible. The `<video>` element itself is **not** displayed — what can be
seen on screen is already the redacted copy. When an uploaded-clip, webcam or
camera-link surface is added, this is the mandatory route: a `<video>` must
never be wired straight to the display or to `getImageData`.

### 8. Running the tests

```
npm test            # the whole repo
node --test test/redact.test.js test/redact-sample-frame.test.js test/redact-demo-frame.test.js
```
