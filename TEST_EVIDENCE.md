# Test evidence — Claude feature recovery

Date: 2026-07-16 (Asia/Jerusalem)

Recovered the non-duplicated parts of Claude's dangling feature chain onto
`origin/master` (`450978b`) on branch `agent/claude-four-features-integration`.

## Included

- Chance-to-find-parking badge per street.
- Arrival-time selector (`now`, `+30m`, `+1h`, `+2h`).
- Parking tariff label per street.

The old `6e4c8ed` account modal was not replayed because current master already
contains the reviewed real profile/account implementation (`4ffc5df`).

## Checks

```text
OK: 2 inline scripts parse cleanly
tlv-zones.json 9
tlv-lots.json 94
tlv-tow.json 3
git diff --check origin/master..HEAD: passed
fake live-event timer regression check: passed
```

## Browser limitation

The attempted local headless smoke test could not start because the bundled
`playwright` package is missing its `playwright-core` dependency. No browser
smoke pass is claimed. The draft PR must remain unmerged until GitHub checks and
a browser review confirm the four arrival chips, chance badges, and tariff labels.

## PW-001 deterministic availability scoring

Date: 2026-07-23 (Asia/Jerusalem)

- `node --check` passed for every JavaScript file outside generated graph output.
- All 14 `lib/*.test.js` files passed.
- `git diff --check` passed.
- `availabilityScoring.test.js` covers identical-input determinism, demo metadata
  exclusion, real-report confidence, and the active/expired TTL boundary.

## PW-009 deterministic transparent availability model

Date: 2026-08-11 (UTC)

Commands and results:

```text
$ node tests/availability-model.test.cjs
PASS: 5/5 tests

$ node --test test/predict.test.js
PASS: 9/9 tests

$ node --test test/availability.test.js
PASS: 9/9 tests

$ python (extract inline scripts from index.html) + node --check /tmp/parkwiz-inline-1.js /tmp/parkwiz-inline-2.js
OK: 2 inline scripts parse cleanly

$ node --check availability-model.js
OK

$ grep sentinel checks on index.html
sentinel-check-1: OK (no setInterval(liveParkingEvent)
sentinel-check-4: OK (no forbidden real-time claims)
```
