<!-- Paste as a comment on PR #179. -->

**The red check is not a test failure.** `validate` runs on `pull_request`, and
`actions/checkout@v4` checks out `refs/pull/179/merge`. That merge does not
exist, so the job fails before `npm test` runs.

It does not exist because this PR *is* the conflict resolution for #145 — and
#145 has since landed on `master` by itself (`94d9c73`), with its own slightly
different resolution of the same work. Both sides now append the 18-bay board
model to `src/lib/atidim-lot.js`, both insert into `ASSETS` right after
`'./demo/atidim.html'`, and `master` extended `test/atidim-demo.test.js` while
this branch renamed it to `test/atidim-board.test.js` (rename/modify).

What is left of this PR once `master` is accounted for is the part `master`
never took: **`demo/atidim-board.html`**, the operator board — full lot plan
view, X-free / Y-occupied / % / total, the hour scrubber, the dashed marker on
the curve — plus its two test files, the cross-link from the camera page, the
`v12` cache bump and the runbook section.

Resolved tree (`Refs #181`):

| path | resolution |
|---|---|
| `src/lib/atidim-lot.js` | this PR's version — a superset of `master`'s, adding only the `lotClockParts(date, timeZone)` dedup so the board shares the camera clock's no-Intl fallback |
| `sw.js` | `master`'s `ASSETS` **plus** `./demo/atidim-board.html`, `CACHE` → `v12` |
| `test/atidim-demo.test.js` → `test/atidim-board.test.js` | the rename, with all six of `master`'s tests kept |
| everything else | this PR's version; `master` never touched those paths |

Nothing from this PR was dropped, and none of `master`'s five newer commits were
reverted.

One addition: the board's four counters were rewritten on every scrubber move
but sat outside a live region, so a screen-reader user dragging the hour heard
nothing. `.kpis` is now `aria-live="polite"`, matching `demo/atidim.html`, with a
test pinning it.

```
$ npm test
# tests 362
# pass 362
# fail 0
```

352 on `master` → 362 here (+16 board tests, −6 absorbed by the rename).
`master`'s `test/atidim-demo.test.js`, run unmodified against this tree, still
passes 6/6.

Full write-up and the exact `git merge` + `git push` sequence to land it on this
branch (no force push, no new PR): `docs/dev/PR-179-VALIDATION.md`.
