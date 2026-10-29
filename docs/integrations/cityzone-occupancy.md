# CityZone occupancy snapshot

Slice of the C3 connector. Draft PR #370 holds the transport (`pushOccupancy`,
`pushSpotFreed`, `fetchLotConfig`, mock, HTTP stub). This file is only the
document that transport is allowed to send for occupancy.

## עברית

`occupancySnapshot(readings, opts)` בונה מסמך תפוסה ממצב המקומות שכבר יש
ב־ParkWiz: `{ id, occupied }` ועם רמת ביטחון כשיש. התוצאה היא ספירות ורשימת
מצבים בלבד — `free`, `occupied`, `reserved`, `disabled`.

מקום שרמת הביטחון שלו נמוכה מ־0.6, או שמצבו `uncertain`, נספר ב־`total` ולא
נכנס ל־`free` או ל־`occupied`. פער בין `occupied + free` ל־`total` הוא מספר
המקומות הלא־ודאיים, לא מקומות פנויים.

שדה אסור (תמונה, פרצוף, לוחית, מזהה רכב, VIN) בכל עומק נדחה ב־`TypeError`.
קואורדינטות מצלמה וכתובת זרם לא מועתקות למסמך.

אין כאן נקודות קצה, הזדהות או ניסיונות חוזרים. אלה נשארים מחוץ למודול עד
ש־CityZone תגדיר אותם.

## English

`occupancySnapshot(readings, opts)` turns readings ParkWiz already has
(`{ id, occupied }`, plus `confidence` when the camera sent one) into counts
and a spot list. States are `free`, `occupied`, `reserved`, `disabled`.

A bay below the default confidence of 0.6, or marked `uncertain`, counts
toward `total` and is omitted from `free`, `occupied`, and `spots`. The gap
`total - occupied - free` is the unsure count, not empty bays.

A forbidden key (image, face, plate, vehicle id, VIN) at any depth throws
`TypeError`. Camera geometry and stream URLs are not copied onto the document.

Endpoints, authentication, and retries are not in this module. They stay
unspecified until CityZone agrees them.
