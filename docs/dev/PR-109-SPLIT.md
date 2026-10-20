# PR #109 — rebased onto `master`: one part left, the rest already landed

Refs #318. #109 (`factory/claude-playwright-smoke`, head `3c992c0`, 173 changed
lines, `CONFLICTING`) was the first try at ParkWiz#106: a headless 390px
Playwright smoke check plus a topbar fix. #106 was later closed by #301, which
put `test/smoke/index-390.smoke.js` on `master`. So most of #109 is already on
`master` in another form, and what is left fits in one PR. No further split is
needed.

| #109 file | On `master` today | Action |
|---|---|---|
| `scripts/smoke.mjs` (+104) | `test/smoke/index-390.smoke.js` (#301) does the same checks for `index.html`, and also serves Leaflet locally, stubs tiles and checks map/nav/legend sizes | **Drop the script.** Its two extra checks are ported (below). |
| `package.json` / `package-lock.json` | `playwright` + `leaflet` dev deps and `npm run test:smoke` | **Drop.** `npm run smoke` would be a second name for the same thing. |
| `index.html` topbar wrap at ≤600px (+3) | The index smoke passes at 390px without it (#301 fixed the nav and banner instead) | **Drop.** |
| tab loop (`[role="tab"]`) | No page has `role="tab"`, so the loop never ran | **Drop.** |
| `.github/workflows/smoke.yml` (+18) | Missing. `validate.yml` runs only `npm test`, so the smoke test never ran in CI | **Keep**, running `npm run test:smoke`. |
| `marketplace.html` and `offer.html` checked at 390px | Missing. Only `index.html` is covered | **Keep** as `test/smoke/pages-390.smoke.js`. |
| failed local requests (HTTP ≥ 400) count as errors | Missing | **Keep**, in the shared harness, so it applies to all three pages. |

## This PR

- `test/smoke/harness.js`: the static server, offline routing and overflow
  check, moved out of `index-390.smoke.js` unchanged, plus the HTTP ≥ 400 check
  and a `page` option.
- `test/smoke/index-390.smoke.js`: now uses the harness. The tests themselves
  are unchanged.
- `test/smoke/pages-390.smoke.js`: `marketplace.html` and `offer.html` must be
  `he`/`rtl`, have no console, page or HTTP errors, make no outside requests,
  lay out at 390px wide and not scroll sideways.
- `.github/workflows/smoke.yml`: runs the smoke tests on every PR and push to
  `master`.

## Verified

On `master` (`cea3eea`) with this PR: `npm test` 598 pass, 0 fail. `npm run
test:smoke` 4 pass, 0 fail. As a negative check, a 600px-wide `<div>` injected
into `offer.html` fails the new test.

## Hand-off: close #109

The worktree cannot run `gh`. After this PR is open:

```sh
gh pr close 109 --repo Swissystem7/ParkWiz --comment "<body>"
```

> נסגר לאחר rebase על master (#318). רוב התוכן כבר נכנס ל‑master דרך #301:
> בדיקת ה‑smoke של index.html ב‑390px וה‑dev deps של playwright. מה שנשאר עבר
> ל‑PR של #318: בדיקה של marketplace.html ו‑offer.html ב‑390px, ספירה של בקשות
> מקומיות שנכשלו כשגיאה, ו‑workflow שמריץ את ה‑smoke ב‑CI. הפירוט המלא:
> `docs/dev/PR-109-SPLIT.md`.
