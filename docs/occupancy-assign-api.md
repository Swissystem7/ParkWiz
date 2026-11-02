# Occupancy assignment API (PW-302)

Prototype. `POST /api/assign` is a Vercel Node.js function (`api/assign.js`). GitHub Pages still serves the static site and does not execute it. The function keeps spot state in memory on that instance only: no database, no network calls, no environment credentials. A cold start or a second instance does not see the same state.

Parsing lives only in `src/lib/occupancy-assign/adapter.js`. Assignment lives in `src/lib/occupancy-assign/assign.js`.

## Request

`Content-Type: application/json`. One of the shapes below.

### Simple observations

```json
{
  "spots": [
    { "spot_id": "A-12", "status": "free", "ts": "2026-11-02T12:00:00.000Z" }
  ],
  "driver": { "entry": "north", "zone": "A" }
}
```

A bare array of those spot objects is the same thing, without `driver`.

| Field | Rule |
|---|---|
| `spot_id` | String, 1–64 chars, `[A-Za-z0-9][A-Za-z0-9._/-]*` |
| `status` | `"free"` or `"occupied"` |
| `ts` | ISO-8601 date-time with `Z` or a numeric offset. Leap seconds and impossible dates (`2026-02-31`) are rejected. |
| `driver` | Optional object. `entry` and `zone` are optional strings (trimmed, max 64). Omit them or send `""` to leave them unset. |
| `driver.zone` | Hard filter. The stall's derived zone must match, case-insensitive. |
| `driver.entry` | Soft preference used only for the ETA heuristic. |

### Lenovo `pipeline.py` frames

`pipeline_out.json` is an array, one object per camera frame. The same array (or one object, or `{ "frames": [ ... ], "driver": { ... } }`) is accepted. Example record:

```json
{
  "frame": "2012-12-20_10_00_04.jpg",
  "occupied": ["1", "2", "3"],
  "free": [],
  "assignment": {},
  "unassigned": ["driver_0", "driver_1"],
  "ms": { "read": 4.7, "detect": 19.8, "status": 2.2, "match": 0.1, "total": 26.7 }
}
```

| Field | How this API uses it |
|---|---|
| `frame` | Filename clock `YYYY-MM-DD_HH_MM_SS` plus an optional extension. Interpreted as **UTC**. `2012-12-20_10_00_04.jpg` → `2012-12-20T10:00:04.000Z`. There is no timezone in the name. |
| `occupied` / `free` | Arrays of spot-id strings. Each id is one observation at the frame's timestamp. Both arrays are required. A spot listed twice in the same frame is a 400. Spots absent from both arrays are left unchanged (a frame is not a full snapshot of the lot). |
| `assignment` | Ignored. The pipeline's driver→spot map is not replayed. |
| `unassigned` | Ignored. |
| `ms` | Ignored. |

`driver` is only available on the object envelopes (`spots` or `frames` or a single frame object). A raw array cannot carry it.

Do not send `spots` and `frames` in the same object.

## State and stale timestamps

For each `spot_id`, the latest `ts` wins. An update whose `ts` is **strictly older** than the stored one is ignored. That is not an error: a batch of frames is often out of order. Equal timestamps apply in input order (the later record replaces the earlier one).

Inside one request, updates are sorted by `ts` before they are applied, so an older frame in the same array cannot overwrite a newer one.

A successful assignment **claims** the stall: it becomes `occupied` at `max(serverNow, observedTs + 1ms)`. The observation that justified the claim cannot immediately mark it free. A frame with a later timestamp can.

## Response `200`

```json
{ "zone": "main", "spot": "3", "eta": 46 }
```

| Field | Meaning |
|---|---|
| `zone` | Derived from `spot`, not from the request. |
| `spot` | The assigned `spot_id`. |
| `eta` | Integer seconds. Heuristic, not a measured drive. |

### Zone

1. If the id contains `-`, `_`, `/`, or `.` and the prefix is a letter token (`A`, `B3`, `north`), that prefix is the zone. Case is preserved (`A-12` → `A`).
2. Else if the id is letters plus a trailing number (`A12`, the browser demo's `A1`), the letters are the zone.
3. Else the zone is `main`. Pipeline stall numbers `"1"`…`"20"` are `main`.

### ETA

```
eta = 40 + min(stall, 40) * 2 + hops * 35
```

`stall` is the trailing integer (`A-12` → 12, `"3"` → 3), or 0 when there is none.

`hops` is 0 when `entry` is omitted, when it equals the zone (case-insensitive), or when the zone is `main` (the numeric camera lot is treated as the gate). Cardinal gates prefer a row and add one hop per step: north `A, B, C, D`; east `B, C, D, A`; south `C, D, A, B`; west `D, A, B, C`. Any other entry that is not this zone adds one hop. A zone letter outside `A`–`D` is four hops from a cardinal gate.

The lowest ETA wins. Ties break by `spot` id, ascending.

## Errors

JSON body `{ "error", "message" }`. No stack traces.

| HTTP | `error` | When |
|---|---|---|
| 400 | `BAD_JSON` | Empty, non-JSON, or a JSON value that is not an object/array |
| 400 | `BAD_BODY` | Neither a spot list nor pipeline frames; both `spots` and `frames`; mixed list; too many updates (10000) |
| 400 | `BAD_SPOT` | Bad `spot_id`, a spot id that is not a string, or the same id twice in one frame |
| 400 | `BAD_STATUS` | `status` is not `free` or `occupied` |
| 400 | `BAD_TS` | `ts` is missing or not a real ISO-8601 timestamp |
| 400 | `BAD_FRAME` | `frame` is not `YYYY-MM-DD_HH_MM_SS` with an optional extension, or the clock is impossible |
| 400 | `BAD_DRIVER` | `driver` is not an object, or `entry` / `zone` is not a short string |
| 405 | `METHOD_NOT_ALLOWED` | Not `POST` (`OPTIONS` is `204` for CORS) |
| 409 | `NO_FREE_SPOT` | Nothing free, or nothing free in `driver.zone`. The valid observations in that request were still stored. |
| 413 | `TOO_LARGE` | Body over 512 KiB |
| 500 | `INTERNAL` | Unexpected failure. The message is generic. |

Validation runs on the whole body before any spot is updated. One bad record rejects the request and leaves memory unchanged.

## Tests

```bash
npm run test:assign
```

`npm test` runs the same files because they live in `test/`. The pipeline fixture is `test/fixtures/pipeline-out.sample.json` (two frames in the `pipeline_out.json` shape; a full dump is 132 frames of the same record).
