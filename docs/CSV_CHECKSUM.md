# Occupancy CSV checksum — ParkWiz

**Apply `ParkWiz-partb.patch` first** for `sha256Hex` / `occupancyCsvChecksum` helpers in `src/lib/export.js`. This note is docs-only and does not add those helpers.

## Golden hash usage

After partb lands, occupancy CSV export is checksummed with SHA-256 over the UTF-8 CSV bytes (header + rows). A unit test pins a **golden** hex digest so schema or encoding drift fails CI.

Known golden from partb (2 Netanya sample rows / Hebrew street — update only if the CSV schema intentionally changes):

    d7bc5d112334424869b7c5305827943465f02807e60e7484799d5abc61536b1e

## How to use

1. Apply `ParkWiz-partb.patch` on a fresh `master` baseline.
2. Run `npm test` and confirm the occupancy CSV SHA-256 golden test is green.
3. If you change CSV columns or row formatting, recompute with `occupancyCsvChecksum(records)` and update the golden **in the same PR** with a schema rationale.

## Non-goals

- Not a cryptographic integrity seal for municipal production feeds.
- Not a substitute for DPIA / partner agreements on real field data.
