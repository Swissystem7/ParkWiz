# PR #204 — split into PRs of at most 400 changed lines (Refs #205)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #204](https://github.com/Swissystem7/ParkWiz/pull/204) was
**403** — the same three-over margin [#194](PR-194-SPLIT.md) hit, and the same
hard no. PR #204 head: `93a6725` (branch
`origin/claude/ParkWiz-201-20261016-022031`), one commit off `master` at
`7e4dc46`.

> **Status.** The split is **complete**. Slice 1 landed as
> [#206](https://github.com/Swissystem7/ParkWiz/pull/206) (`master` at
> `7d23c9b`), which also pulled forward a first cut of slice 2's panel; the
> remainder of slice 2 landed via #208, whose add/add conflicts against #206 are
> written up in [`PR-208-CONFLICT-RESOLUTION.md`](PR-208-CONFLICT-RESOLUTION.md).
> The sizing and the seam below are kept because they are the record of *why*
> the cut fell where it did.

## What PR #204 contained

| file | +/− | layer |
|---|---|---|
| `src/lib/margin.js` | +162 | the arrival-margin model — pure, no lot baked in |
| `test/margin.test.js` | +116 | 6 model cases + 1 board-page case |
| `demo/atidim-board.html` | +61 | the margin panel: two sliders, a band, the advice line |
| `test/atidim-board-page.test.js` | +40 | 3 cases for that panel |
| `src/lib/atidim-lot.js` | +14 | `localMinuteOfDay` — the board's clock in minutes |
| `docs/launch/CITYZONE-ATIDIM.md` | +6 −1 | the walkthrough step and the privacy caveat |
| `sw.js` | +2 −1 | precache `margin.js`, bump the cache name |

A model that knows no particular lot, and the board page that feeds it one.
That is the seam.

## The slices

Sizes were measured, not estimated — `git diff --cached --numstat` with each
slice materialized against `master` at `0db6628`.

| # | slice | changed lines | needs |
|---|---|---|---|
| 1 | the arrival-margin model | 254 + this doc | — |
| 2 | the margin panel on the operator board | 149 | slice 1 |

254 + 149 = 403, which is all of #204: nothing dropped, nothing duplicated. They
are **ordered, not independent** — slice 2's page `<script src>`s
`src/lib/margin.js`, so slice 1 lands first.

### Slice 1 — the arrival-margin model

`src/lib/margin.js` (+162) and `test/margin.test.js` (+92, six cases).

A single predicted number invites the driver to race it: "4 free at 10:00" reads
as a promise, so arriving at 10:07 to a full lot looks like the app lied.
`arrivalMargin({ freeByHour, total, nowMinutes, etaMinutes, bufferMinutes })`
answers with the honest shape of the same prediction — a *window* of arrival
times and the *range* of free bays across it, wide for two separate reasons: the
curve moves inside the window, and a guess 40 minutes out is a weaker claim than
a 2-minute one (`SLACK_PER_MIN`, one bay of doubt per quarter-hour). It reads the
curve *between* the hours, so a 10-minute window is not flat; it wraps across
midnight; a partial or NaN-holed curve returns `null` rather than a confident
zero; and no label may promise a spot — the tone line is always
`חיזוי, לא הבטחה`. The curve is passed in (`freeByHourFromSeries` converts an
`hourlySeries`), so the file knows no particular lot.

**Landed as #206**, with `test/margin.test.js`'s seventh case (the one that reads
`demo/atidim-board.html`) pulled forward from slice 2, and with an ad-hoc version
of the panel itself.

### Slice 2 — the margin panel on the operator board

**149** changed lines: the page (+61), its tests (+40), `localMinuteOfDay` (+14),
`test/margin.test.js`'s seventh case (+24), the runbook (+6 −1) and `sw.js`
(+2 −1).

Two sliders — drive time (0–45 min) and safety margin (±0–30 min) — rewrite an
`aria-live="polite"` window headline, a band drawn to scale against the lot's
capacity, and a one-line piece of advice. They move the window only: unlike the
hour scrubber they must not drop the counters out of clock-follow, and
`test/atidim-board-page.test.js` pins exactly that.

`localMinuteOfDay` exists because the window is quoted in minutes — rounding
"now" down to the hour, as `localHour` does for the counters, would slide the
whole window by up to 59 minutes.

**Landed in two parts.** #206 took the page, `localMinuteOfDay` and the seventh
test case along with slice 1. What it left behind — the `sw.js` precache entry,
the three page cases, the runbook step, and the panel behaviour the first cut
simplified away — landed via #208. The split's claim that nothing is dropped only
held once that remainder shipped.

## A follow-up this split does not do

`master` already has a Waze-style arrival margin:
`atidim-lot.computeArrivalMargin(hour, capacity)`, landed by #203 for the
**camera** model (the real 220-space lot, behind `demo/atidim.html`). #204's
`margin.js` is a second one, for the **board** model (the 18-bay synthetic lot,
behind `demo/atidim-board.html`) — the two-views-of-one-lot split that
`src/lib/atidim-lot.js` documents at the top of the file.

They do not collide: different curves, different pages, no shared symbol. But
they are the same idea twice, and `margin.js` is the more general — it takes any
24-point curve, where `computeArrivalMargin` closes over `HOURLY_RATES`. The end
state is probably one model with two callers. **That is a refactor, not a
split**, so neither slice attempts it; it wants its own issue, and both of these
have now landed, so there is something to unify.
