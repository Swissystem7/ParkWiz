# DPIA skeleton — ParkWiz (DRAFT)

**Status:** DRAFT — not a legal filing, not DPO sign-off, not city approval.
**Positioning:** privacy-first · local-first · no live cameras in this repo · no person identification.
**Audience:** portfolio / future municipal partner prep (Innovate4Cities window closed 31.8.2026).

This skeleton records what the **current repository** processes and what would be required **before** any real field camera pilot. Unclear personal-data questions are marked `NEEDS-LEGAL`.

---

## 1. Processing overview

| Item | Current repo (demo / kit) | Future field pilot |
|---|---|---|
| Purpose | Synthetic occupancy evaluation + printable municipal outreach kit | Measure occupied/free agreement vs inspector on one city snapshot feed |
| Controller | Individual maintainer (portfolio) — `NEEDS-LEGAL` if a city becomes joint controller | City DPO / legal + maintainer agreement — `NEEDS-LEGAL` |
| Processors / vendors | None (browser-local; no cloud backend in repo) | Camera/VMS vendor only if city supplies access — `NEEDS-LEGAL` |
| Systems | Static Pages + `src/lib/*` heuristics; optional localStorage on privacy form | Read-only snapshot access; no continuous video pipeline in this repo today |

**Explicit non-goals (repo truth):** no live CCTV ingest, no ANPR/LPR, no face recognition, no enforcement, no cloud sync of pilot logs.

---

## 2. Data categories

### 2.1 In scope today (demo data — not field PII)

| Category | Examples in repo | Personal data? |
|---|---|---|
| Street / lot labels | Hebrew street names in sample pairs / GeoJSON lots | No (public place labels) |
| Occupancy integers | total spots, occupied counts, heuristic scores | No |
| Timestamps | sample `ts` strings / numeric report times | No (synthetic / demo clock) |
| Lighting tags | `day` / `dusk` / `night` / `wet` on synthetic patches | No |
| Aggregate exports | occupancy CSV / JSON, URL hash share summaries | No (counts only) |
| Dataset flags | `synthetic: true`, `fieldMeasured: false` | N/A (provenance) |

### 2.2 Browser-local form fields (`pilot-privacy.html`)

| Field | Stored where | Personal data? |
|---|---|---|
| Org / contact / city unit / camera id / dates / notes | `localStorage` keys `pw_priv_*` on the user's device | **Possibly** if a real name, phone, or email is typed — `NEEDS-LEGAL` (notice + retention of draft text) |

No server upload of these fields exists in this repository.

### 2.3 Out of scope / must not appear without new DPIA

- License plates, faces, device IDs, GPS tracks of people
- Continuous video, cloud object storage of frames
- Enforcement / fine / towing databases

Any plan to collect those → **stop** and complete legal review (`NEEDS-LEGAL`).

---

## 3. Legal basis

| Processing | Basis (draft) | Status |
|---|---|---|
| Synthetic demo + open-source kit | No personal data in core datasets → DPIA not triggered for demo counts | OK for portfolio |
| Optional contact text in localStorage | Consent / legitimate interest for a draft form the user fills — **unclear under Israeli Privacy Protection Law + Amendment 13 framing** | `NEEDS-LEGAL` |
| Future city snapshot pilot | Public-task / contract with municipality; purpose limitation to occupied/free counts | `NEEDS-LEGAL` (city DPO) |
| Any LPR / face / tracking | Not proposed; Israeli District Court (עת״מ 12825-12-24) + Privacy Protection Authority guidance bar municipal LPR parking enforcement without statute | Reject unless law changes — `NEEDS-LEGAL` |

This section is **not** legal advice.

---

## 4. Data minimization

1. Core eval data is **generated in-process** (`src/lib/dataset.js`); no municipal camera frames ship in the repo.
2. Pilot report / share payloads are **aggregates** (counts, agreement rates) — not vehicle images.
3. Heuristic path counts occupied/free cells on static / synthetic patches — **no identity features**.
4. Plate helper (`src/lib/plate.js`) formats digit strings for UI demos only; occupancy pipeline must not store plates — keep that boundary.
5. Future pilot request (`pilot-privacy.html`) already limits scope: **one camera, snapshot not stream, 30 days, no LPR/faces, delete on day 30**.

If a feature needs more data than occupied/free + street + time → reject or re-open DPIA (`NEEDS-LEGAL`).

---

## 5. Retention

| Data | Retention today | Target policy |
|---|---|---|
| Synthetic scenes / sample JSON in git | Lives with the repo (public demo) | Keep; not personal data |
| `localStorage` privacy-form drafts | Until the user clears site data | Document in UI; offer clear-button — `NEEDS-LEGAL` copy |
| Exported CSV/JSON the user downloads | User-controlled | User responsibility; kit should warn not to paste PII into free-text notes |
| Future field snapshots | **Not implemented** | Written schedule + who deletes — open checklist item; `NEEDS-LEGAL` |
| Future paired inspector logs | **Not implemented as a server** | Prefer counts-only exports; purge free-text notes on schedule — `NEEDS-LEGAL` |

---

## 6. Controls (technical & organizational)

### Already reflected in code / kit

- Dataset marked `synthetic: true`, `fieldMeasured: false`.
- Availability validation can reject malformed / future timestamps when `validate=true`.
- Occupancy CSV path supports audit-oriented checksum helpers when present in export module.
- Pilot privacy page states no continuous video, no plates/faces, no enforcement.
- PWA caches **pages** for offline field use; no cloud sync of observations in this repo.
- Surfaces are honest about sample / synthetic status (README + pilot banners).

### Required before any real camera pilot (checklist)

- [ ] City DPO / legal reviews purpose, legal basis, and Hebrew/English notice
- [ ] Written retention + deletion owner for any field logs / snapshots
- [ ] Camera / VMS access is read-only; vendor DPA if vendor processes personal data — `NEEDS-LEGAL`
- [ ] Confirm exports still exclude plates, faces, device IDs, and raw frames
- [ ] Hebrew/English privacy notice for inspectors and any form that collects contact PII — `NEEDS-LEGAL`
- [ ] Re-run this DPIA if scope expands beyond one camera / occupied-free counts

---

## 7. Risks (TOP) and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Future camera pilot starts without DPIA / DPO sign-off | This skeleton + go/no-go checklist; no live ingest in repo |
| 2 | Re-identification if raw video stored with street + time | Do not store continuous video; snapshot + counts only; `NEEDS-LEGAL` if frames retained |
| 3 | Free-text notes / contact fields leak PII via export or screenshot | Discourage PII in notes; localStorage-only today; legal notice — `NEEDS-LEGAL` |
| 4 | Scope creep into LPR / enforcement | Product rule + court/PPA context; reject in design reviews |

---

## 8. Open before any real pilot

- [ ] City DPO / legal review
- [ ] Retention schedule for field logs
- [ ] Camera vendor contract + purpose limitation
- [ ] Hebrew/English privacy notice for inspectors
- [ ] Decision: real field pilot vs portfolio-only (owner blocking question)

---

## 9. Related surfaces

- `pilot-privacy.html` — printable access request / privacy draft (not an agreement)
- `README.md` / `RESEARCH.md` — product truth and pivot
- `src/lib/dataset.js` — synthetic no-PII eval scenes
- Future: `docs/problem-and-city.md` (separate backlog item A1)

---

## 10. Document control

| Field | Value |
|---|---|
| Version | 0.1 DRAFT |
| Repo HEAD at authoring | align with patch BASE sha |
| Next review | Before any non-synthetic field data enters the product |
