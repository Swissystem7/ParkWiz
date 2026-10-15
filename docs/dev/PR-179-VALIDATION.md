# PR #179 — why it was red, and the tree that makes it green (Refs #181)

`pr_shepherd` could not fix [PR #179](https://github.com/Swissystem7/ParkWiz/pull/179)
(`claude/ParkWiz-171-20261015-133151`) on its own. This records what was
actually broken, what the fix is, and how to land it on the PR branch without a
force push or a new PR.

## Why the checks were red

The branch's own tests were never the problem. `.github/workflows/validate.yml`
runs on `pull_request`, and `actions/checkout@v4` checks out
`refs/pull/179/merge` — the merge of the PR head into `master`. **That merge does
not exist**, so there is nothing to test and the check fails before `npm test`
is reached.

| | |
|---|---|
| merge base | `a134724` (part 3/5 of the Atidim demo page, #155) |
| PR head | `853817e` (`factory: Claude loop on ParkWiz#171`) |
| `master` | `2318a36` — five commits ahead of the merge base |

The reason the merge does not exist is that PR #179 *is* the conflict
resolution for PR #145 (see [PR-145-CONFLICT-RESOLUTION.md](PR-145-CONFLICT-RESOLUTION.md)),
and in the meantime **PR #145 landed on `master` by itself** as `94d9c73`,
followed by the #150 split (`dd4b121`) and three finder commits. So `master` now
contains its own, slightly different, resolution of the same work. Both sides
add the same code in the same places:

| path | kind of conflict |
|---|---|
| `src/lib/atidim-lot.js` | both sides append the 18-bay board model and extend the export block, with different header comments |
| `sw.js` | both sides insert into `ASSETS` immediately after `'./demo/atidim.html'` |
| `test/atidim-demo.test.js` | **rename/modify** — `master` extended it by 95 lines; the PR renamed it to `test/atidim-board.test.js` |

Identical on both sides, so no conflict: `demo/atidim-data.json` and the
`markIndex` marker in `src/lib/occupancy.js`.

## What is left of PR #179 once `master` is taken into account

`master` landed the union **minus the board page**. PR #179's remaining,
unduplicated content is:

* `demo/atidim-board.html` — the operator board: the whole lot as a plan view,
  X-free / Y-occupied / % / total tiles, an hour scrubber across the day, a
  dashed marker on the hourly curve, config from `demo/atidim-data.json`, CSP
  meta, no network dependency.
* `demo/atidim.html` — one added cross-link to the board page.
* `src/lib/atidim-lot.js` — `localHour` now reuses `lotClockParts` (which gained
  an optional `timeZone`) instead of its own `Intl.DateTimeFormat` block, so the
  board inherits the camera clock's no-Intl fallback and honours the zone from
  `atidim-data.json`; `hourlySeries` reuses `pad2`; header comments renamed to
  say *board* rather than *demo*.
* `sw.js` — `./demo/atidim-board.html` precached, `CACHE` `v11` → `v12`.
* `test/atidim-board.test.js` — `master`'s `test/atidim-demo.test.js` renamed, all
  six of its tests kept verbatim, plus the board page markup, the two-way link
  between the pages, and a precache test that requires **both** demo shells.
* `test/atidim-board-page.test.js` — boots the board page's inline script against
  a stub DOM: counters on load, every bay outlined green or red, the
  `roundRect`-less fallback path, the scrubber, bay monotonicity, the chart
  marker following the scrubber, and the `atidim-data.json`-less boot.
* `test/compare.test.js`, `test/sw-precache.test.js` — the PR's assertions
  (strict supersets of `master`'s).
* `docs/launch/CITYZONE-ATIDIM.md`, `docs/dev/PR-145-CONFLICT-RESOLUTION.md`.

Nothing from PR #179 was dropped, and nothing from `master` was reverted: the
five commits `master` gained (`index.html`, `test/leaving-countdown-label.test.js`,
`test/occupancy-chart-mark.test.js`, `test/buyer-report-gate.test.js`,
`docs/dev/PR-150-SPLIT.md`) are all still in place — the PR branch simply predates
them.

## Resolution, file by file

| path | resolution |
|---|---|
| `src/lib/atidim-lot.js` | PR's version. It is `master`'s version plus the `lotClockParts(date, timeZone)` dedup and the comment rename — no `master` export or helper is removed. |
| `sw.js` | `master`'s `ASSETS` (including its `atidim-data.json` comment) **plus** `./demo/atidim-board.html`; `CACHE` bumped to `v12` because the asset list changed after `master`'s own bump and the shell is cache-first. |
| `test/atidim-demo.test.js` → `test/atidim-board.test.js` | The rename, as the PR intended. `master`'s six tests are present (one renamed to „Atidim board lot…”, one strengthened to require both shells); `master`'s separate `test/atidim-demo-page.test.js` for the camera page is untouched. |
| everything else | PR's version; `master` never touched those paths. |

## One addition beyond the PR

`demo/atidim-board.html` rewrote its four counters on every scrubber move but
left them outside a live region, so a screen-reader user dragging the hour heard
nothing. The `.kpis` block is now a `<section aria-label="מדדי תפוסה בשעה שמוצגת"
aria-live="polite">` — the same contract the counters on `demo/atidim.html`
already have — and `test/atidim-board.test.js` pins it.

## Verification

```
$ node --version
v18.19.1          # CI uses 22; the suite has no version-specific assertions
$ npm test
# tests 362
# pass 362
# fail 0
```

Baseline `master` (`2318a36`) is 352 tests. 362 − 352 = +10: the 16 tests in the
two board files, less the 6 in `test/atidim-demo.test.js` that
`test/atidim-board.test.js` absorbs.

Regression check on the absorbed file — `master`'s `test/atidim-demo.test.js`,
run unmodified against this tree's `src/lib/atidim-lot.js` and `sw.js`:

```
# tests 6
# pass 6
# fail 0
```

So the `lotClockParts` dedup and the comment rename do not change any behaviour
`master` asserts.

## Landing it on PR #179

This sandbox cannot run `git fetch`, `git merge`, `git checkout <branch>` or
`git push`, so the work is a plain working-tree change on top of `2318a36`
rather than a merge commit. Its tree *is* the resolved merge result:

```bash
git checkout claude/ParkWiz-171-20261015-133151
git merge master                                  # conflicts, as described above
git checkout <this-branch> -- demo docs src sw.js test
git rm test/atidim-demo.test.js                   # superseded by atidim-board.test.js
git add -A && git commit                          # completes the merge commit
git push origin claude/ParkWiz-171-20261015-133151
npm test                                          # 362 pass before pushing
```

No force push, no new PR. Once the branch contains this tree,
`refs/pull/179/merge` resolves, `validate` runs, and PR #179 is mergeable.
