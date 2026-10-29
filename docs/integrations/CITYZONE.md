# CityZone

## עברית

מחבר (connector) בין ParkWiz למערכת CityZone, בהקשר פיילוט עתידים.
המחבר שולח נתוני תפוסה בלבד — ספירות ומצבי מקומות — וקורא תצורת חניון.

### שיטות

| שיטה | תיאור |
| --- | --- |
| `pushOccupancy(lotId, snapshot)` | שליחת תמונת תפוסה לחניון |
| `pushSpotFreed(event)` | דיווח שמקום חניה התפנה (`lotId`, `spotId`, `freedAt`) |
| `fetchLotConfig(lotId)` | קריאת תצורת חניון |

מצבי מקום מותרים: `free`, `occupied`, `reserved`, `disabled`.

### דוגמה — תמונת תפוסה (ספירות בלבד)

```json
{ "total": 120, "occupied": 87, "free": 33, "timestamp": "2026-10-29T08:00:00Z",
  "spots": [{ "id": "A1", "state": "free" }] }
```

### פרטיות

לעולם אין לשלוח תמונות, פרצופים או לוחיות רישוי — וגם לא וידאו, מזהה רכב או VIN.
שדה חשוד בכל עומק נדחה מיד (`TypeError`), וכך גם כל שדה שאינו ברשימת השדות המותרים.

### תחבורה (transport)

- **mock (ברירת מחדל)**: תחבורה בזיכרון; מתעדת כל קריאה במערך `calls`, ללא רשת.
- **HTTP stub**: טרם הוגדר; כל שיטה זורקת `CityZone transport not configured`.

### פתוח / TODO

נקודות הקצה האמיתיות, אופן ההזדהות והמדיניות לניסיונות חוזרים מול CityZone
אינם ידועים עדיין — לא הומצאו כאן. יש להשלים אותם מול CityZone לפני שימוש אמיתי.

## English

Connector between ParkWiz and CityZone, for the Atidim pilot context.
It sends occupancy data only — counts and spot states — and reads lot config.

### Methods

| Method | Description |
| --- | --- |
| `pushOccupancy(lotId, snapshot)` | Push an occupancy snapshot for a lot |
| `pushSpotFreed(event)` | Report a freed spot (`lotId`, `spotId`, `freedAt`) |
| `fetchLotConfig(lotId)` | Fetch a lot's configuration |

Allowed spot states: `free`, `occupied`, `reserved`, `disabled`.

### Example — occupancy snapshot (counts only)

```json
{ "total": 120, "occupied": 87, "free": 33, "timestamp": "2026-10-29T08:00:00Z",
  "spots": [{ "id": "A1", "state": "free" }] }
```

### Privacy

Never send images, faces, or licence plates — nor video, vehicle ids, or VINs.
A suspect key at any depth is rejected immediately (`TypeError`), as is any
key outside the explicit allowlists.

### Transports

- **mock (default)**: in-memory transport; records every call in `calls`, no network.
- **HTTP stub**: not configured yet; every method throws
  `CityZone transport not configured`.

### Open / TODO

The real CityZone endpoints, authentication, and retry policy are unknown —
not invented here. They must be agreed with CityZone before real use.
