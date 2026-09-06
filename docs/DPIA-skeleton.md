# DPIA skeleton — ParkWiz (DRAFT)

**Status:** DRAFT — not a legal filing. No field cameras or personal data in this repo.

## 1. Processing overview
- **Purpose:** municipal occupancy pilot evaluation using synthetic / inspector-paired counts.
- **Data in demo:** street labels, occupancy integers, timestamps, lighting tags. **No plates, faces, or device IDs.**
- **Data NOT collected:** live camera streams, ANPR, GPS tracks of people.

## 2. Necessity & proportionality
Synthetic scenes and manual paired counts are enough to demo agreement metrics without processing special-category data.

## 3. Risks (TOP)
1. Future camera pilot without DPIA / DPO sign-off.
2. Re-identification if raw video is stored with street + time.
3. Export of paired logs containing free-text notes with PII.

## 4. Mitigations already in code
- Dataset marked `synthetic: true`, `fieldMeasured: false`.
- CSV/JSON export of aggregates; share payload is summary-only.
- Availability validation rejects malformed / future reports when `validate=true`.
- Occupancy CSV SHA-256 golden checksum for audit stability.

## 5. Open before any real pilot
- [ ] City DPO / legal review
- [ ] Retention schedule for field logs
- [ ] Camera vendor contract + purpose limitation
- [ ] Hebrew/English privacy notice for inspectors

## 6. Owner questions
See research backlog (target city, field vs portfolio-only).
