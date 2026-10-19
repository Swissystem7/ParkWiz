# Android Auto / Android Automotive — design + notification prototype plan (#267)

Scope: a design doc and a build plan. **Nothing is published to Google Play**,
and no Android code lands in this repo under this issue. The event contract is
[car-api.md](./car-api.md) / [car-api-he.md](./car-api-he.md); the behaviour
below is already demonstrable in the browser at
[`demo/car-demo.html`](../demo/car-demo.html).

## 1. Which surface

| Surface | What it is | Verdict for ParkWiz |
|---|---|---|
| **Android Auto** | Phone app projected to the head unit | **Primary.** The phone holds the ParkWiz session, the relay subscription and the location; the head unit is a screen. |
| **Android Automotive OS (AAOS)** | App installed in the car, no phone | Later. Needs a per-OEM build and store listing — out of scope. |
| Notification-only (no car app) | Phone notification that Android Auto mirrors | **The prototype.** Smallest thing that shows a freed spot in the car. |

Google's parking category for Android Auto is the **Navigation** app template
set (`CarAppService` + `androidx.car.app`). A parking app may show a place
list, a map with markers and a navigation hand-off — it may **not** show free
text, scrolling feeds or arbitrary web views while driving.

## 2. Screens (template-legal)

1. **`PlaceListMapTemplate` — nearby free spots.** Up to 6 rows, each
   `title` = street or charger bay, `text` = distance + a reason string from
   `rankSpots().reasonKey` (`nearest` / `charger-low-battery`). Charger bays
   carry a distinct marker.
2. **Row tap → `spot-claim`.** The row's action publishes `spot-claim` and
   hands off to the system navigation app with the spot's lat/lon.
3. **`MessageTemplate` — a spot freed while driving.** One line, two actions:
   *נווט לשם* (publishes `spot-claim`) and *לא עכשיו* (nothing is published).
4. **TTL honesty.** When the event's `ttlS` elapses the row is removed and the
   message is dismissed. The car never shows a claim it can no longer back —
   same rule as the `confidence` decay on the map demo.

Driving-state rules: no row count above 6, no free text updates more often
than the template refresh limit, and every string must read aloud sensibly in
Hebrew — the TTS voice is the actual UI at 50 km/h.

## 3. The notification prototype (the minimal thing to build)

Goal: with no car app and no store listing, a freed spot reaches the head unit.

1. **Subscribe.** Foreground service holds the relay subscription
   (`{carId, at, radiusM: 800, types: ['spot-freed']}`) while navigation is
   active, using the phone's location — not Smartcar.
2. **Receive.** On `spot-freed`, run `rankSpots` against the spots currently
   known free; take `best`.
3. **Notify.** Post a `NotificationCompat` with
   `CarAppExtender` + `CATEGORY_NAVIGATION`, `setOngoing(false)`, one action
   (*נווט לשם*). Android Auto renders it as a car notification; the phone shows
   the same one.
4. **Act.** The action publishes `spot-claim` and fires a
   `geo:` navigation intent. Dismiss or timeout publishes `spot-release` with
   `reason: "gave-up"`.
5. **Measure.** Log the delta between the event's `ts` and the notification
   post. Target: the same ~2 s the browser simulator reports.

Prototype is debug-build + `adb` / Desktop Head Unit only. No signing key, no
internal testing track, no store submission.

## 4. Consent and privacy in the car

- Opt-in is a ParkWiz app setting, off by default; the car surface never asks
  for consent while driving.
- The car surface receives the same event the relay delivers — so it also
  never sees a plate, a VIN or a phone number (see car-api.md §4).
- Location stays on the phone. The head unit gets a spot and a distance.
- No microphone, no camera, no contacts, no driver identity.

## 5. What would have to be true before any store step

1. A hosted relay exists (EPIC #265 row 3) with real auth, not a simulator.
2. A pilot city or lot operator wants the in-car surface, in writing.
3. Hebrew strings reviewed by someone who drives in Israel, read aloud.
4. Google's Declaration for a car app, which needs a published privacy policy
   covering exactly §4 — not a weaker one.

None of these is true today, which is why this file is a plan and not an
`app/` directory.
