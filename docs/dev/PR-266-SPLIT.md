# #266 — live camera connector (Frigate + go2rtc): PR split

Issue #266 is one pipeline but five deliverables: the edge stack, the bridge,
the "live source" setting in the page, camera-health warnings, and the Hebrew
install guide. `auto_merger` merges a PR of at most **400 changed lines**, so
this file is the plan that keeps each piece landable.

This PR carries the part nothing else can be built on: the decision core, the
`edge/` stack it decides about, and the on-site runbook. The transport process
and the page are separate PRs, below — neither can be reviewed honestly before
the message shape is fixed, and the message shape is what this PR fixes.

Sibling branch note: EPIC #265 owns `src/lib/spot-freed.js` (the driver-facing
`{lot, spotId, freedAt}` relay payload). This PR deliberately does not touch
it. The bridge emits `{lot, spotId, occupied, ts}` and a `spot-freed` message
from the *camera* side; translating one into the other is the page's job, in
slice 4, once both libraries are on master.

## What this PR contains (measured, `git diff --numstat`)

| file | + | layer |
|---|---|---|
| `src/lib/edge-bridge.js` | 457 | topics, config, the bridge, the page-side client |
| `test/edge-bridge.test.js` | 269 | 19 tests: transitions, health, privacy whitelist |
| `test/edge-config.test.js` | 148 | the `edge/` templates cannot drift or leak |
| `docs/edge-setup-he.md` | 138 | Hebrew runbook + the IT checklist (item 5) |
| `edge/frigate/config.yml` | 94 | 1 camera, 3 zones = 3 bays, Hikvision/Dahua URLs |
| `edge/docker-compose.yml` | 75 | Frigate + go2rtc + a loopback-only broker |
| `edge/go2rtc/go2rtc.yaml` | 34 | RTSP → WebRTC/MJPEG, plus the looped-sample rig |
| `edge/.env.example` | 26 | read-only RTSP user; `edge/.env` is git-ignored |
| `edge/bridge/config.example.json` | 18 | the zone → bay map, one source of truth |
| `edge/mosquitto/mosquitto.conf` | 15 | a bus between containers, not a service |
| `.gitignore` | 5 | `edge/.env`, `edge/samples/`, `edge/bridge/config.json` |
| `README.md` | 1 | the honesty bullet: no live page yet |

**1280 lines**, plus this file's 104 — over the bar, like every first cut in
this repo (and this file drops when the split lands). The seam is
not code-vs-docs this time (the docs are only 139 of it); it is the library's
own two halves. Measured sub-split, in order, if this PR has to be broken up:

| # | content | lines |
|---|---|---|
| A | lib 1–137 (`parseTopic`, `normalizeConfig`, `sanitizeMessage`) + exports + its tests (test 1–34, 99–201) + `.gitignore` | ~229 |
| B | lib 138–334 (`createBridge`: transitions, hold, health) + tests 35–98, 115–174 | ~337 |
| C | lib 335–449 (`parseFeedMessage`, `applyMessage`, `healthWarnings`, `shouldFallback`, `normalizeBridgeUrl`) + tests 202–269 | ~183 |
| D | the whole `edge/` stack + `test/edge-config.test.js` minus its doc test | ~385 |
| E | `docs/edge-setup-he.md` + the `README.md` bullet + the doc test | ~164 |

A is first because D's test imports `normalizeConfig` to prove the Frigate
zones and the bridge config still agree; C needs nothing from B.

## Slice 2 — `edge/bridge`, the runtime (~320 lines, estimate)

The transport only. Every rule it applies already lives in this PR's library,
so this slice is wiring plus a Dockerfile:

- `edge/bridge/index.js`: an MQTT subscribe to `frigate/+/+` and
  `frigate/stats`, `createBridge()` fed by `onMessage`, `tick()` on a 250ms
  timer, and an SSE endpoint (`/events`) plus a WebSocket (`/ws`) that replays
  `snapshot()` to each new client before the first change.
- Zero-dependency or one dependency, decided in that PR: the repo has no
  `package-lock.json` and no runtime deps, and `mqtt`/`ws` on the edge box is a
  different question from `mqtt`/`ws` in this repo's test run. A minimal MQTT
  3.1.1 client over `node:net` (CONNECT/SUBSCRIBE/PUBLISH only) is ~120 lines
  and keeps the repo dependency-free; SSE over `node:http` needs nothing.
- `edge/bridge/Dockerfile` + uncommenting the `bridge` service in
  `docker-compose.yml` (already written, with the LAN-only port warning).
- `test/edge-bridge-runtime.test.js`: a fake socket feeds recorded MQTT packets,
  an `http` client reads `/events`, and the test asserts the occupancy change
  reaches the client in under the 2s bar of #266.

## Slice 3 — "live source" in the page (~300 lines, estimate)

`demo/camera.html` (the page from the #264 split) gains a **מקור חי** panel:
the bridge URL through `normalizeBridgeUrl`, an `EventSource` with backoff,
`applyMessage` into the existing spot state, and `shouldFallback` driving the
switch back to in-browser detection with the reason shown in Hebrew. The
go2rtc WebRTC view is an `<iframe>`/`<video>` to the box's own `:1984`, LAN
only. Needs slices 2 and C, and the #264 page on master.

## Slice 4 — health UI and the driver alert (~200 lines, estimate)

`healthWarnings()` rendered into the operator board's status region
(`demo/atidim-board.html`), the offline/frozen banner, and the translation
from a camera `spot-freed` into the #265 relay payload — the row-3 and row-14
part of the epic. Needs #265 on master.

## Acceptance, and what is already provable

> with a public test RTSP/sample video looped as RTSP, the bridge emits
> occupancy changes and the live ParkWiz page updates within ~2s

The looped-RTSP rig is in this PR (`demo_cam` in `go2rtc.yaml`, documented in
§6 of the Hebrew guide). The 2s budget is enforced here rather than measured
later: the only delay the pipeline adds on top of Frigate's own detection is
the flicker hold, clamped to `MAX_HOLD_MS` = 1500ms against a
`MAX_PUBLISH_LATENCY_MS` of 2000, and `test/edge-bridge.test.js` pins both the
clamp and the transition timing. The end-to-end measurement belongs to slice 2,
where there is a socket to measure across.

«no secrets in repo» is likewise structural, not reviewed by eye:
`test/edge-config.test.js` fails on an RTSP URL with inline credentials, on a
non-empty `*PASSWORD=` in `.env.example`, on a committed `edge/.env`, and on a
`:latest` image tag; `sanitizeMessage()` whitelists the eleven keys a client may
see, so no Frigate field — image, plate or credential — can ride along.
