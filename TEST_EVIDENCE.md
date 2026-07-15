# Test evidence

## Deterministic availability model

Run: `node tests/availability-model.test.cjs`

The test covers weekday time adjustment, a valid five-minute user report, expiry, confidence growth, score clamping, and the published model version.

## Product truthfulness checks

- Availability scoring contains no randomness.
- Every score exposes confidence, model version, and named factors.
- User reports include `source`, `createdAt`, `expiresAt`, and `confidence`.
- User-report TTL is constrained to three–seven minutes.
- Demo community-feed confirmations do not mutate availability.
- The UI states that it has no live occupancy feed.

## Current limitations

The baseline values are demonstrative, not measured street occupancy. Municipal GIS can describe parking facilities or zones, but must not be presented as curb legality or live space availability without a matching authoritative layer and license.
