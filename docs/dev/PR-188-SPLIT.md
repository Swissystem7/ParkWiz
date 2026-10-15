# PR #188 — splitting it into auto_merger-sized PRs (Refs #192)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #188](https://github.com/Swissystem7/ParkWiz/pull/188) is
`12 files changed, 942 insertions(+), 40 deletions(-)` = **982 changed lines**,
so it can never merge as one piece.

PR #188 head: `daec5fc072de6fc17bbaf4b0646aceb68265aff0`
(branch `claude/ParkWiz-181-20261015-142023`), merge base `2318a36`.
`master` is at `39ca322`, one commit ahead of that base (#156, which added
`test/atidim-demo-smoke.test.js`). Every size below is measured against
`39ca322`, not against the merge base.

## Read this first: three of the four slices are already open

PR #188 is **not new work**. The #181 run did the split, pushed it as three
branches, and then the outer script also committed the whole worktree and
opened #188 on top of it. The three branches are open as PRs, and they were
pushed 18 minutes *before* #188's commit:

| PR | branch | commit | base |
|----|--------|--------|------|
| [#185](https://github.com/Swissystem7/ParkWiz/pull/185) | `factory/laptop-claude-board-split-1` | `2bac794` 14:09:14 | `2318a36` |
| [#186](https://github.com/Swissystem7/ParkWiz/pull/186) | `factory/laptop-claude-board-split-2` | `ad20efd` 14:09:38 | `2bac794` — **stacked on #185** |
| [#187](https://github.com/Swissystem7/ParkWiz/pull/187) | `factory/laptop-claude-board-split-3` | `3a0ce2f` 14:09:43 | `2318a36` |

Of #188's twelve files, six are byte-identical to those branches and four more
are the same file a revision later — `demo/atidim-board.html` (+6, the
`aria-live` counters), `sw.js` (+1 comment), `test/atidim-board.test.js` (+3)
and `docs/dev/PR-145-CONFLICT-RESOLUTION.md` (52 lines of drift). Only
`docs/dev/PR-179-VALIDATION.md` and `docs/dev/PR-179-VALIDATION-COMMENT.md`
exist nowhere else.

So the job is not to re-slice the work — it is to land the slices that already
exist, add the one that does not, and close #188 as the superseded bundle.

## The slices

| # | content | changed lines | where it lives now |
|---|---------|---------------|--------------------|
| 1 | board clock fix in `src/lib/atidim-lot.js` + its test | 145 + doc | **this PR** |
| 2 | `demo/atidim-board.html` + offline shell | 326 | #185, needs one patch |
| 3 | board model + board page tests | 262 | #186, needs reshaping |
| 4 | runbook walkthrough + three `docs/dev/` records | 333 | partly #187 |

Slices are ordered: 2 adds the page, 3 tests it, 4 documents it. Slice 1 is
independent of all three — it is a bug fix in a model that is already on
`master`.

### Slice 1 — the board clock (this PR)

`src/lib/atidim-lot.js` 31+/28−, `test/compare.test.js` +6,
`test/atidim-lot-local-hour.test.js` +80. **145 changed lines** plus this
document.

The board model (`DEFAULT`, `snapshotAt`, `bayLayout`, `hourlySeries`,
`localHour`, `liveSnapshot`) is already on `master` — `demo/atidim.html` only
ever used the *camera* model, so nothing renders the board model yet and two
bugs in it have been sitting there unobserved:

- `localHour` ran its own `Intl.DateTimeFormat('en-US', { hour12: false })`.
  On an hourCycle-h24 runtime — including Node 18 and V8 — that answers `"24"`
  for `00:xx`, and `baselineRateForHour(24)` is `0`. `liveSnapshot()` between
  midnight and 01:00 therefore reported **0 occupied / 18 free / 0%** instead of
  the 12% night floor, while `lotHour` (the camera clock, same instant) reported
  hour `0` correctly. Verified on `master`:
  `localHour(2026-10-18T21:30:00Z)` → `24`, `lotHour(…)` → `0`.
- the bare `Intl` call threw `ReferenceError` on a runtime with no `Intl`
  (old WebView, `--without-intl` build), where `lotClockParts` — the camera
  clock — degrades to host local time instead. Verified on `master`:
  `lotHour` → `12`, `localHour` → throws.

The fix routes `localHour` through `lotClockParts`, which already has both the
`"24"` → `"00"` normalisation and the no-`Intl` fallback; `lotClockParts` gains
an optional `timeZone` argument so the board can honour the zone from
`demo/atidim-data.json`. The invalid-date guard stays *in front* of the call,
because `lotClockParts` falls back to "now" for a bad date and `localHour`'s
contract is `0`.

The rest is naming: the header comment claimed the 18-bay model was "used by
`demo/atidim.html`", which has not been true since the split. Comments now say
*camera model* / *board model*. `DEFAULT.timezone` reuses `LOT_TIME_ZONE`
instead of repeating the string, and `hourlySeries` reuses `pad2`.

`test/compare.test.js` also picks up the two assertions #188 carried for it:
`parsePairs('')` and `parsePairs('   \n')` return `[]` (blank text is a no-op
that `replacePairsFromText` depends on), while `null`/`undefined` still throw.

The code here is identical to the `src/lib/atidim-lot.js` in #187 — the diff
between the two is comment wording only. **#187 must not merge after this PR
without a rebase**; see below.

### Slice 2 — the operator board page (#185)

`demo/atidim-board.html` +317, `demo/atidim.html` +2 (the link to the board),
`sw.js` 2+/1− (precache + cache `v11` → `v12`), `test/sw-precache.test.js`
3+/1− (require the bump). **326 changed lines.**

Useful alone: a second Hebrew RTL demo page — the whole lot as one plan view
with an hour scrubber, answering "what does the operator see all day", where
`demo/atidim.html` answers "how does the camera know a bay is taken". It is the
page that makes the board model on `master` reachable.

#185 carries this page at an earlier revision and needs one patch: its counters
are a plain `<div class="kpis">`, while #188's are
`<section class="kpis" aria-label="מדדי תפוסה בשעה שמוצגת" aria-live="polite">`.
Dragging the scrubber rewrites all four numbers, so a screen reader has to hear
them — and `demo/atidim.html` already wraps its counters that way. Take
`daec5fc:demo/atidim-board.html` over #185's copy; the rest of the 6-line drift
is a comment in `sw.js`.

### Slice 3 — tests for the board (#186, needs reshaping)

`test/atidim-board-page.test.js` +204 (boots the page's inline script against a
stub DOM), and `test/atidim-demo.test.js` → `test/atidim-board.test.js` as a
rename with 49+/9− (model, page markup, both shells precached).
**262 changed lines.**

#186 is the one slice to reshape before merging:

- it is **stacked on #185**, so its GitHub diff is only slice 3 — but it cannot
  merge before #185 does.
- it adds `test/atidim-board.test.js` as a *new* 132-line file while leaving
  `test/atidim-demo.test.js` in place, which duplicates ~75 lines of model
  assertions. #188's shape — a rename — is the right one. Take
  `daec5fc:test/atidim-board.test.js` and delete `test/atidim-demo.test.js`.

### Slice 4 — runbook + engineering records (partly #187)

`docs/launch/CITYZONE-ATIDIM.md` 28+/1− (the board walkthrough: open on the
real hour, drag the scrubber across the day, "now" to come back),
`docs/dev/PR-145-CONFLICT-RESOLUTION.md` +123,
`docs/dev/PR-179-VALIDATION.md` +132,
`docs/dev/PR-179-VALIDATION-COMMENT.md` +49. **333 changed lines.**

The runbook change must land *after* slice 2 — it links
`demo/atidim-board.html`. The three `docs/dev/` records are the chain that
explains how this work got here (#145 conflicted → #179 carried the resolution
→ #145 landed by itself → #179 went red because `refs/pull/179/merge` did not
exist). Only `PR-145-CONFLICT-RESOLUTION.md` is in #187, at an earlier
revision (119 lines, 52 lines of drift from #188's 123). Take #188's copies.

## Landing it

`gh` and network `git` are not approvable in this worktree, so the steps below
are for a session that has them. Take slices **file by file from `daec5fc`**,
never by merging or cherry-picking that branch: it predates `39ca322`, so its
tree has no `test/atidim-demo-smoke.test.js` and a wholesale checkout would
delete a file that just landed. Close #188 **without deleting**
`claude/ParkWiz-181-20261015-142023` until slices 2–4 are merged — `daec5fc` is
where their content comes from.

1. **This PR** (slice 1) — already open against `master`; merge first, it is
   independent.
2. **#185** (slice 2) — update the branch with #188's page, or re-cut it:
   ```sh
   git checkout -b board-page master
   git checkout daec5fc -- demo/atidim-board.html demo/atidim.html \
     sw.js test/sw-precache.test.js
   npm test
   ```
   `master` is on cache `v11` and this slice bumps it to `v12`, which is what
   `test/sw-precache.test.js` then requires.
3. **#186** (slice 3) — depends on slice 2. Re-cut it onto `master` with the
   rename instead of its new-file second copy:
   ```sh
   git checkout -b board-tests board-page
   git checkout daec5fc -- test/atidim-board-page.test.js test/atidim-board.test.js
   git rm test/atidim-demo.test.js
   npm test
   ```
4. **#187** (slice 4) — its `src/lib/atidim-lot.js` and `test/compare.test.js`
   are superseded by this PR; close it and open the docs slice instead:
   ```sh
   git checkout -b board-docs master
   git checkout daec5fc -- docs/launch/CITYZONE-ATIDIM.md \
     docs/dev/PR-145-CONFLICT-RESOLUTION.md \
     docs/dev/PR-179-VALIDATION.md docs/dev/PR-179-VALIDATION-COMMENT.md
   npm test
   ```
5. **Close #188** with the comment below.

Each step leaves `npm test` green (363 tests on `master` today, with this PR's
slice included).

## Comment to close #188 with

> Superseded — closing in favour of four PRs of at most 400 changed lines each,
> per #192. This PR is 982 changed lines, and `auto_merger` merges at most 400.
>
> It also turned out to be a re-bundle rather than new work: the #181 run
> pushed the split as three branches and *then* committed the whole worktree on
> top, so ten of these twelve files already exist on #185/#186/#187 — six
> byte-identical, four of them a revision behind what is here.
>
> | slice | PR | changed lines |
> |-------|----|---------------|
> | board clock fix in `src/lib/atidim-lot.js` + test | #NNN | 145 |
> | `demo/atidim-board.html` + offline shell | #185 → patch | 326 |
> | board model + page tests (rename, not a second copy) | #186 → re-cut | 262 |
> | runbook walkthrough + three `docs/dev/` records | #187 → re-cut | 333 |
>
> Nothing is lost: `docs/dev/PR-188-SPLIT.md` (in #NNN) records the measured
> slices, the two bugs the clock fix covers, and why #185/#186/#187 need
> patching or re-cutting rather than merging as they stand. Please leave the
> branch `claude/ParkWiz-181-20261015-142023` undeleted until slices 2–4 land —
> `daec5fc` is where their content is taken from.

Replace `#NNN` with this PR's number once it is open.
