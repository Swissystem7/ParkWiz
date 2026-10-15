### Validation run — Lenovo, 2026-10-15 (Refs #153)

Ran the suite against this PR's head (`51981db`, +397/−1) on Node v18.19.1.

| Run | tests | pass | fail |
|---|---|---|---|
| `master` @ `e1a7549` baseline | 314 | 313 | 1 |
| `master` + this PR | 322 | 321 | 1 |

**All 8 tests added by this PR pass, and no pre-existing test regresses.**

The single failure is inherited from `master`, not from this slice:

```
not ok - an empty or pair-less file keeps the saved pairs
  location: test/compare.test.js:41
  error:    'Missing expected exception (TypeError).'
```

`parsePairs('')` returns `[]` instead of throwing; only a non-string argument
throws. A one-line fix is already in flight on
`copilot/compare-test-parsepairs-non-string`, so it is deliberately not
duplicated here. This is what `mergeable_state=unstable` reflects — red CI
from `master`, not a defect in this PR.

Also checked by hand:

- **Merge state** — the head sits directly on the current `master` tip
  (`e1a7549`). No rebase needed, no conflicts, fast-forwardable.
- **Model API** — the page binds `window.ParkWizAtidimLot` and calls
  `ATIDIM_LOT`, `getHourlyCurve`, `createDefaultCameraSpots`,
  `calculateOccupancy`, `transitionSpot`; all exist on `master`'s
  `src/lib/atidim-lot.js` with matching arity. The PR correctly consumes the
  landed #120 model instead of shipping a stale copy of it.
- **Offline shell** — `sw.js` precaches both new assets and bumps
  `parkwiz-field-v9` → `v10`, so returning visitors re-install.
- **Hebrew UI** — page is `lang="he" dir="rtl"`, all operator-facing strings
  Hebrew, no off-origin/CDN assets.

### Leaving this in draft

Undrafting needs green checks **and** the remaining #121 slices finished
**and** a PR body that says ready. Two of those are not met:

1. No remaining #121 slice is visible as a pushed branch — only this one. The
   `factory/laptop-claude-atidim-split-{2,3,4}` branches are a cumulative
   earlier attempt (651/746/924 changed lines, each a superset of the last),
   over the 400-line auto_merger limit, not the follow-on slices.
2. The head commit body still reads `Draft only — never main.`

So: **green on the slice itself, staying draft.** Ready to undraft once the
remaining #121 slices are up and the body is marked ready — and CI will go
fully green once the `compare.test.js` one-liner lands.

No new PR, no force-push, no merge (auto_merger only). #136 untouched.

Full write-up with reproduction steps: `docs/dev/PR-147-VALIDATION.md`.
