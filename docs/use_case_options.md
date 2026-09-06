# ParkWiz — use-case options

**Status:** decision pending. Two honest directions for the next 30 days.

## Option 1 — Municipal occupancy kit

Package the existing Netanya pilot surfaces (paired counts, synthetic scenes, export, DPIA skeleton) as a **field-evaluation kit** for a city parking team.

- Strengths: Hebrew RTL surfaces already exist; honesty banners; no live camera required for a tabletop eval.
- Gaps: no city DPO sign-off, no retention schedule, no vendor camera contract.
- Success signal: one written interest note from a municipal contact (not a signed deal).

## Option 2 — Synthetic eval harness

Treat ParkWiz primarily as a **local regression / availability-validation harness** (time-decayed reports, `validate=true` TypeError/RangeError paths, occupancy CSV checksums) useful for demos and portfolio review without a city partner.

- Strengths: fully offline; `scripts/demo_availability.sh` + `node --test`; deterministic.
- Gaps: does not prove field accuracy; not a product.
- Success signal: demo script + full test suite green on two machines.

## Decision

**Pending.** Prefer Option 2 until a real municipal conversation exists; keep Option 1 docs ready without promising enforcement revenue or live feeds.
