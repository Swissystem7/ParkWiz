# PR #204 — split into PRs of at most 400 changed lines (Refs #205)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #204](https://github.com/Swissystem7/ParkWiz/pull/204) is
**403** — the same three-over margin [#194](PR-194-SPLIT.md) hit, and the same
hard no.

PR #204 head: `93a6725` (branch `origin/claude/ParkWiz-201-20261016-022031`),
one commit off `master` at `7e4dc46`. `master` has since moved to `0db6628`;
the three-dot diff is still 403 and the PR still merges cleanly — see
*Verification*. The `git checkout 93a6725 -- …` recipe below needs that sha to
stay reachable, which it is unless the branch is deleted.

## What PR #204 contains

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

Sizes are measured, not estimated — `git diff --cached --numstat` in this
worktree with each slice materialized against `master` at `0db6628`.

| # | slice | changed lines | needs |
|---|---|---|---|
| 1 | the arrival-margin model (**this PR**) | 254 + this doc | — |
| 2 | the margin panel on the operator board | 149 | slice 1 |

254 + 149 = 403, which is all of #204: nothing is dropped and nothing is
duplicated. They are **ordered, not independent** — slice 2's page `<script
src>`s `src/lib/margin.js`, so slice 1 lands first.

### Slice 1 — the arrival-margin model (this PR)

`src/lib/margin.js` (+162) and `test/margin.test.js` (+92, six cases).

A single predicted number invites the driver to race it: "4 free at 10:00"
reads as a promise, so arriving at 10:07 to a full lot looks like the app
lied. `arrivalMargin({ freeByHour, total, nowMinutes, etaMinutes,
bufferMinutes })` answers with the honest shape of the same prediction — a
*window* of arrival times and the *range* of free bays across it, wide for two
separate reasons: the curve moves inside the window, and a guess 40 minutes out
is a weaker claim than a 2-minute one (`SLACK_PER_MIN`, one bay of doubt per
quarter-hour). It reads the curve *between* the hours, so a 10-minute window is
not flat; it wraps across midnight; a partial or NaN-holed curve returns `null`
rather than a confident zero; and no label may promise a spot — the tone line
is always `חיזוי, לא הבטחה`. The curve is passed in (`freeByHourFromSeries`
converts an `hourlySeries`), so the file knows no particular lot.

**What slice 1 does not do:** nothing on a page calls it until slice 2 lands.
That is the cost of this cut — library and tests first, wiring next.

`test/margin.test.js` ships here minus #204's seventh case, which reads
`demo/atidim-board.html` and calls `lot.localMinuteOfDay`; both arrive in slice
2, so the case does too. The six that remain are pure-model: the curve comes
off the board lot and interpolates, a zero-margin ask still answers with a
window, the band widens with lookahead, a filling lot earns "leave earlier", a
band that could bottom out says `ייתכן גם אפס`, and bad input degrades to
`null` with silly asks clamped.

### Slice 2 — the margin panel on the operator board

```sh
git checkout master -b pr204-board-margin-panel
git checkout 93a6725 -- demo/atidim-board.html test/atidim-board-page.test.js \
                        test/margin.test.js sw.js docs/launch/CITYZONE-ATIDIM.md
# src/lib/atidim-lot.js moved under #204 when #203 landed, so take the hunks:
git diff 7e4dc46 93a6725 -- src/lib/atidim-lot.js | git apply
```

**149** changed lines: the page (+61), its tests (+40), `localMinuteOfDay`
(+14), `test/margin.test.js`'s seventh case (+24), the runbook (+6 −1) and
`sw.js` (+2 −1).

Two sliders — drive time (0–45 min) and safety margin (±0–30 min) — rewrite a
`aria-live="polite"` window headline, a band drawn to scale against the lot's
capacity, and a one-line piece of advice. They move the window only: unlike the
hour scrubber they must not drop the counters out of clock-follow, and
`test/atidim-board-page.test.js` pins exactly that.

`localMinuteOfDay` exists because the window is quoted in minutes — rounding
"now" down to the hour, as `localHour` does for the counters, would slide the
whole window by up to 59 minutes.

## A follow-up this split does not do

`master` already has a Waze-style arrival margin:
`atidim-lot.computeArrivalMargin(hour, capacity)`, landed by #203 for the
**camera** model (the real 220-space lot, behind `demo/atidim.html`). `#204`'s
`margin.js` is a second one, for the **board** model (the 18-bay synthetic lot,
behind `demo/atidim-board.html`) — the two-views-of-one-lot split that
`src/lib/atidim-lot.js` documents at the top of the file.

They do not collide: different curves, different pages, no shared symbol, clean
merge. But they are the same idea twice, and `margin.js` is the more general —
it takes any 24-point curve, where `computeArrivalMargin` closes over
`HOURLY_RATES`. The end state is probably one model with two callers. **That is
a refactor, not a split**, so neither slice attempts it; it wants its own issue
and both of these landed first, so there is something to unify.

## Verification

From this worktree, on `master` at `0db6628`:

1. Baseline — **404 / 404 pass**.
2. Slice 1 applied — **410 / 410**. Six new cases, nothing regressed.
3. Slices 1 + 2 both materialized — **414 / 414**, and `git diff --numstat
   HEAD` on that tree reproduced #204's seven-file diff exactly: 403 lines,
   file for file. So the split recombines to the PR with nothing lost, and
   #204 is blocked on size alone — not on a conflict with #203.
4. Slice 2 reverted — back to 410, i.e. this branch.

## Hand-off

This branch carries slice 1 only. Slice 2 needs its own branch and push, which
this worktree cannot do. Once it is open, close PR #204 with a comment listing
both — suggested text:

> Closing in favour of two PRs that each fit `auto_merger`'s 400-changed-line
> limit. This PR is 403; the split is 254 + 149, which is all of it.
>
> - #&lt;slice 1&gt; — the arrival-margin model (`src/lib/margin.js`,
>   `test/margin.test.js`). A pure, lot-agnostic model that answers with a
>   window of arrival times and a *range* of free bays, never one number that
>   reads as a spot held for the driver.
> - #&lt;slice 2&gt; — the margin panel on the operator board
>   (`demo/atidim-board.html`, `src/lib/atidim-lot.js`, `sw.js`, the runbook and
>   the page tests). The wiring: two sliders, the band, the advice line.
>
> Land slice 1 first — slice 2's page loads `src/lib/margin.js`. Nothing is
> dropped. Sizing, the slice-2 recipe, and a note on the second arrival-margin
> implementation #203 already put on `master`:
> [`docs/dev/PR-204-SPLIT.md`](docs/dev/PR-204-SPLIT.md). Refs #205.
