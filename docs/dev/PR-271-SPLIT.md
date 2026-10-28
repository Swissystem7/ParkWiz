# PR #271 — split into PRs of at most 400 changed lines (Refs #272)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #271](https://github.com/Swissystem7/ParkWiz/pull/271) is
**2107**, so it never auto-merges as one piece. Head `d432a41` (branch
`origin/claude/ParkWiz-269-20261019-090959`), one commit cut against `master` at
`159babb`; every `git show` below assumes that sha stays reachable, which it
does as long as the branch is not deleted.

It is items 1 and 2 of issue #269: an in-page event bus, a runtime that
registers agents and puts their actions back on the bus, a driver agent (with
the #267 EV rule and the #265 row 4 soft hold), a lot-manager agent, and the
Hebrew agents panel on `demo/atidim.html` that lets an operator switch each
agent off mid-demo. Master has since moved to `abc47ef`, which helps rather than
conflicts: #276 already converted the exact `sw.js` cache pin in
`test/pricing-ui-a11y.test.js` into a floor, so #271's own version of that fix —
the only file in it touching an existing test expectation — drops entirely.

## The slices

Sizes are measured, not estimated. Per-file numbers come from
`git diff --numstat master...d432a41`; the two intra-file cuts were
materialised and counted line by line.

| # | slice | changed lines | needs |
|---|---|---|---|
| 1 | the event bus (**this PR**) | 192 | — |
| 2 | the agent runtime | 329 | 1 |
| 3 | the driver agent | 392 | — |
| 4 | the lot-manager agent | 353 | — |
| 5 | the #267 EV rule, as its own test | 34 | 3 |
| 6 | the panel, the page wiring, the offline shell | 363 | 1, 2, 3, 4, 8 |
| 7 | the end-to-end acceptance test | 250 | 6 |
| 8 | the agent architecture doc | 145 | — |

The slices sum to **2058**: 2107 minus the 8 dropped
`test/pricing-ui-a11y.test.js` lines and the 47 lines of superseded split plan
slice 8 drops, plus the 6-line header slice 5's new test file needs. Nothing
else is dropped.

Slices 1, 3, 4 and 8 are independent of everything, including each other:
`src/agents/driver.js` and `src/agents/manager.js` are standalone modules whose
tests `require` only themselves. Only slice 6 touches a surface, and it needs
all four modules present because `demo/atidim.html` `<script src>`s every one of
them and `sw.js` precaches them — `test/sw-precache.test.js` asserts *every
library a precached page `<script src>`s is precached too*, so landing the page
early fails that test rather than slice 6's own.

Landing order: **1 → 3 → 4 → 8 → 2 → 5 → 6 → 7**.

**Status (2026-10-20, #310):** slice 1 landed via #284, slice 3 via #334.
Slices 4 and 5 ship together on the #310 branch (353 + 34 = 387, under the
limit; `npm test` 641 passing). Slice 2 (the agent runtime) ships on this
branch (#358). Still to open: 8, then 6 and 7.

### Slice 1 — the event bus (this PR, 192)

`src/agents/bus.js` (+82) and `test/agents-bus.test.js` (+110), unchanged from
`d432a41`. Shipped as code on this branch; `npm test` is green — **486
passing**, up from 475, the 11 new tests being the bus contract.

This is the dependency root and the only file every other slice agrees on, so it
is the one worth landing first. Two properties in it are load-bearing downstream
and are what the tests pin: an event always carries a finite `at` (a missing
timestamp becomes `Date.now()`, because an `undefined` turns every later age
comparison into `NaN` and so silently disables every `tick`), and a handler that
throws is **recorded, not rethrown**, so one broken agent cannot take the others
down or put a red console error on an operator's screen — that last one is an
explicit acceptance item of #269. `sw.js` does **not** precache `bus.js` here;
the precache entry belongs with the `<script src>` tag that needs it, in slice 6.

### Slice 2 — the agent runtime (329) — on this branch (#358)

`src/agents/runtime.js` (+154) and `test/agents-runtime.test.js` (+175),
unchanged. Needs slice 1 only so its own test can `require` the bus.
Two bounded behaviours here are why the panel cannot wedge: a re-emitted action
carries `depth + 1` and stops at `MAX_DEPTH` (3), and actions are **queued and
drained after** a dispatch pass rather than inline — emitting inline let the
driver's alert overtake the `spot-freed` that caused it, so the manager saw an
alert for a stall before it saw the stall free up, purely because the driver is
registered first.

### Slice 3 — the driver agent (392)

`src/agents/driver.js` (+196) and `test/agents-driver.test.js` **minus lines
85–112** (+196) — the file's 224 lines less the EV block, which moves to slice 5.
At 420 on the branch the slice is 20 over the limit, which is why the cut exists;
the EV block is the right place to make it, being the only part belonging to a
different issue (#267) and exercising `scoreSpot` and `needsCharger` as pure
functions, so it stands alone cleanly.

The import list at lines 11–12 of that test has to lose `needsCharger` and
`EV_LOW_PCT` along with the block; they are used nowhere else in the remainder,
and leaving them is the dangling reference an intra-file split usually ships by
accident. Everything else stays: the walk-limit filter, the accessible hard
filter, the per-50 m cost, the `SWITCH_MARGIN` re-alert guard, the four ways a
hold is released (`expired` / `taken` / `upgraded` / `driver-done`), and the
`Math.random` source grep.

### Slice 4 — the lot-manager agent (353)

`src/agents/manager.js` (+177) and `test/agents-manager.test.js` (+176),
unchanged. Independent of 1, 2 and 3. The part worth reviewing twice is
`MINUTES_SAVED_PER_ALERT` (7): a **stated demo assumption**, said so inline in
the Hebrew summary (`הנחת דמו: 7 דק׳ להתראה`), not a measurement, and it must not
become one until a pilot earns it. The anomaly rules are the other half —
`full-early` and `sudden-drop` each fire **once**, because an alert that repeats
every sample is an alert nobody reads.

### Slice 5 — the #267 EV rule, as its own test (34)

New file `test/agents-driver-ev.test.js`: lines **87–111** of
`test/agents-driver.test.js` (25) under a 9-line header requiring `scoreSpot`,
`needsCharger` and `EV_LOW_PCT` from `src/agents/driver`.

The rule itself ships in slice 3 — `needsCharger()` treats a driver below
`EV_LOW_PCT` (20%) as needing a charger even if they never asked, and
`scoreSpot` weights a charger bay at `+EV_BONUS` against `−EV_MISS_PENALTY` for
a mismatch, so a 15% battery walks past a closer plain stall to reach one. This
slice is the named file saying so, which is where #267 will look. 34 lines is
small enough to be noise; fold it into slice 7 (250 → 284) if a reviewer prefers.

### Slice 6 — the panel, the page wiring, the offline shell (363)

`demo/atidim.html` (+197 −6), `sw.js` (+7 −1),
`test/atidim-demo-smoke.test.js` (+148 −3) and `README.md` (+1, retargeted: the
bullet on the branch links `./docs/dev/PR-269-SPLIT.md`, which slice 8 replaces,
so point it at `./docs/agents.md`).

The page change is four pieces: 8 lines of `<style>`, the 19-line Hebrew panel
(per-agent toggles, two live summaries, the action log and its empty state), the
four `<script src>` tags, and the 156-line hunk that publishes the page's own
observations onto the bus and renders what comes back. The `sw.js` entries and
the `v18 → v19` bump land here because the precache test ties them to those
tags. Two page-side decisions to keep through the move, both about not lying
about the lot: a frame **replacement** (reset, camera switch) publishes nothing,
since diffing 24 stalls into 24 `spot-freed` events would be a lie, so
`applySpots` publishes only a same-frame occupancy flip and the smoke test pins
that; and `FRAME_SPAN_M` (60) and `EV_EVERY` (6) are declared on the **page**,
so no agent looks like it knows geometry it has not been calibrated against.

### Slice 7 — the end-to-end acceptance test (250)

`test/agents-panel-ui.test.js` (+250), unchanged. Needs slice 6: it asserts the
page loads every agent module, that the four are in the offline shell behind a
cache bump, and that agent text reaches the DOM as text and never as
`innerHTML`. It then builds the bus, the runtime and both agents and drives the
Atidim 09:00 frame for the acceptance run of #269 — a freed stall produces a
driver alert with a working Waze link, the manager shows a Hebrew summary that
counts that alert, a switched-off agent goes quiet, and `bus.errors()` and
`runtime.failures()` are both empty, which is the mechanical form of "no console
errors". It overlaps slice 6's smoke test on purpose: slice 6 proves the run
through the page's own inline handlers, slice 7 through the modules directly, and
the two failing differently is the signal worth having.

### Slice 8 — the agent architecture doc (145)

`docs/dev/PR-269-SPLIT.md` lines **54–192** (139) as a new `docs/agents.md`,
under a 6-line header. Lines 1–53 are that file's own split plan — an
estimate-based table that said 1,914 when the PR is 2107 — and they drop,
superseded by this file. What is left is not a split plan at all and should not
have been buried in one: the shared `{ name, labelHe, onEvent, tick, report }`
interface and why `onEvent` returns actions instead of causing effects, the
event and action vocabulary slices 2–7 code against, the honesty notes on the
demo constants, and the designs for #269 items 3, 4 and 5 (camera-health,
prediction, a standalone EV agent) that nothing in #271 implements. Its
cross-references become plain paths, not markdown links, since it may land
before the page does.

## Handing the GitHub steps back

This worktree cannot push, open or close PRs (`gh` and network git are
unapprovable here), and the outer script opens exactly one draft PR — slice 1
plus this document. The other seven come from `d432a41`: branch off `master`, or
off the last slice in the **needs** column where there is one, then
`git checkout d432a41 -- <the paths named above>` and apply any line-range trim.
Verify
each with `git diff --shortstat master...HEAD` before opening — additions +
deletions is what `auto_merger` reads — and run `npm test`.

## Close comment for #271

```md
Closing in favour of the split: `auto_merger` merges at most 400 changed lines,
and this PR is 2107. The plan, with measured sizes and the exact line ranges for
the two intra-file cuts, is in
[`docs/dev/PR-271-SPLIT.md`](../../blob/master/docs/dev/PR-271-SPLIT.md).

| # | slice | lines | PR |
|---|---|---|---|
| 1 | the event bus | 192 | #<!--1--> |
| 2 | the agent runtime | 329 | #<!--2--> |
| 3 | the driver agent | 392 | #<!--3--> |
| 4 | the lot-manager agent | 353 | #<!--4--> |
| 5 | the #267 EV rule, as its own test | 34 | #<!--5--> |
| 6 | the panel, the page wiring, the offline shell | 363 | #<!--6--> |
| 7 | the end-to-end acceptance test | 250 | #<!--7--> |
| 8 | the agent architecture doc | 145 | #<!--8--> |

Two things drop rather than move: `test/pricing-ui-a11y.test.js` (master already
has that cache floor, via #276) and the first 53 lines of
`docs/dev/PR-269-SPLIT.md` (its own estimate-based split plan, superseded — the
remaining 139 lines become `docs/agents.md` in slice 8). The slices sum to 2058:
2107 minus those 8 and 47 lines, plus the 6-line header the new EV test file
needs. Nothing else is dropped. Landing order is
**1 → 3 → 4 → 8 → 2 → 5 → 6 → 7**; 1, 3, 4 and 8 are independent of everything,
including each other.

**Do not delete `claude/ParkWiz-269-20261019-090959`.** Every slice is built
from `d432a41` and is unreachable without it.
```
