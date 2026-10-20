# PR #158 — rebased onto `master`: one part left, the rest already landed

Refs #316. #158 (`claude/ParkWiz-138-20261015-035049`, 126 changed lines,
`CONFLICTING`) was the PR #137 split's first slice. Since it branched, `master` took
the same pieces through other PRs, and the Atidim demo moved from the 220-bay camera
model to an 18-bay board (`LOT.DEFAULT`) for its labels. Rebased file by file:

| #158 file | On `master` today | Action |
|---|---|---|
| `demo/atidim-data.json` (+6) | Exists with a different shape (`site`, `cols`, `rows`, `timezone`, `meetingNote`) that `demo/atidim-board.html` spreads over `LOT.DEFAULT` | **Drop.** #158's `operator`/`source` keys are read by no page. |
| `sw.js` (+2) | `./demo/atidim-data.json` already precached; cache is `v23` | **Drop.** |
| `test/compare.test.js` (+4) | `parsePairs(null/undefined)` → `TypeError` asserted there and in `test/compare-parsepairs-blank.test.js` | **Drop.** |
| `test/atidim-demo.test.js` (+53) | Rewritten for the 18-bay model; chart and precache checks covered by it and `test/atidim-board.test.js` | **Keep one test**, rewritten against `LOT.DEFAULT` (below). |
| `docs/dev/PR-137-SPLIT.md` (+61) | The plan it describes landed through #154/#155 and later work | **Drop.** It is out of date. |

## The one remaining part

`test/atidim-demo.test.js` — *operator-editable labels describe the same lot as the
model*. The board fetches `atidim-data.json` and spreads it over `LOT.DEFAULT`, but on
`file://` the fetch fails and the board shows `DEFAULT` alone. Nothing pinned the two
to each other, apart from `cols * rows == 18`. The test pins site, grid, zone and the "synthetic, not
a live camera" note. It fits in one PR (≈30 lines), so no further split is needed.

## Hand-off: close #158

After this PR is open:

```
gh pr close 158 --repo Swissystem7/ParkWiz --comment "<body>"
```

> נסגר לאחר rebase על master (#316). רוב התוכן כבר נכנס ל‑master דרך PR‑ים אחרים:
> קובץ התוויות, ה‑precache ב‑sw.js ובדיקת parsePairs. החלק היחיד שנשאר, בדיקה
> שקובץ התוויות תואם את `LOT.DEFAULT`, עבר ל‑PR של #316. הפירוט המלא:
> `docs/dev/PR-158-SPLIT.md`.
