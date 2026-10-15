# PR #147 — validation run (Lenovo, 2026-10-15)

Shepherd pass for issue #153. PR #147 is the first `<=400`-line slice of #121,
opened by Claude off parent issue #146.

**Verdict: checks pass on the slice; leave #147 in draft.** The one red test is
pre-existing on `master` and already has a fix in flight; the undraft
preconditions (remaining #121 slices landed, PR body marked ready) are not met.

---

## 1. What was validated

| | |
|---|---|
| PR | #147 |
| Head branch | `origin/claude/ParkWiz-146-20261015-011757` (`51981db`) |
| Base | `master` @ `e1a7549` — the branch's parent **is** the current master tip |
| Diff | 5 files, **+397 / −1** (matches the reported `+397/−1`) |
| Runner | `npm test` → `node --test test/*.js`, Node v18.19.1, Linux |

Branch identified offline by matching `git diff --shortstat master...<branch>`
against the reported line counts — `gh` is not reachable from an agent worktree
(see `no-github-cli-in-worktree-sessions`). Validation ran by materializing the
head's five files into the worktree with `git show <ref>:<path>`, running the
suite, then restoring. Nothing from #147 is committed on this branch — no
duplication of the #146 work.

### Files in the slice

```
287  +  demo/atidim.html                 (new operator demo page)
  2  +  index.html                       (entry point in the eval banner)
  1  +  offer.html                       (entry point in the toolbar)
  3 +/1 sw.js                            (precache the page + model, CACHE v9 → v10)
104  +  test/atidim-demo-page.test.js    (8 new tests)
```

## 2. Test results

| Run | tests | pass | fail |
|---|---|---|---|
| `master` @ `e1a7549`, baseline | 314 | 313 | 1 |
| `master` + #147 head | 322 | 321 | 1 |

All **8 tests added by #147 pass.** The suite grows by exactly 8 and the
failure count does not move, so the slice introduces no regression in any of the
314 pre-existing tests.

### The single failure is pre-existing and unrelated

```
not ok - an empty or pair-less file keeps the saved pairs
  location: test/compare.test.js:41
  error:    'Missing expected exception (TypeError).'
```

It fails identically on a clean `master` with none of #147 applied. The cause is
`assert.throws(() => cmp.parsePairs(''), TypeError)` at `test/compare.test.js:44`
— `parsePairs('')` returns `[]` rather than throwing; only a non-string argument
throws. A one-line fix (`parsePairs('')` → `parsePairs(null)`) is already in
flight on `origin/copilot/compare-test-parsepairs-non-string`. **Not re-fixed
here** — that would duplicate an open PR.

This is what `mergeable_state=unstable` on #147 reflects: red CI inherited from
`master`, not a defect in the slice.

## 3. Manual checks beyond the suite

- **Merge cleanliness.** `git merge-base --is-ancestor master <head>` is true —
  the branch sits directly on the current master tip. No rebase, no conflicts,
  fast-forwardable.
- **Model API.** `demo/atidim.html` binds `window.ParkWizAtidimLot` and calls
  `ATIDIM_LOT`, `getHourlyCurve(capacity)`, `createDefaultCameraSpots()`,
  `calculateOccupancy(spots, capacity)` and `transitionSpot(spots, action)`.
  All five exist on `master`'s `src/lib/atidim-lot.js` with matching arity, so
  the slice consumes the landed (#120) model rather than resurrecting a stale
  copy — it does not touch `src/lib/atidim-lot.js` at all.
- **Offline shell.** `sw.js` adds both new runtime assets and bumps
  `parkwiz-field-v9` → `v10`, so returning visitors re-install. The existing
  `pwa.test.js` precache guard passes.
- **Hebrew UI.** The page is `lang="he" dir="rtl"` and all operator-facing
  strings, including the two new entry-point links, are Hebrew. No CDN or
  off-origin asset references.

## 4. Why #147 stays in draft

The brief undrafts only when checks are green **and** Claude has finished the
remaining #121 slices **and** the PR body says ready. Two of three fail:

1. **Remaining #121 slices are not visible.** The only pushed branch carrying
   this work is #147's own. The `origin/factory/laptop-claude-atidim-split-{2,3,4}`
   branches are a *cumulative* earlier attempt (651 / 746 / 924 changed lines,
   each a superset of the last and of #147) — they are over the 400-line
   auto_merger limit and are not the follow-on slices. `split-5` (105 lines,
   pitch docs) is separate work. There is no `docs/dev/PR-121-SPLIT.md` on any
   branch recording a slice plan.
2. **No ready signal.** The head commit body reads `Draft only — never main.`
   The PR body itself is not readable from this worktree; it must be checked by
   hand before undrafting.

CI will also stay red until the `compare.test.js` fix lands, independent of
anything #147 can do.

## 5. Hand-off — commands for the operator

Everything below needs `gh`, which this worktree cannot run.

Post the validation comment on #147:

```sh
gh pr comment 147 --repo Swissystem7/ParkWiz --body-file docs/dev/PR-147-VALIDATION-COMMENT.md
```

Confirm the two undraft preconditions before doing anything else:

```sh
gh pr view 147 --repo Swissystem7/ParkWiz --json isDraft,body,statusCheckRollup
gh issue view 121 --repo Swissystem7/ParkWiz --json title,state
gh pr list --repo Swissystem7/ParkWiz --search "121 in:body" --state open
```

Undraft **only** if the PR body says ready, the remaining #121 slices are open
or merged, and the only red check is the known `compare.test.js` one:

```sh
gh pr ready 147 --repo Swissystem7/ParkWiz
```

To clear CI for #147 and every later slice, land the in-flight one-liner first:

```sh
gh pr list --repo Swissystem7/ParkWiz --head copilot/compare-test-parsepairs-non-string
```

Not done here, by instruction: no new PR against this work, no force-push, no
merge (auto_merger only), and no touching the #136 claim.

## Reproducing this run

```sh
node -e '
const {execSync}=require("child_process"),fs=require("fs"),path=require("path");
const ref="origin/claude/ParkWiz-146-20261015-011757";
const files=["demo/atidim.html","index.html","offer.html","sw.js","test/atidim-demo-page.test.js"];
for(const f of files){
  fs.mkdirSync(path.dirname(f),{recursive:true});
  fs.writeFileSync(f,execSync("git show "+ref+":"+f,{maxBuffer:1e8}));
}'
npm test
git checkout -- index.html offer.html sw.js && rm -rf demo test/atidim-demo-page.test.js
```
