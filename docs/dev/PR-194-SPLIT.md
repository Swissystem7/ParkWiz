# PR #194 — split into PRs of at most 400 changed lines (Refs #195)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #194](https://github.com/Swissystem7/ParkWiz/pull/194) is
**403** — three over, which is the most annoying possible margin, but it is
still a hard no.

PR #194 head: `d9f8f30` (branch `origin/claude/ParkWiz-191-20261015-145538`),
cut against `master` at `39ca322`. Every `git show` below assumes that sha is
still reachable; it is, as long as the branch is not deleted.

## What PR #194 contains

| file | +/− | layer |
|---|---|---|
| `src/lib/atidim-lot.js` | +26 −13 | one clock for both views of the Atidim lot |
| `test/atidim-lot-clock-zone.test.js` | +75 | the seven cases that pin it |
| `docs/dev/PR-179-SPLIT.md` | +149 | the #179 split plan, with its stale-status note |
| `docs/dev/PR-184-CONFLICT-RESOLUTION.md` | +153 | why #184 conflicted and how it was resolved by hand |

Two unrelated things, one of which is code and one of which is paper. That is
the seam.

## The slices

Sizes are measured, not estimated — `git diff --cached --shortstat` in this
worktree with each slice materialized.

| # | slice | paths | changed lines | needs |
|---|---|---|---|---|
| 1 | one clock for both views of the lot (**this PR**) | `src/lib/atidim-lot.js`, `test/atidim-lot-clock-zone.test.js` | 101 + this doc | — |
| 2 | the #179 / #184 paper trail | `docs/dev/PR-179-SPLIT.md`, `docs/dev/PR-184-CONFLICT-RESOLUTION.md` | 302 | — |

101 + 302 = 403, which is all of #194: nothing is dropped and nothing is
duplicated. The two slices are independent in both directions and can land in
either order.

### Slice 1 — one clock for both views (this PR)

Shipped as code on this branch. This is the part of PR #184 that survived its
hand-resolution against `master`, and the only part of #194 that changes
behaviour.

`src/lib/atidim-lot.js` holds two views of the same lot: the **camera** model
(the real 220-space lot, `formatLotClock` / `lotHour`) and the **demo** model
(the 18-bay synthetic lot behind `demo/atidim.html`, `localHour` /
`liveSnapshot`). Both need the hour of day at the lot, and before this change
they each built their own `Intl.DateTimeFormat` — but only the camera one had
the two fixes that matter:

1. **A fallback to host local time** when the runtime has no IANA zone data
   (old WebView, `--without-intl` build). `localHour` had none, so on such a
   runtime it **threw** and took `liveSnapshot` — and therefore the whole demo
   page's first paint — with it.
2. **`hourCycle` h24 reporting midnight as `"24"`** in some engines. Hour 24 is
   off the end of a 24-point curve, so `liveSnapshot` just after midnight could
   read a bay state that does not exist.

So:

- `lotClockParts(date, timeZone)` takes an overridable zone, defaulting to
  `LOT_TIME_ZONE`. Opt-in: every existing caller passes no zone and gets
  byte-identical output, so `formatLotClock` and `lotHour` are untouched. The
  override exists because a demo page should be able to honour the zone that
  came out of `demo/atidim-data.json` rather than hard-coding the lot's own.
- `localHour` now goes through `lotClockParts` and normalises with
  `((h % 24) + 24) % 24`, inheriting both fixes instead of re-deriving neither.
- `DEFAULT.timezone` is `LOT_TIME_ZONE` instead of a second `'Asia/Jerusalem'`
  literal. The two views of one lot must not be able to disagree about what
  hour it is, and two literals is exactly how that drift starts.
- `hourlySeries` uses the file's own `pad2(h)` instead of
  `String(h).padStart(2, '0')`.

`test/atidim-lot-clock-zone.test.js` — 75 lines, seven cases: the two models
name one zone and agree on the hour; the override works and defaults to the
lot; a site config's zone reaches `liveSnapshot`; midnight is hour 0 in every
zone and reads the quiet end of the curve; an unusable zone falls back to host
local time instead of throwing; a bad clock input is hour 0 rather than `NaN`;
and the `hourlySeries` timestamps stay two-digit and `Date`-parseable.

> **Heads up for whoever lands the board-page work.**
> `origin/factory/laptop-claude-board-split-3` carries this *same* clock change
> — same four edits, byte-identical bodies — alongside a comment sweep that
> renames the demo model to the "board" model and points at
> `demo/atidim-board.html`. That page is not on `master`, which is why this
> slice keeps `master`'s demo-page wording. Once slice 1 lands, that branch's
> `src/lib/atidim-lot.js` hunks become a no-op for the clock and a pure comment
> change for the rest; resolve it by taking `master`'s clock and keeping only
> the renames. Its `test/atidim-lot-local-hour.test.js` (80 lines) overlaps this
> slice's test heavily but not entirely — check it for cases worth keeping
> before dropping it.

### Slice 2 — the #179 / #184 paper trail

```sh
git checkout master -b pr194-paper-trail
git checkout d9f8f30 -- docs/dev/PR-179-SPLIT.md docs/dev/PR-184-CONFLICT-RESOLUTION.md
```

**302** changed lines, verbatim from #194. Two documents that are useful
together and awkward apart:

- `PR-179-SPLIT.md` — the six-slice plan for PR #179 (1001 lines), with a
  status note recording that slices 1 and 2 landed by a different route (#155,
  #156) and what is still outstanding.
- `PR-184-CONFLICT-RESOLUTION.md` — why `auto_merger` could not merge #184:
  not two features fighting, but **one feature that landed twice** under two
  names (the "board" model vs the "demo" model), producing a large add/add
  conflict in `src/lib/atidim-lot.js`. Then the hunk-by-hunk record of the
  hand-resolution, which is where slice 1's code comes from.

They ship as one PR because `PR-179-SPLIT.md` links to
`PR-184-CONFLICT-RESOLUTION.md` by relative path; splitting them into 149 + 153
is also under the limit, but it leaves that link dangling in whichever lands
first. Pair them unless there is a reason not to.

**One amendment to make when opening slice 2.** `PR-179-SPLIT.md`'s status note
ends with *"What slice 1 still had to give … is the clock work the duplicate
landing dropped"*. If slice 1 has landed by then, say so — change that
paragraph's closing sentence to point at the merged PR rather than at #184's
pending merge. The rest of both documents stays accurate as a record; they are
history, not a plan to re-run.

## Verification

From this worktree, on `master` at `39ca322`:

1. Slice 1 applied — **365 / 365 pass**. Slice 1 adds exactly seven cases, so
   `master`'s baseline is 358 — the count `docs/dev/PR-179-SPLIT.md` records,
   which means nothing regressed.
   `formatLotClock` and `lotHour` are covered by the pre-existing camera tests,
   which confirms the `lotClockParts` signature change is genuinely opt-in.
2. Slices 1 + 2 materialized together — **365 / 365 pass**. Slice 2 is
   documentation and adds no tests; running it was about confirming it adds no
   *failures* either, since `test/pitch-doc.test.js` does read `docs/`.
3. Slice 2 removed again — back to 365, i.e. this branch.

## Hand-off

This branch carries slice 1 only. Slice 2 needs its own branch and push, which
this worktree cannot do. Once slice 2 is open, close PR #194 with a comment
listing both — suggested text:

> Closing in favour of two PRs that each fit `auto_merger`'s 400-changed-line
> limit. This PR is 403; the split is 101 + 302, which is all of it.
>
> - #&lt;slice 1&gt; — one clock for both views of the Atidim lot
>   (`src/lib/atidim-lot.js`, `test/atidim-lot-clock-zone.test.js`). The code
>   half: `lotClockParts` takes an overridable zone, and `localHour` goes
>   through it so the demo clock inherits the no-Intl fallback and the
>   midnight-as-"24" fix the camera clock already had.
> - #&lt;slice 2&gt; — the #179 / #184 paper trail (`docs/dev/PR-179-SPLIT.md`,
>   `docs/dev/PR-184-CONFLICT-RESOLUTION.md`). The paper half.
>
> Nothing is dropped. Sizing and per-slice reasoning:
> `docs/dev/PR-194-SPLIT.md`. Refs #195.
