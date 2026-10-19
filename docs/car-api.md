# ParkWiz car API — the event contract (#267)

Hebrew version: [car-api-he.md](./car-api-he.md). Reference implementation:
[`src/lib/car-api.js`](../src/lib/car-api.js). Live simulator:
[`demo/car-demo.html`](../demo/car-demo.html).

**Status: contract + simulator only.** No hosted relay, no Smartcar plan, no
charger is connected. Everything below is implemented as pure functions and
exercised by `test/car-api.test.js`; the demo page runs the relay inside one
browser tab.

## 1. Events

Three types, protocol `v: 1`. JSON over HTTPS POST to the relay, or over the
relay's WebSocket. Timestamps are ISO-8601 UTC.

### `spot-freed` — a car left a spot

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

An EV charger bay carries `kind: "charger"` and the connector it belongs to:

```json
"spot": {
  "id": "netanya-ev-cp01-1", "kind": "charger", "lat": 32.3268, "lon": 34.8560,
  "charger": { "ocppId": "CP-01", "connectorId": 1, "kw": 22 }
}
```

### `spot-claim` — a car is driving to the spot

```json
{ "v": 1, "type": "spot-claim", "id": "evt-91f4", "ts": "2026-10-19T09:04:13.000Z",
  "spot": { "id": "netanya-herzl-14" }, "etaS": 90,
  "source": { "kind": "car", "carId": "ev-sim-1", "consent": "opt-in" } }
```

### `spot-release` — the claim is over

`reason` is one of `taken`, `gave-up`, `expired`.

```json
{ "v": 1, "type": "spot-release", "id": "evt-91f5", "ts": "2026-10-19T09:06:02.000Z",
  "spot": { "id": "netanya-herzl-14" }, "reason": "gave-up",
  "source": { "kind": "car", "carId": "ev-sim-1", "consent": "opt-in" } }
```

### Field rules

| Field | Rule |
|---|---|
| `type` | Must be one of the three. Anything else is rejected, not ignored. |
| `id` | Dedup key. The relay delivers an id at most once. |
| `ts` | Required; an unparseable timestamp is rejected. |
| `ttlS` | 1–900, default 120. Past the TTL the subscriber must re-check, not drive. |
| `spot.lat/lon` | Required for `spot-freed` (the relay fans out by geofence). A claim or release may name the spot by id alone. |
| `confidence` | `spot-freed` only, 0–1. A crowd report is ~0.8; an OCPP status is 0.95. |
| `source.consent` | Must be `"opt-in"`. Anything else is rejected. |

## 2. Relay semantics (EPIC #265 row 3)

`createRelay()` in `src/lib/car-api.js` is the contract the hosted relay has to
keep, so a server can `require()` the same file:

- **Geofenced fan-out.** A subscriber gives `{carId, at, radiusM}`; default
  radius 800 m, max 5000 m. Further than that and a car is woken for spots it
  cannot reach before the TTL expires.
- **At most once per `id`.** Re-publishing the same id returns `duplicate`.
- **No echo.** An event is never delivered back to the `carId` that sent it.
- **TTL drop.** An event that is already expired on arrival is rejected.

## 3. Auth

`Authorization: Bearer pw1.<carId>.<expEpochSeconds>.<scope+scope>.<sig>`

Scopes are `spot:read` and `spot:write`. `sig` is HMAC-SHA256 over
`pw1.<carId>.<exp>.<scopes>` with the relay's shared secret, read from
`CAR_RELAY_SECRET` in the environment.

`checkAuth()` validates the *shape*: prefix, car id, expiry, known scopes, the
required scope, and that a signature is present. It deliberately does **not**
implement HMAC — the browser demo must not be a place where a shared secret
lives. Pass `opts.verify(canonical, sig)` where a secret is actually available;
the result reports `signatureChecked` so a caller cannot mistake a shape check
for a verified token.

## 4. Privacy

Opt-in only, and no plates — the same promise `offer.html` and
`pilot-privacy.html` make to a city.

- `source.consent !== "opt-in"` → rejected.
- `normalizeEvent()` **deletes** identity keys at every depth before the event
  is published: `plate`, `plateNumber`, `licensePlate`, `vin`, `driverName`,
  `phone`, `email`, `imei`, `deviceId`. The removed paths are reported in
  `droppedFields`, so the guard is visible rather than promised. The demo page
  has a button that tries to publish a plate and shows it being dropped.
- `source.carId` is an app-side identifier, not a manufacturer vehicle id.
- Only the spot that was freed is kept — never the car's route history.
- OCPP is read-only: no control command, no billing data, no identity of who
  is charging.

## 5. Smartcar (simulated / test mode only)

`fromSmartcar(payload)` normalizes a vehicle read to
`{carId, at:{lat,lon}, batteryPct, rangeKm, mode, droppedFields}`.
Smartcar reports `battery.percentRemaining` as a 0–1 fraction; the normalizer
turns it into whole percent. Requested scopes: `read_location`, `read_battery`.

`smartcarConfig(env)` reads configuration from the environment and **never
returns the secret** — only `hasSecret`:

| Variable | Meaning |
|---|---|
| `SMARTCAR_CLIENT_ID` | OAuth client id |
| `SMARTCAR_CLIENT_SECRET` | OAuth client secret (presence only; never returned) |
| `SMARTCAR_REDIRECT_URI` | Consent redirect |
| `SMARTCAR_MODE` | `simulated` (default), `test`/`sandbox`, or `live` |
| `SMARTCAR_ALLOW_LIVE` | Must be `1` for `live` to be honoured |

`SMARTCAR_MODE=live` without `SMARTCAR_ALLOW_LIVE=1` returns
`{ok: false, reason: "live-mode-not-enabled"}`. This project has no paid
Smartcar plan, so the default stays simulated and nothing is committed to the
repo (`.env` is already git-ignored).

Consent flow, when a plan exists: driver taps connect → Smartcar Connect
consent screen (location + battery only) → the relay stores the access token
server-side → the app reads location and battery and ranks free spots.

## 6. Which spot the car is sent to

`rankSpots({car, spots})` scores each spot as "effective detour in metres", so
the reason is always explainable:

- `nearest` — closest free spot.
- `charger-low-battery` — battery at or under `LOW_BATTERY_PCT` (25%), so a
  charger bay is worth up to `CHARGER_BONUS_M` (600 m) of extra driving.

## 7. OCPP adapter (read-only)

`fromOcppStatusNotification(msg, spotMap)` maps OCPP 1.6J `StatusNotification`
to `{ocppId, connectorId, status, state, spot, readOnly: true}`:

- `Available` → `free`
- `Preparing`, `Charging`, `SuspendedEV`, `SuspendedEVSE`, `Finishing`,
  `Reserved` → `occupied`
- anything else, including `Faulted` and `Unavailable` → `unknown`

`unknown` is never advertised as a free bay. `ocppFreedEvent()` turns a
transition to `Available` into a `spot-freed` with `confidence: 0.95` and
`source.kind: "ocpp"`; every other status returns `null`. ParkWiz sends no OCPP
message at all — it cannot start, stop, reserve or unlock a charger.
`createOcppSimulator()` walks chargers through the status cycle so the demo
needs no charger.

## 8. Android Auto / Automotive

See [car-android-auto.md](./car-android-auto.md) — design and a notification
prototype plan. Not published to any store.
