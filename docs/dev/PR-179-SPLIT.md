# PR #179 — split into PRs of at most 400 changed lines (Refs #183)

[PR #179](https://github.com/Swissystem7/ParkWiz/pull/179) (`claude/ParkWiz-171-20261015-133151`,
head `853817e`) is **1001 changed lines** — `auto_merger` merges at most 400, so it
has to be split. It bundles four unrelated things: a lot model, a charting
option, a new demo page with two test layers, and two documents.

Nothing in it is stale: every file still applies cleanly to `master` (`a134724`),
and the 220-space camera model it extends is master's current one. PR #179 is
itself the hand-resolved redo of PR #145, which is why the conflict record
travels with it.

## The slices

| # | slice | paths | lines | needs |
|---|---|---|---|---|
| 1 | board lot model (**this PR**) | `src/lib/atidim-lot.js`, `test/atidim-board.test.js` | 235 | — |
| 2 | opt-in hour marker on the shared chart | `src/lib/occupancy.js`, `test/occupancy-chart-mark.test.js` | 54 | — |
| 3 | operator board page + offline shell | `demo/atidim-board.html`, `demo/atidim-data.json`, `demo/atidim.html`, `sw.js`, `test/sw-precache.test.js`, `test/atidim-board-shell.test.js` | 392 | 1, 2 |
| 4 | page-boot test (stub DOM) | `test/atidim-board-page.test.js` | 204 | 3 |
| 5 | CityZone runbook: the second demo page | `docs/launch/CITYZONE-ATIDIM.md` | 29 | 3 |
| 6 | PR #145 conflict record + the `parsePairs` assertions it chose | `docs/dev/PR-145-CONFLICT-RESOLUTION.md`, `test/compare.test.js` | 125 | — |

Land order: **1 → 2 → 3 → 4**, with 5 after 3; **2 and 6 are independent of
everything** and can go first. Slices 1 and 2 are each a library layer the page
needs, so they are genuinely independent of each other — the page in slice 3 is
not. A page split from the library it calls cannot be perfectly independent;
slice 3 is sequenced behind 1 and 2 rather than pretending otherwise.

## Slice 1 — shipped in this PR

The 18-bay board model added to `src/lib/atidim-lot.js` (`DEFAULT`, `totalBays`,
`baselineRateForHour`, `stateAt`, `bayStates`, `arrivalOrder`, `bayLayout`,
`hourlySeries`, `localHour`, `snapshotAt`, `liveSnapshot`, `occupiedAtRate`) plus
`lotClockParts(date, timeZone)` taking an overridable zone. Useful on its own:
the model is a pure library with tests, and the camera model's API is untouched.

PR #179's `test/atidim-board.test.js` mixes three layers — model, page markup and
service worker. Only the four model tests ship here; the rest move to slices 2
and 3 as noted below.

## Extracting the rest

The PR branch stays on GitHub after #179 is closed, so each slice starts from
its head:

```sh
git checkout -b split/179-<n> master
git checkout 853817e -- <paths from the table>
```

Per-slice fix-ups after the checkout:

- **Slice 2:** take the `chart marker calls out one hour and is opt-in` test out
  of `853817e:test/atidim-board.test.js` into a new
  `test/occupancy-chart-mark.test.js`, and replace its `lot.hourlySeries()` call
  with an inline 24-record series (`{ts, total, occupied}`) so the slice does not
  depend on slice 1. Keep the out-of-range cases (`-1`, `24`, `1.5`, `null`,
  `undefined`, `'x'`) — they are what pins `markIndex` to `typeof`, since
  `Number(null)` is `0` and would mark midnight.
- **Slice 3:** take the remaining three tests of
  `853817e:test/atidim-board.test.js` (page markup, the two demo pages linking to
  each other, both shells precached) into a new
  `test/atidim-board-shell.test.js`. `sw.js`'s `CACHE` bump to `v12` and the
  `v >= 12` floor in `test/sw-precache.test.js` belong in this slice: they are
  only true once the new page exists. The page passes `markIndex` to `chartSvg`,
  which a chart without slice 2 silently ignores — the page still renders.
- **Slice 4:** no fix-up. It boots the page's inline script against a stub DOM
  and asserts the marker is drawn, so it needs slices 2 and 3 in place.
- **Slice 6:** `test/compare.test.js` gains `parsePairs('')` / `'   \n'` → `[]`
  and `parsePairs(undefined)` → `TypeError`. Master already asserts the
  `null` case (#162); these are the extra assertions, not a rewrite.

## Verified

`npm test` on `master` is green at 337 tests. Each state in the land order was
materialized in the worktree and run:

| state | tests |
|---|---|
| master | 337 |
| 1 | 341 |
| 2 alone, on master | 341 |
| 1+2 | 345 |
| 1+2+3 | 348 |
| all six | 356 |

## Hand-off (needs `gh`, which the worktree cannot run)

For each slice, after the `git checkout` above:

```sh
git commit -am "<slice title> (part <n>/6 of #179)"
git push -u origin split/179-<n>
gh pr create --title "<slice title> (part <n>/6 of #179)" \
  --body "Slice <n>/6 of #179 — see docs/dev/PR-179-SPLIT.md. Refs #183"
```

Then close #179 with the list:

```sh
gh pr close 179 --comment "$(cat <<'EOF'
Split into PRs of at most 400 changed lines, since this one is 1001 and
`auto_merger` merges at most 400. Plan and verification:
docs/dev/PR-179-SPLIT.md.

- #<a> — board lot model (`src/lib/atidim-lot.js` + model tests), 235 lines
- #<b> — opt-in hour marker on the shared occupancy chart, 54 lines
- #<c> — operator board page + offline shell, 392 lines
- #<d> — page-boot test against a stub DOM, 204 lines
- #<e> — CityZone runbook: the second demo page, 29 lines
- #<f> — PR #145 conflict record + the `parsePairs` assertions, 125 lines

Land order 1 → 2 → 3 → 4, 5 after 3; 2 and 6 are independent. Nothing is
dropped: the six slices together are this PR's diff, with its mixed-layer test
file split along the same lines.
EOF
)"
```
