# PR #137 split — 402 changed lines → four PRs off `master`

Refs #138. `auto_merger` merges at most 400 changed lines (additions + deletions);
PR #137 (`cursor/parkwiz-136-cityzone-atidim-demo-20261014-151038`) had 402.

## Why #137 cannot simply be rebased

It branched at `165cb8e`, before **#120** and **#123** landed, so two of its eight
files are now stale duplicates. Merging them would regress `master`:

| #137 file | On `master` today | Action |
|---|---|---|
| `src/lib/atidim-lot.js` (+128) | #120's version — 220 bays, 3 zones, 3 cameras, privacy checker, covered by `test/atidim-lot.test.js` | **Drop.** #137 carries a competing 18-bay model that would delete the richer API and break 7 tests. |
| `docs/launch/CITYZONE-ATIDIM.md` (+33) | `docs/CITYZONE_ATIDIM_PITCH.md` from #123, asserted by `test/pitch-doc.test.js` | **Drop the duplicate**, keep only the runbook content it adds (PR 4). |

That removes 161 of the 402 lines; the rest is real and splits cleanly. #137's page
path is kept — `docs/CITYZONE_ATIDIM_PITCH.md` already links `demo/atidim.html` and
`test/pitch-doc.test.js` asserts that link.

## The four PRs

| # | Title | Paths | ~lines | Needs |
|---|---|---|---|---|
| 1 | `fix(test): assert the parsePairs guard on non-strings` | `test/compare.test.js` | 6 | — |
| 2 | `feat(demo): Park Atidim operator screen for the CityZone meeting` | `demo/atidim.html`, `demo/atidim-data.json`, `sw.js`, `test/atidim-demo.test.js`, `test/sw-precache.test.js` | ~330 | 1 for green CI |
| 3 | `test(sw): precache invariant covers demo/ and load-time deps` | `test/sw-precache.test.js` | ~55 | 2 |
| 4 | `docs(launch): CityZone meeting runbook` | `docs/CITYZONE_ATIDIM_PITCH.md`, `README.md` | ~45 | 2 |

**PRs 1 and 2 ship in the draft PR for #138** (`npm test` 321/321). PR 1 is folded in
because the assertion it fixes fails on `master` today, so PR 2 cannot show green CI
without it. `test/compare.test.js:44` asserted `parsePairs('')` throws `TypeError`,
but the guard added in `165cb8e` rejects *non-strings* — `''` is a legal pair-less
file returning `[]`, so that assertion has failed since `165cb8e`. #137 deleted the
line, dropping the guard's only coverage; fixed here instead by asserting `[]` for
`''` and moving `TypeError` coverage onto `null` / `42`.

**PR 3 remaining.** `htmlPages()` in `test/sw-precache.test.js` walks the repo root
only, and the invariant covers `fetch()` targets but not `<script src>` /
`<link rel=stylesheet>` — which is why `src/lib/atidim-lot.js` sat uncached from
#120 until PR 2. Extend `htmlPages()` to include `demo/*.html`, resolve each URL
against the page's own directory, and add a `loadTimeDeps()` check; verified passing
across all pages while drafting PR 2. Until then PR 2 asserts its own shell entries
in `test/atidim-demo.test.js`.

**PR 4 remaining.** Append the runbook half of #137's doc (goal, what to show, what
it is **not**, the post-demo ask for one camera snapshot plus a 10-minute manual
count) to `docs/CITYZONE_ATIDIM_PITCH.md`, and add `demo/atidim.html` to the README
surface list. Do **not** copy its `## המשך עבודה` section — it lists #120/#121/#123
as still pending. Read the source with `git show <137-head>:docs/launch/CITYZONE-ATIDIM.md`.

## Hand-off: close #137

Run `gh pr close 137 --repo Swissystem7/ParkWiz --comment "<body>"` with this body,
after filling in the PR numbers actually opened:

> נסגר לטובת פיצול ל‑PR‑ים של עד 400 שורות (#138).
> #120 ו‑#123 כבר הטמיעו ב‑master את `src/lib/atidim-lot.js` ואת מסמך הפיץ', ולכן שתי
> הגרסאות שב‑PR הזה הן כפילות שהייתה מוחקת API עשיר יותר ושוברת 7 בדיקות. היתר פוצל
> לארבעה PR‑ים: תיקון הבדיקה שנכשלת ב‑master, דף המפעיל `demo/atidim.html`, חיזוק
> בדיקת ה‑precache, ומסמך ההרצה לפגישה. הפירוט המלא, כולל מה הושמט ולמה:
> `docs/dev/PR-137-SPLIT.md`. PR‑ים חדשים: _(להשלים)_.
