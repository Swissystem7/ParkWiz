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
