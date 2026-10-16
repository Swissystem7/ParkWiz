# PR #208 — conflict resolution (Refs #210)

`auto_merger` could not merge [PR #208](https://github.com/Swissystem7/ParkWiz/pull/208)
(`claude/ParkWiz-205-20261016-030124`), and GitHub's update-branch failed. This
documents what actually conflicted, how each conflict was resolved, and how to
land the result on the PR branch.

## Why it conflicted

| | |
|---|---|
| merge base | `0db6628` (`atidim: Waze-style arrival margin window around the predicted hour (#201) (#203)`) |
| PR head | `14e41a8` (`factory: Claude loop on ParkWiz#205`) |
| `master` | `7d23c9b` (`margin: arrival margin window model + tests (#204 part 1/2) (#206)`) |

Both sides are **slice 1 of the #204 split**, landed twice. PR #208 is the slice
as [`docs/dev/PR-204-SPLIT.md`](PR-204-SPLIT.md) specified it; `master`'s #206 is
the same slice, merged an hour earlier, so every file the PR adds already exists
on `master`:

| path | kind | sides |
|---|---|---|
| `src/lib/margin.js` | **add/add** | PR +162, `master` +162 — **byte-identical** (`git diff origin/master origin/claude/ParkWiz-205-20261016-030124 -- src/lib/margin.js` is empty) |
| `test/margin.test.js` | **add/add** | PR +92, `master` +116 — `master` is a strict **superset**: the same six model cases plus a seventh that reads the board page |
| `docs/dev/PR-204-SPLIT.md` | PR-only | no conflict |

So nothing in the PR's code is in tension with `master` — it is the duplicate
landing described in `docs/dev/PR-179-SPLIT.md`'s lineage, where the same feature
arrives through two competing splits.

## Resolution, hunk by hunk

| hunk | taken from | why |
|---|---|---|
| `src/lib/margin.js`, all 162 lines | `master` | identical on both sides; nothing to choose |
| `test/margin.test.js`, the six model cases | `master` | identical on both sides |
| `test/margin.test.js`, the seventh case (board page) | `master` | PR-only side does not have it; it is slice 2's case, which #206 pulled forward |
| `docs/dev/PR-204-SPLIT.md` | rewritten | the split it plans is now history — see below |

`git diff` for both conflicting paths against `origin/master` is empty after the
resolution: this change touches neither file.

## What the resolution would have dropped, and does not

Taking `master` for both conflicting files leaves the PR with nothing but its
split doc. But #206 did **not** land all of #204 — it took slice 1 plus an
ad-hoc first cut of the margin panel, and left the rest of slice 2 on the floor.
Measured against PR #204's head (`93a6725`), these were still missing from
`master` at `7d23c9b`:

| path | what was missing |
|---|---|
| `sw.js` | `./src/lib/margin.js` was never precached, though `demo/atidim-board.html` `<script src>`s it — the panel is blank on the first offline visit, which is exactly the failure mode the field shell exists to prevent |
| `test/atidim-board-page.test.js` | the three margin cases. The harness did not even put `ParkWizMargin` on its fake `window`, so `renderMargin()` hit its `if (!MARGIN) return` guard and **the whole panel was untested** |
| `demo/atidim-board.html` | the window followed the wall clock unconditionally, so scrubbing the demo hour to 07:00 left the margin reading `10:33–10:43` directly under counters showing 07:00; the band was a text repeat of the range rather than a bar drawn to scale; the tone line dropped the trend and the uncertainty |
| `docs/launch/CITYZONE-ATIDIM.md` | the demo step for the panel and the "prediction range, not a reservation" caveat |

This change lands those. That is the whole of #204 accounted for — slice 1 and
the panel on `master` via #206, the remainder here — with `src/lib/margin.js`
and `test/margin.test.js` untouched.

### `demo/atidim-board.html`: whose panel

Both sides have a panel; they are different code. The reconciled version is
#204's, which is what the PR's doc specifies and what the tests pin, with two
things kept from `master`'s cut:

| decision | from | why |
|---|---|---|
| `marginStartMinutes()` — real minute while following the clock, `hour * 60` once the scrubber is grabbed | **#204** | `master`'s panel always read the wall clock, so the window contradicted the counters in manual mode |
| band drawn to scale (`left`/`width` as a % of capacity) | **#204** | `master` wrote `rangeLabel` into the band element, which just repeated the headline |
| tone line carries trend and `±slack` bays | **#204** | the panel has to explain *why* the window is wide, or the width reads as vagueness |
| sliders call `renderMargin()`, not `render()` | **#204** | a slider tick should not redraw 18 bays on a canvas |
| `renderMargin()` in the 60-second tick | **`master`** | #204 dropped it, which left the window stale for up to an hour while the page followed the clock |
| the `<span class="note">` basis line under the sliders | **`master`** | genuinely useful Hebrew copy that #204's panel did not have |

The panel also moves from above the map to directly above **פרטיות ואחסון**,
which is the order the runbook's steps now read in.

`test/margin.test.js`'s seventh case — `master`'s, untouched — still passes
against the reconciled panel: it pins the `max="45"` / `max="30"` sliders, the
four ids, the `aria-live` wrapper, the `שולי הגעה` heading, the absence of
`מקום מובטח`, and the `LOT.localMinuteOfDay(` call.

## Verification

From this worktree, on `master` at `7d23c9b`:

| | `node --test test/*.js` |
|---|---|
| baseline (`master`, untouched) | **411 / 411 pass** |
| with this change | **415 / 415 pass** |

The four new cases are the three margin-panel cases and one precache case. The
precache case was confirmed to fail without the `sw.js` fix:

```
not ok 4 - every library a precached page <script src>s is precached too
    +   'demo/atidim-board.html -> src/lib/margin.js'
```

`test/sw-precache.test.js` only ever checked `fetch()` targets in root-level
pages, which is why a `<script src>` under `demo/` could slip through. The new
case resolves each page's relative `src` against its own directory and reports
`demo/atidim-board.html -> src/lib/margin.js` when the asset is unlisted.

## Hand-off

This worktree cannot push (`git push` is unapprovable here, see
`docs/dev/PR-145-CONFLICT-RESOLUTION.md` for the same constraint), and the outer
script opens a *new* draft PR off `claude/ParkWiz-210-20261016-032548`. To land
the result on PR #208's own branch instead, so that #208 becomes mergeable
rather than being superseded:

```sh
git fetch origin
git checkout claude/ParkWiz-205-20261016-030124
git merge origin/master          # conflicts in src/lib/margin.js, test/margin.test.js
git checkout --theirs src/lib/margin.js test/margin.test.js
git add src/lib/margin.js test/margin.test.js
git commit                       # "Merge master into #208: take master's slice 1"

# then apply the slice-2 remainder from this branch
git checkout claude/ParkWiz-210-20261016-032548 -- \
  demo/atidim-board.html sw.js test/sw-precache.test.js \
  test/atidim-board-page.test.js docs/launch/CITYZONE-ATIDIM.md \
  docs/dev/PR-204-SPLIT.md docs/dev/PR-208-CONFLICT-RESOLUTION.md
npm test                         # expect 415 / 415
git commit -m "margin: finish the #204 split — precache, panel reconcile, page tests

Refs #210"
git push origin claude/ParkWiz-205-20261016-030124   # no force push, no new PR
```

`--theirs` is `origin/master` during a merge *into* the PR branch. Both files are
identical-or-superset on that side, so the resolution is mechanical.

Suggested comment for PR #208:

> Conflicts resolved and the branch is up to date with `master`. Both conflicts
> were add/add against #206, which landed the same slice an hour earlier:
> `src/lib/margin.js` is byte-identical on the two sides and `master`'s
> `test/margin.test.js` is a strict superset, so `master`'s side was taken for
> both and this PR touches neither file.
>
> What was left of the #204 split is here instead: `./src/lib/margin.js` is now
> precached (`demo/atidim-board.html` `<script src>`s it, so the panel was blank
> on the first offline visit), the panel is reconciled to the version #204
> specified — the window follows the demo hour instead of always the wall clock,
> and the band is drawn to scale — and the three page cases that pin it now run,
> having never run before: #206's harness did not put `ParkWizMargin` on its fake
> `window`, so the whole panel was untested. 411 → 415 tests, nothing regressed.
>
> Anatomy, the hunk-by-hunk table and the push recipe:
> [`docs/dev/PR-208-CONFLICT-RESOLUTION.md`](docs/dev/PR-208-CONFLICT-RESOLUTION.md).
> Refs #210.
