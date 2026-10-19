# Built-in agents (#269) — what landed, and the slices for the rest

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). This PR is **1,914**, so it does not auto-merge as one piece. It is
one coherent feature — the agent runtime plus the two agents named in the
acceptance criterion — and the table below is the seam set that takes it apart
into mergeable slices without dropping or duplicating a line.

Measured, not estimated: `git diff --cached --numstat` in this worktree.

## What this PR contains

| file | +/− | layer |
|---|---|---|
| `src/agents/bus.js` | +82 | the single in-page event bus |
| `src/agents/runtime.js` | +154 | agent registry, on/off, action log, cascade bound |
| `src/agents/driver.js` | +196 | driver agent (item 1) with the EV rule of #267 folded in |
| `src/agents/manager.js` | +177 | lot-manager agent (item 2) |
| `test/agents-bus.test.js` | +110 | bus contract |
| `test/agents-runtime.test.js` | +175 | runtime contract |
| `test/agents-driver.test.js` | +224 | driver agent, including the EV and hold cases |
| `test/agents-manager.test.js` | +176 | manager agent, summary and anomalies |
| `demo/atidim.html` | +197 −6 | the agents panel and the page's publish/render wiring |
| `test/atidim-demo-smoke.test.js` | +148 −3 | the acceptance run through the page's own handlers |
| `test/agents-panel-ui.test.js` | +250 | panel markup, wiring, and the end-to-end acceptance run |
| `sw.js` | +7 −1 | the four agent modules into the offline shell, cache v18 → v19 |
| `test/pricing-ui-a11y.test.js` | +6 −2 | its exact-version cache pin widened to a floor |

## The slices

| # | slice | paths | changed lines | needs |
|---|---|---|---|---|
| 1 | the event bus | `src/agents/bus.js`, `test/agents-bus.test.js` | 192 | — |
| 2 | the agent runtime | `src/agents/runtime.js`, `test/agents-runtime.test.js` | 329 | 1 |
| 3 | the driver agent | `src/agents/driver.js`, `test/agents-driver.test.js` | 420 | — |
| 4 | the lot-manager agent | `src/agents/manager.js`, `test/agents-manager.test.js` | 353 | — |
| 5 | the panel and the offline shell | `demo/atidim.html`, `sw.js`, `test/atidim-demo-smoke.test.js`, `test/pricing-ui-a11y.test.js` | 370 | 1–4 |
| 6 | the end-to-end acceptance test | `test/agents-panel-ui.test.js` | 250 | 5 |

192 + 329 + 420 + 353 + 370 + 250 = 1,914 — all of this PR.

Slices 1–4 are pure `src/agents` + tests and touch no page, so they are safe in
any order among themselves (2 only needs 1 for its own test to compile). Slice
5 is the only one that changes a surface, and it needs all four modules present
because `demo/atidim.html` `<script src>`s all of them and `sw.js` precaches
them — landing it early would fail `sw-precache.test.js`.

**Slice 3 is 20 lines over the limit.** The cheapest honest trim is to move the
three EV/battery tests (`a low battery sends the driver…`, `a healthy battery
leaves the charger bonus out…`, `an unknown battery level is treated as
healthy…`) into their own file alongside slice 7 below, where the standalone EV
agent lives. That is ~40 lines out of slice 3, putting it at ~380.

## What is implemented

Items 1 and 2 of the issue, which are what the acceptance criterion names
("driver agent alerts on a freed spot and manager agent shows a summary; no
console errors"), plus the architecture the other three agents plug into.

The shared interface is `{ name, labelHe, onEvent(evt), tick(now), report() }`.
`onEvent` and `tick` return **actions**, never side effects — the runtime is the
only thing that puts an action back on the bus. That inversion is the reason
every agent is unit-testable in plain `node --test` with no DOM, and the reason
an operator can switch one off mid-demo: a disabled agent is simply never
called.

Two things are deliberately bounded. A re-emitted action carries `depth + 1` and
stops at `MAX_DEPTH`, so an agent reacting to its own action can never spin the
page; and actions are **queued and drained after** a dispatch pass rather than
emitted inline, because emitting inline let the driver's alert overtake the
`spot-freed` that caused it (the manager saw the alert for a stall before it saw
the stall free up, purely because the driver is registered first).

### The event vocabulary

This is the contract the remaining slices code against. Published by the page:

| event | payload | meaning |
|---|---|---|
| `spot-freed` | `spotId, distanceM, spotType, evCharger, cameraId, lotName, lat?, lon?` | a stall in the frame went from occupied to free |
| `spot-taken` | same shape | the reverse |
| `occupancy-sample` | `hour, rate, available, capacity` | a reading of the whole lot |
| `driver-waiting` | `driverId, maxWalkM, needsEv, batteryPct, spotType` | someone is looking for a stall |
| `driver-done` | `driverId` | they parked or gave up |

Emitted by agents, and visible to the others:

| action | from | meaning |
|---|---|---|
| `driver-alert` | driver | this stall, this far, held this long, this Waze link |
| `hold-release` | driver | the #265 row 4 hold is let go (`expired` / `taken` / `upgraded` / `driver-done`) |
| `manager-anomaly` | manager | `full-early` or `sudden-drop` |
| `manager-summary` | manager | the closing summary, emitted when the day rolls over past midnight |

### Honesty notes carried in the code

* `MINUTES_SAVED_PER_ALERT` (7) is a **stated demo assumption**, and the Hebrew
  summary says so inline (`הנחת דמו: 7 דק׳ להתראה`). It is not a measurement and
  must not become one until a pilot earns it.
* `FRAME_SPAN_M` (60) and `EV_EVERY` (6) are demo geometry, declared on the
  **page** side rather than inside an agent, so the agent never looks like it
  knows a lot it has not been calibrated against.
* The Waze link uses `ll=` only when the caller actually supplies coordinates,
  and `q=` by lot name otherwise. No coordinates are invented for Park Atidim: a
  wrong pin sends a driver to the wrong gate, which is worse than a name search.
* A frame **replacement** (reset, camera switch) publishes nothing. Diffing 24
  stalls into 24 `spot-freed` events would be a lie about the lot, so
  `applySpots` only publishes a same-frame occupancy flip.

## What is not implemented yet

Items 3, 4 and 5 of #269. Each is a self-contained slice against the vocabulary
above and needs no change to the bus, the runtime or the panel — the panel
renders whatever `runtime.list()` and `runtime.reports()` return.

### Slice 7 — camera-health agent (item 3, #265 rows 7 and 14)

New page event `camera-frame` → `{ cameraId, luma, confidence, frameSig, at }`,
published once per drawn frame. The agent holds the last reading per camera and
decides:

| condition | rule | action |
|---|---|---|
| offline | no `camera-frame` for that camera within `OFFLINE_MS` — detected in `tick(now)`, not `onEvent` | `camera-alert` `kind: 'offline'` |
| frozen | `frameSig` identical for `FROZEN_FRAMES` consecutive frames while the lot is not empty | `camera-alert` `kind: 'frozen'` |
| dark | `luma` below `DARK_LUMA` outside the known night hours | `camera-alert` `kind: 'dark'` |
| low confidence | mean `confidence` below `MIN_CONFIDENCE` over a window | `camera-alert` `kind: 'recalibrate'`, suggesting the #265 row 14 recalibration |

Note the `sudden-drop` anomaly the manager agent already raises says "check
whether a camera went down or froze" — once this agent exists, that anomaly
should name the camera instead of asking the operator to go looking. Estimated
~90 lines of agent, ~110 of test, ~25 of page wiring.

### Slice 8 — prediction agent (item 4)

Learns the hourly pattern from the lot's own history rather than from the
hard-coded `HOURLY_RATES` curve: `occupancy-sample` events accumulate into a
per-hour mean kept in `localStorage` under one versioned key, and `report()`
answers "expected free in ~X min" for the current hour.

Two constraints from this repo that are not optional:

* **No `Math.random`.** `src/lib/predict.js` carries a Sentinel guard against
  exactly that and its test greps the source; the new agent's test should do the
  same. Same street/hour in, same number out.
* It must phrase the answer as a **window**, not a promise. `src/lib/margin.js`
  already exists for precisely this (`computeArrivalMargin`, tone
  `חיזוי, לא הבטחה`) and should be reused rather than reinvented — a single
  predicted minute reads as a guarantee, and a driver who arrives to a full lot
  concludes the app lied.

`localStorage` needs a guard: it throws in Safari private mode, and an agent
that throws on construction would currently be caught by the runtime's
`failures()` but would leave the panel with a dead agent. Estimated ~85 lines of
agent, ~120 of test.

### Slice 9 — standalone EV agent (item 5, #267)

The **rule** of item 5 already ships here: `needsCharger()` in
`src/agents/driver.js` treats a driver below `EV_LOW_PCT` (20%) as needing a
charger even if they never asked, and `scoreSpot` then weights a charger bay at
`+EV_BONUS` against `−EV_MISS_PENALTY` for a mismatch — so a 15% battery walks
past a closer plain stall to reach a charger. `test/agents-driver.test.js` pins
that, and the panel's "simulate a waiting driver" button deliberately uses a
15% battery so the behaviour is visible in the demo.

What a separate agent would add beyond that rule is charger **state** the driver
agent has no business tracking: which bays are occupied by a car that has
finished charging, how long a session has run, and whether to ask an operator to
move a fully-charged car off a bay that someone at 8% is waiting for. That needs
a charger-session event from #267 that does not exist yet, which is why it is
last. Estimated ~60 lines of agent, ~90 of test.

## Running the acceptance check

```
npm test                      # 561 tests, all green on this branch
```

The acceptance criterion is covered twice over, on purpose. `test/agents-panel-
ui.test.js` builds the bus, runtime and both agents and drives the Atidim
09:00 frame; `test/atidim-demo-smoke.test.js` executes `demo/atidim.html`'s own
inline script against a stub DOM with the four agent modules loaded exactly as
the `<script src>` tags load them, then clicks the real handlers — so the
"driver agent alerts on a freed spot, manager agent shows a summary, no console
errors" run is verified through the page's own code, not a re-implementation of
it. The smoke harness asserts `bus.errors()` and `runtime.failures()` are both
empty, which is the mechanical form of "no console errors".

To see it by hand: open `demo/atidim.html`, press
**הדמה נהג ממתין (רכב חשמלי, 15%)**, then **- הדמה יציאת רכב** (or click an
occupied stall in the frame).
