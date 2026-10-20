# PR #149 — superseded by master, no split needed (Refs #317)

[PR #149](https://github.com/Swissystem7/ParkWiz/pull/149)
(`claude/ParkWiz-148-20261015-022446`, head `a9e4ba8`) is 363 changed lines
and `CONFLICTING`. It was slice 1 of the #145 split: the 18-bay demo lot model,
the opt-in `markIndex` chart marker and wider `parsePairs` assertions.

It needs no rebase-and-split. Under the 400-line cap it would fit in one PR
anyway, and after the rebase almost nothing is left. The same content reached
`master` another way, through the #179 split (#184, #187) and the slices after
it. It conflicts because `master` already has it, in a later shape.

| #149 hunk | already on `master` as |
|---|---|
| demo lot model in `src/lib/atidim-lot.js` (`DEFAULT` … `occupiedAtRate`) | the "board model" block, same exports, plus `localMinuteOfDay`; `localHour` now goes through `lotClockParts` |
| two-models header comment in `src/lib/atidim-lot.js` | master's camera-model / board-model header |
| `markIndex` marker in `src/lib/occupancy.js` `chartSvg` | identical code; tested in `test/occupancy-chart-mark.test.js` and `test/occupancy-chart-marker.test.js` |
| `test/compare.test.js`: `parsePairs('')` → `[]`, `undefined` throws | identical assertions, plus `test/compare-parsepairs-blank.test.js` |
| `test/atidim-model.test.js`: 18 bays, hourly series, stable scatter, snapshot, chart marker | the same tests in `test/atidim-board.test.js` and `test/atidim-demo.test.js` |
| `test/atidim-model.test.js`: malformed lot, model separation | **missing**, so it ships here as `test/atidim-board-guards.test.js` |
| `docs/dev/PR-145-SPLIT.md` | out of date (#145 is merged as `94d9c73`), dropped |

So this PR is the whole of what is left of #149: two tests, plus this record.
Re-adding `test/atidim-model.test.js` would have made a third copy of the board
tests, so only the two tests that aren't on `master` yet were carried over.
They also check that `snapshotAt` returns an empty bay list for a bad lot.
`demo/atidim-board.html` merges `demo/atidim-data.json` over `DEFAULT`, so that
is the case a hand-edited config can hit.

## Verified

`npm test` on `master` (`cea3eea`): 598 pass, 0 fail. With this PR: 600 pass, 0 fail.

## Hand-off

Close #149 once this is open (the worktree cannot run `gh`):

```sh
gh pr close 149 --comment "Superseded: everything here already reached master via the #179 split, except two board-model guard tests, which are now in the PR for #317. Mapping: docs/dev/PR-149-SPLIT.md."
```
