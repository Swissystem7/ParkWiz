# Transportation track requirements vs ParkWiz (DRAFT)

**Status:** DRAFT — portfolio / pilot-readiness checklist (A2), **not** an open Innovate4Cities submission.
**Hackathon window:** AI × City Climate Action / Innovate4Cities deadline **31.8.2026 PASSED** (site later listed extended close **3.9.2026 CET**; as of this note both are closed). Do **not** claim the call is still open.
**Track framing:** Priority action **Transportation** (sustainable / accessible mobility → lower emissions + better connectivity).
**Positioning:** local-first · privacy-first · occupied/free measurement · **no live cameras in this repo** · no LPR · **Pilot City (TBD — owner decision)**.
**Source for requirement text:** [Innovate4Cities Hackathon 2026](https://www.innovate4cities.org/hackathon/hackathon2026/) (official challenge page; captured for portfolio mapping **2026-09-07**). Ratings below are **repo-truth assessments**, not jury scores.

This table maps official theme / submission / judging expectations to **what exists in the ParkWiz repository today**. It does **not** invent a city commitment, a signed LOI, or field-measured climate savings.

**Rating legend**

| Rating | Meaning |
|---|---|
| **FULL** | In-repo artifact clearly satisfies the requirement for portfolio use |
| **PARTIAL** | Directionally present; gaps remain before a city pilot or a complete submission pack |
| **UNKNOWN** | Cannot honestly rate from repo evidence alone |

**Hard rule for this doc:** rows **City scale**, **Climate challenge**, and **Evidence-based** must be rated **FULL** or **PARTIAL** — never **UNKNOWN**.

---

## 1. Requirements matrix

| ID | Requirement (official / derived) | ParkWiz capability (in-repo) | Rating | Evidence / gap |
|---|---|---|---|---|
| T1 | **City scale** — usable at city scale | Municipal occupancy **pilot kit** (calibrate / compare / log / report / brief) aimed at traffic/parking & innovation units; demo map uses Netanya streets as **illustrative geography only**. Single-camera, 30-day free technical pilot framing — not a deployed multi-district system. **Pilot City (TBD)** — no committed partner. | **PARTIAL** | `README.md`, `offer.html`, pilot-*.html; Netanya = demo geography, not consent (`NETANYA_OUTREACH.md` unsent). Scale path is street → city **by design**, not by live coverage. |
| T2 | **Climate challenge** — addresses a climate challenge | Transportation-first problem (curb-search / circling → congestion) with **climate co-benefit** narrative (less idle fuel / local emissions). Magnitude of emission savings is **`UNVERIFIED`** — ParkWiz has not measured field CO₂. | **PARTIAL** | Problem framing in `README.md` / PIVOT in `RESEARCH.md`; MIT parking-aware navigation / emissions context cited in research as literature only. Not a carbon-accounting product. |
| T3 | **Evidence-based** — evidence-based (and AI-driven theme) | Deterministic availability / heuristic occupancy code; synthetic eval dataset; Wilson CI compare-vs-inspector protocol; honesty banners; tests under `test/*.js`. **Field accuracy vs inspector not yet measured.** | **PARTIAL** | `src/lib/*`, `pilot-eval.html`, `pilot-compare.html`, `pilot-method.html`, `RESEARCH.md` honesty. Evidence exists for **methods + synthetic demo**, not for proven field impact. |
| T4 | **AI-driven** — AI / data-driven application | Local **heuristic** occupancy scoring + deterministic hourly availability model in-browser; geospatial demo map (Leaflet + GeoJSON lots). No trained ML model, no cloud inference, no live video AI pipeline in-repo. | **PARTIAL** | `src/lib/heuristic.js`, `availability-model.js`, map demo. Honest as “data / heuristic demo”, not as deep-learning CCTV product. |
| T5 | **Transportation priority** — sustainable / accessible mobility, emissions + connectivity | Curb-parking search time and congestion are a **mobility** problem; kit supports planning-oriented occupied/free counts (not ticketing). Connectivity benefit is indirect (less circling), not transit routing. | **PARTIAL** | Aligns with Transportation priority **problem class**; does not implement routing, EV fleets, or transit APIs. |
| T6 | **Demonstration** — full or partial demo (app / dashboard / viz / recording) | Public GitHub Pages demo + printable pilot surfaces (kit, dashboard, report, summary hash share). | **PARTIAL** | Live UI demo exists; no live municipal camera feed; synthetic / sample labels required. |
| T7 | **Concept deck** — ≤20-page PDF (problem, method, users, benefits, USP) | One-page municipal brief + offer/pitch HTML; archived hackathon marketplace pitch is **historical only**. No current ≤20-slide Innovate4Cities PDF in-repo. | **UNKNOWN** | Need owner-approved deck for any future call; do not treat archive marketplace pitch as current product. |
| T8 | **Pilot plan** — logical plan for winner 6-month city pilot | In-repo **30-day** single-camera technical pilot protocol (log stop-rule, privacy request draft). Not a full 6-month staffing / city-pairing plan. | **PARTIAL** | `pilot-log.html`, `pilot-brief.html`, `pilot-privacy.html`, `RESEARCH.md` PIVOT. Extend only after **Pilot City (TBD)** decision. |
| T9 | **Impact narrative** — concrete benefits + who benefits | Beneficiaries framed as municipal planning / inspectors / portfolio evaluators; drivers indirect; no paying-driver claim. Quantified city climate impact **`UNVERIFIED`**. | **PARTIAL** | `README.md`, `RESEARCH.md`, `MONETIZATION.md` (no proven revenue). |
| T10 | **Feasibility / viability** — practical on-ground PoC | Browser-local kit, no cloud deps in core path, PWA cache for field pages — strong for a **cheap technical PoC**. Missing: city access, field measurement, legal/DPIA sign-off. | **PARTIAL** | Honesty section in `README.md`; privacy draft is not an agreement. |
| T11 | **Privacy & non-enforcement** (ParkWiz self-constraint; supports climate-city trust) | Occupied/free only; no LPR / faces; no enforcement revenue promise; no live camera pipeline in repo. | **FULL** | `README.md`, `pilot-privacy.html`, court/PPA context in `RESEARCH.md`. |
| T12 | **Committed pilot city partner** | **Pilot City (TBD — owner decision).** Netanya appears as demo geography and unsent outreach draft only. | **UNKNOWN** | Do **not** invent a city commitment. Owner must consent before naming a partner. |

---

## 2. Checklist (portfolio readiness — not open submission)

- [x] Theme triad rated without UNKNOWN: **City scale**, **Climate challenge**, **Evidence-based**
- [x] Transportation priority row present and rated
- [x] Hackathon window marked **PASSED**
- [x] **Pilot City (TBD)** — no invented LOI
- [x] Privacy-first / no live cameras / no LPR stated
- [ ] Owner decides real city name (or keep TBD)
- [ ] Optional: build concept deck + 6-month pilot plan **after** city decision (future rounds B1/B2)
- [ ] Optional: offline harness / UX flow (future C1 / C3) before claiming stronger **Evidence-based** / **Viability**

---

## 3. Alignment with A1 framing

| A1 item | How this matrix uses it |
|---|---|
| Pilot City (TBD) | T1 / T12 — city scale is capability design, not a named partner |
| Problem = curb search / congestion | T2 / T5 — transport first |
| Climate = co-benefit | T2 — emissions narrative; magnitude `UNVERIFIED` |
| Privacy-first, no cameras in repo | T11 + header positioning |
| Deadline PASSED | Header + checklist |

Do **not** revive the archived private-marketplace hackathon identity (`docs/archive/HACKATHON.md`) as the Transportation submission story.

---

## 4. Document control

| Field | Value |
|---|---|
| Version | 0.1 DRAFT |
| Related | `README.md`, `RESEARCH.md`, `NETANYA_OUTREACH.md`, A1 `docs/problem-and-city.md` (when applied), `docs/archive/INDEX.md` |
| Next suggested rounds | **C1** offline harness → **C3** UX flow → **B1/B2** deck / pilot align |
