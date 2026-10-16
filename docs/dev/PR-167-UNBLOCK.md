# PR #167 — unblock the Park Atidim demo stack

Goal: Park Atidim demo on `master` before the 18–19.10 meeting. The live page is
still 404 because the page itself ships in the #147 → #154 → #155 → #156 + #157
stack, and that stack could not go green. This note records why, what this branch
fixes, and the steps that have to happen on GitHub (not from this worktree).

## Root cause of the red CI (this is what #162 is for)

CI was red on `master` itself, not on the stack. Every branch cut from `master`
inherited the failure, which is why #147 and #154–#157 all reported red while
their own diffs were clean.

The failing test was `test/compare.test.js` →
`an empty or pair-less file keeps the saved pairs`:

```
not ok 82 - an empty or pair-less file keeps the saved pairs
  error: 'Missing expected exception (TypeError).'
  location: test/compare.test.js:41
```

Two assertions in the same file contradicted each other:

| Line | Added by | Asserts |
| --- | --- | --- |
| 44 | `165cb8e` (#117, 14.10) | `parsePairs('')` **throws** `TypeError` |
| 119 | `6a233ea` (#116, 13.10) | `parsePairs('')` **returns** `[]` |

`src/lib/compare.js` returns `[]` for blank input, by design and by its own
comment: `parsePairs` reads a file the operator picked, and an empty or
unreadable file must report "no pairs" so `replacePairsFromText` can keep the
pairs already in the browser. Throwing there would be the bug, not the fix.
#117 was about `count()` validation and the blank-input assertion it added to
`parsePairs` was collateral — `normalizePack` is the function that rejects blank
input, and that contract still holds and is still tested.

## What this branch changes

- Drops the contradictory assertion from the
  `an empty or pair-less file keeps the saved pairs` test. That test is about
  `replacePairsFromText`; the `parsePairs` assertion did not belong in it.
- Pins the `parsePairs` blank-input contract in `test/compare-parsepairs-blank.test.js`
  (blank string → `[]`, non-string → `TypeError`, blank file must not wipe saved
  pairs, and `normalizePack` still rejects blank) so it cannot be conflated with
  `normalizePack` again.

No production code changed. Run `npm test` — the suite must be fully green (was
313 pass, 1 fail on `master` before #162).

## Merge order

1. **This PR** (or #162, whichever lands first — they fix the same assertion;
   close the loser as superseded rather than merging both).
2. **#147** — rebase on `master` after step 1. Its CI was red only from the
   inherited failure above, so it should go green with no change to its own diff.
3. **#154 → #155 → #156 → #157** in that order, each rebased on the previous.

Rebasing is what picks up the fix: a stack branch that is not rebased still
carries the broken test file and will stay red.

## PR-TRIAGE KEEP lines (Lenovo, manual step)

`auto_merger` ignores the `priority:top` labels, so the stack needs explicit
KEEP entries. These lines go at the **top** of PR-TRIAGE, in this order:

```
KEEP #162  compare.test.js assertion fix — unblocks the whole stack
KEEP #147  Park Atidim demo page — base of the stack
KEEP #154  stack 2/5
KEEP #155  stack 3/5
KEEP #156  stack 4/5
KEEP #157  stack 5/5
```

PR-TRIAGE lives outside this worktree, so it is not edited here. The caps and
safety settings in `auto_merger` are deliberately untouched.

## Open items that need the owner

- **Do not merge from the agent side.** Steps 1–3 above are owner actions.
- **#153** — the issue asks to read its comments; GitHub is not reachable from
  this worktree, so they have not been read. If #153 changes the merge order or
  the stack contents, this note is stale on that point.
- **404 check** — after #147 lands, confirm the demo page actually resolves on
  the published site before the meeting. A green stack is not the same as a
  live page; nothing in the test suite covers deployment.
