# Resolving PR #149 against `master` (Refs #172)

[#149](https://github.com/Swissystem7/ParkWiz/pull/149) — slice 1 of the #145
split, the Atidim demo lot model — conflicts with `master`, and
`auto_merger`'s update-branch failed. This PR carries the **resolved content**
so the conflict is reviewable as a diff instead of as a merge-conflict dump.

| | |
|---|---|
| PR branch | `claude/ParkWiz-148-20261015-022446` @ `e253d37` |
| Merge base | `e1a7549` |
| `master` | `d700834` |

`npm test` → **341 tests, 0 failures** on the resolved tree.

## Why it conflicted

Both sides landed Atidim work on the same two files after `e1a7549`:

- `src/lib/atidim-lot.js` — `master` (#154) added the per-camera overlay
  geometry, the `Asia/Jerusalem` lot clock and `PEAK_THRESHOLD`, extending the
  **operator** model. #149 added a separate 18-bay **demo** model. The two
  insertions land in overlapping hunks (the file header and the single `return
  {…}` export block), so git cannot interleave them even though the code itself
  is disjoint.
- `test/compare.test.js` — both sides rewrote the same assertion.

## How each conflict was resolved

### 1. `src/lib/atidim-lot.js` — keep both models

Union, nothing dropped: all 15 of `master`'s exports and all 12 of #149's are
present (27 total). The file header now names both models and says why they
stay separate. Three merge-time touch-ups where the sides met:

- `DEFAULT.timezone` was a second literal `'Asia/Jerusalem'`; it now reads
  `master`'s `LOT_TIME_ZONE` so the demo lot cannot drift from the real one.
- `localHour` (demo) and `lotHour` (`master`) both resolve an Israel hour but
  differ on a bad date — `lotHour` falls back to *now*, which is right for a
  live HUD clock, while `localHour` must return a fixed hour because the demo
  page scrubs arbitrary timestamps. Kept separate, with a comment saying so, so
  neither contract gets "simplified" into the other later.
- `baselineRateForHour` (demo) sits next to `HOURLY_RATES` (measured, real lot).
  Commented, because confusing the two would put synthetic numbers in front of
  an operator.

### 2. `test/compare.test.js` — take #149's wider version

`src/lib/compare.js` has returned `[]` for blank text since #117 while the test
asserted it throws. Both sides fixed that red test independently:

- `master` (#162) narrowed the assertion to `parsePairs(null)` throws.
- #149 asserts the whole contract: `''` and `'   \n'` return `[]`, and both
  `null` and `undefined` throw.

#149's version is a strict superset and holds against `master`'s
`src/lib/compare.js` unchanged, so it wins. No production code changed.

### 3. `src/lib/occupancy.js`, `test/atidim-model.test.js` — clean

`master` did not touch either. Applied as-is; the `markIndex` chart marker stays
opt-in, and the test asserts no marker is drawn for a missing or out-of-range
index.

### 4. `docs/dev/PR-145-SPLIT.md` — refreshed, not dropped

New on the #149 side, so git saw no conflict, but its content had gone stale:
it listed slices 2 and 3 as to-build and called `master` red on the
`compare` test. Both landed since (#154, #157, #162). The doc keeps its
structure and now records what actually shipped, plus the two pieces of #145
still outstanding. See [PR-145-SPLIT.md](PR-145-SPLIT.md).

## Landing this on PR #149

This worktree could not write the merge commit or push (no network git, and
`git merge`/`git checkout` writes are blocked here), so the resolved content
arrives as this PR. To make #149 itself mergeable, replay the same resolution on
its branch — the result is byte-identical to this PR's tree:

```sh
git fetch origin
git switch claude/ParkWiz-148-20261015-022446
git merge origin/master                 # conflicts in the two files above
# take this PR's versions of the four resolved files:
git checkout <this-PR-head> -- src/lib/atidim-lot.js src/lib/occupancy.js \
    test/compare.test.js test/atidim-model.test.js docs/dev/PR-145-SPLIT.md
git add -A && git commit               # merge commit, no force push
npm test                               # expect 341 passing
git push origin claude/ParkWiz-148-20261015-022446
```

Then merge #149 and close #145. Alternatively merge this PR and close #149 as
superseded — same content either way, but #149 keeps the original authorship.
