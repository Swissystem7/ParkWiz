# PR #145 — conflict resolution (Refs #171)

`auto_merger` could not merge [PR #145](https://github.com/Swissystem7/ParkWiz/pull/145)
(`claude/ParkWiz-144-20261015-002637`), and GitHub's update-branch failed. This
documents what actually conflicted, how each conflict was resolved, and how to
land the result on the PR branch.

## Why it conflicted

| | |
|---|---|
| merge base | `e1a7549` (`docs(pitch): add CityZone and Park Atidim operator pitch guide`) |
| PR head | `476d614` (`factory: Claude loop on ParkWiz#144`) |
| `master` | `a134724` |

Between the merge base and `master`, three slices of the *same* Atidim demo work
landed from a different line of development — #154 (part 2/5), #155 (part 3/5)
and #157 (part 5/5) — plus #162 (`parsePairs`). PR #145 is the original
single-commit version of that work. So the two sides are not "PR plus unrelated
master commits": they are two independent implementations touching the same
paths.

Conflicting paths, by kind:

| path | kind |
|---|---|
| `demo/atidim.html` | **add/add** — two completely different pages |
| `docs/launch/CITYZONE-ATIDIM.md` | **add/add** — two different runbooks |
| `src/lib/atidim-lot.js` | content — both sides edited the header and the export block |
| `sw.js` | content — both bumped `CACHE` and appended to `ASSETS` |
| `test/compare.test.js` | content — same intent, different assertions |
| `test/sw-precache.test.js` | content — both raised the minimum cache version |

PR-only, no conflict: `demo/atidim-data.json`, `src/lib/occupancy.js`,
`test/atidim-demo.test.js`, `test/atidim-page.test.js`.

## The one real decision: `demo/atidim.html`

The two sides put *different products* at that path:

* `master` — a dark camera page: one RTSP-style frame, a detection overlay, three
  camera zones (A / level -1 / Atidim 7), click/keyboard stall correction, HUD
  clock on Israel time. Answers *"how does the existing camera know a stall is
  taken?"*
* PR #145 — a light operator board: the whole lot as a plan view with painted
  bays and cars, X-free / Y-occupied / % / total tiles, an hour scrubber across
  the day, a dashed marker on the hourly curve, config from
  `demo/atidim-data.json`, CSP meta. Answers *"what does the operator see all
  day?"*

Collapsing one into the other would mean dropping a real feature from whichever
side lost, so **both pages are kept**:

* `demo/atidim.html` — `master`'s camera page, unchanged except for one added
  cross-link.
* `demo/atidim-board.html` — PR #145's page, renamed, with cross-links to and
  from the camera page.

The runbook now frames them as two questions rather than two versions, and each
page links to the other in its header.

## Resolution, file by file

| path | resolution |
|---|---|
| `demo/atidim.html` | `master`'s page + a link to the board page in the simulation note. |
| `demo/atidim-board.html` | PR #145's page verbatim, retitled „לוח מפעיל”, with back-links to `pilot-brief.html` and `atidim.html`. |
| `demo/atidim-data.json` | PR's, unchanged. |
| `src/lib/atidim-lot.js` | Union. `master`'s camera model (`PEAK_THRESHOLD`, `CAMERA_VIEWS`, `createCameraSpots`, `formatLotClock`, `lotHour`) plus PR's board model (`DEFAULT`, `stateAt`, `bayLayout`, `hourlySeries`, `snapshotAt`, `liveSnapshot`, …). Both export blocks merged and labelled. Header comment rewritten to say which model belongs to which page. |
| | One deduplication: PR's `localHour` had its own `Intl.DateTimeFormat` block. It now reuses `master`'s `lotClockParts`, which gained an optional `timeZone` argument — so the board inherits the no-Intl fallback the camera clock already had, and honours the zone from `atidim-data.json`. |
| `src/lib/occupancy.js` | PR's opt-in `markIndex` marker in `chartSvg`. No conflict. |
| `sw.js` | `master`'s `ASSETS` + PR's `./demo/atidim-data.json`, plus the new `./demo/atidim-board.html`. `CACHE` bumped `v11` → `v12`: the asset list changed again after `master`'s own bump, and the shell is cache-first. |
| `test/sw-precache.test.js` | `master`'s assertion, floor raised to `v12`, with PR's comment on *why* a stale shell matters the morning of the meeting. |
| `test/compare.test.js` | PR's version — a strict superset of `master`'s. Both sides assert `parsePairs(null)` throws; PR also pins that `''` and `'   \n'` return `[]` and that `undefined` throws. |
| `test/atidim-board.test.js` | PR's `test/atidim-demo.test.js`, renamed (`master` already has `test/atidim-demo-page.test.js` for the camera page). Points at `atidim-board.html`; the precache test now requires **both** demo shells. One test added: the two pages must link to each other. |
| `test/atidim-board-page.test.js` | PR's `test/atidim-page.test.js`, renamed, booting the board page's inline script against the stub DOM. |
| `docs/launch/CITYZONE-ATIDIM.md` | `master`'s runbook, extended with PR's board rows in the "what to show" table, a new „לוח המפעיל — סקירת היום” section for the scrubber walkthrough, the 18-bay (6×3) synthetic-data disclaimer, and the pre-flight checklist items for the second page. |

Nothing from PR #145 was dropped.

## Verification

```
$ npm test
# tests 353
# pass 353
# fail 0
```

337 before (`master`), 353 after — 16 new tests, no regressions. `master`'s
`test/pitch-doc.test.js` constrains this runbook (it asserts the walkthrough
names the controls the camera page actually has); those assertions still pass.

## Landing it on PR #145

This sandbox cannot run `git fetch`, `git merge` or `git push`, so the work is a
plain working-tree change on top of `a134724` rather than a merge commit. Its
tree is the resolved merge result, so either of these lands it:

```bash
# A — merge master into the PR branch and take this tree as the resolution
git checkout claude/ParkWiz-144-20261015-002637
git merge master                       # conflicts, as reported
git checkout <this-branch> -- demo docs src sw.js test
git rm --cached demo/atidim.html       # only if master's version did not survive
git add -A && git commit               # completes the merge commit
git push origin claude/ParkWiz-144-20261015-002637
```

```bash
# B — cherry-pick this commit onto the PR branch after merging master
git checkout claude/ParkWiz-144-20261015-002637
git merge -X theirs master             # or: git reset --hard master
git cherry-pick <this-commit>
git push origin claude/ParkWiz-144-20261015-002637
```

No force push and no new PR either way; PR #145 becomes mergeable once the
branch contains this tree.
