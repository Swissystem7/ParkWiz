# Atidim pilot — risk register and feature map

Source: the owner's deep-research pass ahead of the Park Atidim / CityZone
meeting, restructured here as the working document for EPIC
[#265](https://github.com/Swissystem7/ParkWiz/issues/265).

One idea holds the whole pilot together:

> **The moment a spot frees, the system tells the driver — and later the car —
> where to go.**

Every feature below exists because a specific person in that meeting can kill
the pilot with a specific objection. The register is therefore ordered by
*which objection lands first*, not by what is pleasant to build. Nothing here
is a market forecast; it is a list of things that have to be true on the day.

> This file records product decisions and the reasoning behind them. It
> deliberately carries **no occupancy statistics and no third-party figures** —
> the pilot's own numbers belong in `pilot-report.html` and
> `docs/dev/PR-147-VALIDATION.md`, measured, not quoted.

## The register

Order is priority. "Meeting" marks the six that must be demonstrable before the
Atidim meeting; the rest are the pilot backlog.

| # | Objection, as the customer says it | Feature | Meeting |
|---|---|---|---|
| 1 | "Show me it actually working, not a mock." | Real in-browser camera detection (#264) | ✅ |
| 2 | "So what? I can count cars myself." | Spot-freed event + toast/notification (#263) | ✅ |
| 3 | "You said no server — so how does a driver three streets away hear about it?" | Alert relay: an optional Cloudflare-Worker-class endpoint that receives **only** `{lot, spotId, freedAt}` and fans out Web Push | |
| 4 | "Two drivers will race for the same spot." | Spot hold/claim — "אני בדרך" holds the bay for N minutes, auto-released on timeout or when the camera sees another car take it | |
| 5 | "What about Amendment 13? We are not filming our tenants." | Privacy mode by design — frames in memory only, auto-blur of people and plates in anything displayed, on-screen privacy badge, `docs/privacy-he.md` | ✅ |
| 6 | "IT will not give you our cameras." | Read-only connector — an RTSP→HLS/MJPEG snapshot URL or a periodic still from the existing NVR, no credentials in the repo, a connection checklist page for IT | |
| 7 | "It will be wrong at night, in rain, behind a van." | Accuracy dashboard + manual calibration — per-spot confidence, an explicit *uncertain* state, debounce, and a count tool that scores accuracy against ground truth | ✅ |
| 8 | "Our cameras do not point at the parking." | Camera coverage wizard — draw the bays, get % of lot covered, flags bays too small or occluded | |
| 9 | "Half those bays are tenants', disabled and EV." | Spot types — tag each bay, alert only on bays this driver may use | |
| 10 | "Fine, a spot is free. Where *is* it?" | Navigate to spot — lot / floor / bay in the alert, plus a deep link to Waze or Google Maps for the lot entrance | ✅ |
| 11 | "What do I show my board after a month?" | Pilot KPI report — occupancy by hour, peaks, alert count, estimated search minutes saved, accuracy %, export to PDF/CSV | |
| 12 | "It has to talk to the systems we already pay for." | Open feed — JSON/webhook of occupancy and spot-freed events for entry signs, Pango/Cellopark-style apps, building systems | |
| 13 | "What do drivers see at the gate?" | Entrance sign mode — a full-screen kiosk view, "חניון X: 23 פנויים", for a TV at the barrier | ✅ |
| 14 | "What happens when a camera dies and nobody notices?" | Health monitor — camera-offline and frozen-frame detection, alert to the manager, last-known state shown with its timestamp | |
| 15 | "We have more than one lot." | Multi-lot view per park, one JSON config per lot | |
| 16 | "And when cars do this themselves?" | Car API spec (document only) — how connected cars and fleet apps subscribe to spot-freed and claim events | |

## Why these six are the meeting set

Rows 1, 2, 5, 7, 10 and 13 are not the five most interesting features. They are
the ones whose absence ends the conversation in the room:

* **1 and 2** — without a live detection and a visible alert, everything else
  is a slide deck. These two *are* the demo.
* **5** — Israel's Amendment 13 to the Privacy Protection Law raised the stakes
  for anyone processing personal data, and a camera pointed at a car park is
  exactly the thing a property manager has been warned about. The answer has to
  be structural ("the frame never leaves the browser and is never stored"), not
  a promise, which is why it is a design constraint and a one-page DPIA rather
  than a bullet on a slide.
* **7** — the first thing anyone technical does is look for a bay the system
  got wrong. A yellow *uncertain* bay survives that test; a confident wrong
  green does not.
* **10** — "a spot is free somewhere in a 220-space lot" is not a product.
* **13** — the gate screen is the one surface every driver sees, and it is the
  cheapest thing in the list to deploy.

Rows 3, 4 and 16 are deliberately *after* the meeting: they are the ones that
turn a browser demo into an operated service, and none of them survives
contact with a customer who has not yet agreed the demo works.

## The constraints the register is written against

* **Detection runs in the browser.** Not a cost decision — it is what makes the
  privacy answer in row 5 true by construction rather than by policy. The
  optional relay in row 3 exists precisely so the no-server promise can stay
  intact while still reaching a driver who is not in the lot: it carries the
  event, never the frame.
* **One event, many consumers.** The toast (row 2), the relay (row 3), the
  claim (row 4), the open feed (row 12), the sign (row 13) and the car API
  (row 16) are all consumers of the same `spot-freed` event. That event is
  implemented once, in `src/lib/spot-freed.js`, and the wire shape is fixed at
  `{lot, spotId, freedAt}` — three fields, chosen so that there is nothing in
  a payload that *could* identify a person even if the relay were breached.
* **Uncertainty is a state, not an error.** Rows 7 and 14 both come down to the
  same rule: the system is allowed to say "I do not know about this bay", and
  saying so is cheaper than being wrong.
* **Hebrew, RTL, GitHub Pages, no build step.** Every surface must open from a
  static host and work offline through `sw.js`. This is a pilot that gets shown
  on someone else's laptop on someone else's Wi-Fi.

## What is built so far

| row | state |
|---|---|
| 2, 9 (model) | `src/lib/spot-freed.js` — transitions, debounce, uncertain state, spot types, eligibility, relay payload (slice 1, on `master`) |
| 2, 10 (presentation) | `src/lib/spot-freed.js` — Hebrew alert text, freshness, navigation links (slice 2) |
| 2, 9, 10 (demo) | the "התפנה מקום" feed on `demo/atidim-board.html` (slice 3) |
| 2 (camera demo) | `src/lib/spot-events.js` feeds the `parkwiz:spot-freed` toast on `demo/atidim.html` (#263) |
| 3, 5 | `relayPayload()` is whitelist-built and pinned by test; the relay endpoint itself is not written yet |
| 1, 7 | `src/lib/vision-occupancy.js` is the detection engine; the live camera page is still open on #264 |

The remaining rows are tracked as sub-issues in
[`docs/dev/PR-265-SPLIT.md`](dev/PR-265-SPLIT.md), each scoped to land under the
400-line merge cap.
