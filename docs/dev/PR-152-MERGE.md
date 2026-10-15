# Resolving the PR #152 / `master` conflict

Refs #173. PR #152 is slice 1 of the PR #150 split (see
[PR-150-SPLIT.md](PR-150-SPLIT.md)), head branch
`claude/ParkWiz-151-20261015-030655`. `auto_merger` could not merge it:
GitHub reported a conflict with `master` and update-branch failed.

## The conflict

One file, one hunk.

- Merge base: `e1a7549` (`docs(pitch): add CityZone and Park Atidim operator pitch guide (#123)`)
- PR head: `937a77a` (`factory: Claude loop on ParkWiz#151`)
- `master`: `d700834`

Both sides rewrote the *same line* of `test/compare.test.js:44` — the
assertion inside `an empty or pair-less file keeps the saved pairs`.

Base:

```js
assert.throws(() => cmp.parsePairs(''), TypeError);
```

That assertion was wrong: `src/lib/compare.js:92-97` throws only on a
non-string, and returns `[]` for blank input by design, because
`replacePairsFromText` reads the empty list to decide it has nothing to
replace. Two independent fixes landed on the two sides:

| side | change |
|------|--------|
| `master` (#162, `4da26aa`) | `assert.throws(() => cmp.parsePairs(null), TypeError);` |
| PR #152 (`937a77a`) | the same `null` case, **plus** `undefined`, plus `deepEqual(parsePairs(''), [])` and `parsePairs('   \n')`, under a comment explaining why blank text is a no-op |

Same intent, different breadth — a textbook "both changed the line"
conflict rather than a disagreement.

## The resolution

Took the PR side. It is a strict superset of `master`'s: it keeps #162's
`parsePairs(null)` assertion verbatim and adds the blank-string and
`undefined` cases around it. Nothing from either side is dropped, and the
resolved test documents the full contract of `parsePairs` — throws on a
non-string, returns `[]` on blank text — instead of half of it.

The other three files of PR #152 do not conflict; `master` never touched
them:

| file | why it is clean |
|------|-----------------|
| `src/lib/occupancy.js` | `master`'s Atidim work went into `src/lib/atidim-lot.js`; the `chartSvg` body is byte-identical to the merge base |
| `test/occupancy-chart-mark.test.js` | new file, no path collision |
| `docs/dev/PR-150-SPLIT.md` | new file; `docs/dev/` does not exist on `master` |

### One content update beyond the textual merge

`docs/dev/PR-150-SPLIT.md` is carried over with a dated status note at the
top, because the merge invalidated two of its factual claims:

- It says `npm test` on `master` is 313/314 with the `compare.test.js`
  failure. #162 fixed that; `master` is green.
- It plans slices 2–5, which #154 and #157 have since landed by a different
  route — by extending `src/lib/atidim-lot.js` rather than adding
  `src/lib/atidim-demo-lot.js`, and with a canvas-drawn lot that never calls
  `OCC.chartSvg`. Replaying those slices verbatim would duplicate work.

The plan text itself is left intact; only the stale claims are annotated. A
side effect worth stating plainly in review: with #154's page not calling
`chartSvg`, the `markIndex` marker this PR adds has **no caller yet**. It is
a tested, opt-in library addition, and the three existing callers
(`pilot-report.html:232`, `pilot-dashboard.html:204`, `pilot-kit.html:513`)
pass no `markIndex` and get a byte-identical SVG.

## Verification

`npm test` from this worktree, on `master` + the resolved merge:

```
# tests 340
# pass 340
# fail 0
```

334 of those are `master`'s; the 6 added are
`test/occupancy-chart-mark.test.js`. The widened `compare.test.js`
assertions pass against `src/lib/compare.js` unchanged, which is the point:
the test was wrong, not the library.

## Landing it on branch `claude/ParkWiz-151-20261015-030655`

This worktree has no network git and no `gh`, so the merge commit has to be
made from a checkout that can push. The resolution above is mechanical — one
hunk — so it is faster to redo than to transplant:

```sh
git fetch origin
git checkout claude/ParkWiz-151-20261015-030655
git merge origin/master            # conflicts in test/compare.test.js only
```

Resolve by keeping the PR's block and `master`'s `null` assertion together,
i.e. `test/compare.test.js` ends up as:

```js
  // Blank text is a no-op, not an error: replacePairsFromText below relies on
  // the empty list to decide it has nothing to replace. A non-string is still
  // a caller bug and still throws.
  assert.deepEqual(cmp.parsePairs(''), []);
  assert.deepEqual(cmp.parsePairs('   \n'), []);
  assert.throws(() => cmp.parsePairs(null), TypeError);
  assert.throws(() => cmp.parsePairs(undefined), TypeError);
```

Then:

```sh
git add test/compare.test.js
# optional: take the annotated docs/dev/PR-150-SPLIT.md from this branch
git commit --no-edit
npm test                           # expect 340/340
git push origin claude/ParkWiz-151-20261015-030655
```

A plain merge commit and a plain push — no force push, no rebase, no new PR.
PR #152 picks the merge up and becomes mergeable; its diff against `master`
afterwards is the four files above, ~80 lines of code plus the split doc.
