# EPIC #265 — the Atidim pilot, split into PRs of at most 400 changed lines

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [EPIC #265](https://github.com/Swissystem7/ParkWiz/issues/265)
carries sixteen features; this file is the map from that epic to landable
PRs, and the cut line for the work that ships with it.

Two separate things live here:

1. **[The spot-freed slices](#the-spot-freed-slices)** — the event core, its
   Hebrew presentation and the driver feed on the operator board, and which of
   them is already on `master`.
2. **[The remaining fourteen rows](#the-remaining-rows)** — one sub-issue each,
   with the seam that keeps it under 400.

The feature-to-objection reasoning is in
[`docs/atidim-research.md`](../atidim-research.md); this file is only about
how the work is cut.

## The spot-freed slices

PR #282 first carried all of this in one 1044-line diff. Slice 1 then landed
on `master` on its own, so #282 conflicted with it (both added
`src/lib/spot-freed.js` and `test/spot-freed.test.js`). The follow-up (#296)
rebuilt the rest on top of `master`: slices 0, 2 and 3 below, with slice 1
taken as it is on `master`.

### Slice 0 — the documents

`docs/atidim-research.md` + this file + the `README.md` line. The epic names
the research doc as a deliverable in its own right, and it is the one piece
that is useful before any of the code lands.

### Slice 1 — the event core, model only (on `master`)

Everything a consumer needs to *produce* an event and nothing to display one:

* `createFreedTracker({lot, confirmFrames, minConfidence, spotTypes, allowedTypes})`
  and its `observe(spots, nowMs) -> {events, states}` contract.
* The three rules the rest of the epic depends on — the first observation is a
  baseline and alerts nobody; a transition must hold for `confirmFrames`; a
  low-confidence or half-confirmed bay reports `uncertain`, never a wrong
  green.
* `SPOT_TYPES`, `normalizeType`, `normalizeAllowed`, `labelGrid`,
  `demoSpotTypes`, `freedEvents` — row 9.
* `relayPayload()` — row 3 and row 5. Built by whitelist, so a field added to
  the event later cannot leak into a payload by default.

### Slice 2 — the Hebrew presentation and the deep links

`ATIDIM_ENTRANCE`, `agoHe`, `destinationHe`, `alertTextHe`, `navigationLinks`
in `src/lib/spot-freed.js`, and three tests in `test/spot-freed.test.js`.

This is row 10 and the Hebrew half of row 2: an event becomes
`התפנה מקום B-03 (טעינה חשמלית) · חניון פארק עתידים · מפלס -1 · מקום B-03 · ממש עכשיו`
and a pair of `waze.com/ul` / `google.com/maps/dir` links to the lot entrance.
Separate from slice 1 because it is the part a second lot or a second language
has to change, and the part with no state in it at all.

### Slice 3 — the driver feed on the operator board

`demo/atidim-board.html` + `sw.js` + `test/spot-freed-board-ui.test.js`.

The panel above the lot map, fed by the hour scrubber: the board already knows
which bay is taken at every hour, so dragging from 10:00 to 19:00 is a real
stream of departures, not a fake timer. Reserved bays that empty are tracked
but never reach the feed. Canvas bays are relabelled from `1…18` to `A-01…C-06`
so the bay the alert names is the bay the operator can point at.

## The remaining rows

Sizes are budgets, not measurements — each one is a sub-issue to be cut
against `master` at the time it is picked up. Rows already in flight are
marked. Every row inherits the epic's acceptance: works on the live GitHub
Pages site, Hebrew RTL, no console errors, PR under 400 lines.

| # | sub-issue | files | budget | depends on |
|---|---|---|---|---|
| 1 | Real in-browser camera detection | `src/lib/vision-occupancy.js` (on `master`), live page | ~400 | — (open on #264) |
| 2 | Spot-freed event + toast | slices 0–3 above | — | — |
| 3 | Alert relay (Web Push) | `relay/worker.js`, `src/lib/relay-client.js`, tests | ~350 | slice 1 |
| 3b | Relay deployment + key handling doc | `docs/relay-setup.md` | ~120 | 3 |
| 4 | Spot hold/claim ("אני בדרך") | `src/lib/spot-claim.js`, tests | ~300 | slice 1 |
| 4b | Claim UI on the board | `demo/atidim-board.html`, test | ~200 | 4 |
| 5 | Privacy mode: in-memory frames + blur | `src/lib/privacy-frame.js`, tests | ~300 | #264 |
| 5b | Privacy badge + `docs/privacy-he.md` (DPIA) | doc + badge on both demos | ~250 | 5 |
| 6 | Read-only connector | `src/lib/camera-source.js`, tests | ~300 | — |
| 6b | IT connection checklist page | `pilot-connect.html` | ~300 | 6 |
| 7 | Per-spot confidence + debounce surfacing | `demo/atidim.html`, test | ~250 | slice 1, #264 |
| 7b | Manual-count accuracy tool | extends `pilot-calibrate.html` | ~300 | 7 |
| 8 | Camera coverage wizard | `pilot-coverage.html`, `src/lib/coverage.js` | 2× ~300 | 6 |
| 9 | Spot types in the operator config | `demo/atidim-data.json`, board editor, test | ~250 | slice 1 |
| 10 | Navigate-to-spot on the driver surface | `index.html` entry + test | ~250 | slice 2 |
| 11 | Pilot KPI report | extends `pilot-report.html`, `src/lib/kpi.js` | 2× ~300 | — |
| 12 | Open feed (JSON + webhook) | `src/lib/open-feed.js`, `docs/open-feed.md` | 2× ~250 | slice 1 |
| 13 | Entrance sign mode (kiosk) | `demo/sign.html`, test | ~350 | slice 1 |
| 14 | Health monitor | `src/lib/camera-health.js`, board panel | 2× ~250 | 6 |
| 15 | Multi-lot view | `src/lib/lots.js`, per-lot JSON, test | ~350 | 9 |
| 16 | Car API spec (doc only) | `docs/car-api.md` | ~350 | — (open on #267) |

### Seams that keep each row under the cap

Four patterns do all the work here, and they are the same four that have kept
previous ParkWiz splits landable:

* **Model before surface.** A pure `src/lib/*.js` plus its tests is one PR; the
  page that consumes it is the next. Rows 3, 4, 5, 8, 11, 12 and 14 all split
  this way, and the model PR lands green with nothing importing it.
* **Code before paperwork.** Research, DPIA and setup docs are their own PR
  (rows 3b, 5b, 16). A 300-line doc attached to a 300-line feature is the most
  common way a ParkWiz PR goes over the cap for no reason.
* **One whole UI surface at a time.** Never a line range inside a page — a
  partial cut of an HTML file leaves a dangling boot call that the ranges
  missed. Rows 6b, 8 and 13 are each a whole new page.
* **Config before editor.** Row 9 ships the spot-type data and the filtering
  before the UI that lets an operator change it; the filtering is already in
  slice 1, so row 9 is mostly `demo/atidim-data.json` plus the board editor.

### Ordering

With slices 1–3 in, rows 3, 4, 7, 9, 12, 13 and 15 can all read the event
core, and row 10 reads the presentation half. After that the meeting set is
#264 → row 5 → row 7 → row 13, in that order, because each one is the answer
to a question the previous demo step provokes.
