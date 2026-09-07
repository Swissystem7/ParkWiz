# Problem & City — ParkWiz (DRAFT)

**Status:** DRAFT — portfolio / backlog note (A1), not a signed municipal plan.
**Hackathon window:** Innovate4Cities deadline **31.8.2026 PASSED** — do **not** claim the call is still open.
**Positioning:** local-first · privacy-first · occupancy measurement (occupied/free) · no live cameras in this repo · no LPR.

This note documents the **problem**, a **placeholder city**, the **climate / transport narrative link**, and **beneficiaries**. It cites **in-repo** sources only; external market magnitudes stay `UNVERIFIED` unless already recorded in `RESEARCH.md` / `README.md`.

---

## Checklist (must stay non-empty)

| Item | Content (summary) |
|---|---|
| **City** | Pilot City (TBD — owner decision) — `OWNER-DECISION` / `UNVERIFIED` as committed pilot partner |
| **Problem** | Curb-parking search time + congestion; cities lack a cheap, privacy-first occupied/free measure |
| **Climate link** | Less circling for curb space → less idle fuel / emissions (narrative; magnitude `UNVERIFIED`) |
| **Beneficiaries** | Municipal traffic/parking & innovation units (planning), inspectors, portfolio evaluators; drivers only indirectly |

---

## 1. City

**Pilot City (TBD — owner decision).** Selection of any **committed** real-world pilot city is **`OWNER-DECISION`** and **`UNVERIFIED`** until the owner consents to naming a partner. Research rule: do not invent a real city commitment without agreement.

**What the repo already shows (demo geography only — not consent):**

- UI / sample map and lots use **Netanya** street labels and `netanya-lots.geojson` (see `README.md`).
- `NETANYA_OUTREACH.md` is an **unsent** draft awaiting owner approval — not a LOI and not a live pilot.
- Product truth after PIVOT (`RESEARCH.md`): free 30-day technical pilot on **one existing municipal camera**, anonymous occupied/free, no enforcement.

Until owner decision: treat Netanya as **illustrative demo geography**, not as an approved pilot city name in external submissions.

---

## 2. Problem

**Core problem (transport):** Drivers spend time **circling for curb parking** in dense urban streets; that circling adds **local congestion** and frustrates residents and visitors. Cities that want evidence for parking **planning** (not ticketing) often lack a **cheap, privacy-first** way to measure **occupied vs free** agreement between a simple local heuristic and a human inspector.

**What ParkWiz is today (in-repo):** a browser-local street-parking **demo** plus a municipal **occupancy pilot kit** (calibrate / compare / log / report) with synthetic eval data — no live municipal feed, no cloud backend (`README.md` Honesty).

**What it is not:** a live availability network, ANPR/LPR, enforcement revenue, or a proven paid product (`RESEARCH.md` PIVOT; `MONETIZATION.md`).

---

## 3. Climate link

**Narrative chain (Transportation → climate co-benefit):**

1. Curb search / circling burns time and **fuel** while cars idle or cruise for a spot.
2. Better **local occupancy awareness** (even planning-grade, not navigation promises) can reduce unnecessary circling.
3. Less circling → lower local **emissions** and frustration — a climate-adjacent transport co-benefit, not a carbon accounting product.

**Evidence discipline:**

- In-repo pointer: `RESEARCH.md` cites MIT Computing (19.2.2026) on parking-aware navigation and **emissions** framing — use as literature context only; **ParkWiz has not measured field emission savings** → treat quantified climate impact as **`UNVERIFIED`**.
- Archived hackathon pitch (`docs/archive/HACKATHON.md`) mentions fuel waste; that marketplace identity was **pivoted away** — do not revive it as current product claim.

---

## 4. Beneficiaries

| Beneficiary | Why (honest) |
|---|---|
| Municipal **traffic / parking** and **innovation** units | Planning-oriented occupancy heat / agreement metrics; free technical pilot framing — buyer named in research as innovation / traffic unit, not paying drivers |
| **Inspectors** / field staff | Paired count workflow in pilot pages (compare / log / report) — accuracy vs inspector **not yet field-measured** |
| **Portfolio / evaluators** | Honest demo + printable kit without cloud deps |
| **Drivers** | Indirect only (better planning / less circling in the long run) — **not** a paying customer today (`RESEARCH.md`) |

Non-beneficiaries / non-goals: enforcement desks seeking fine revenue; ANPR vendors; cloud SaaS lock-in.

---

## 5. Alignment with repo narrative

- **Local-first parking availability:** demo updates stay in-browser; pilot kit runs offline-capable PWA pages without a camera pipeline in-repo (`README.md`).
- **Transportation problem first;** climate is a **co-benefit link**, not a separate invented feature.
- **Privacy-first:** occupied/free counts, no plates/faces (`pilot-privacy.html`, future DPIA backlog).

---

## 6. Owner decisions

- [ ] Choose / consent a real pilot city name — or keep **Pilot City (TBD)**
- [ ] Field pilot vs portfolio-only
- [ ] Whether Netanya outreach draft may be sent (`NETANYA_OUTREACH.md`)

---

## Document control

| Field | Value |
|---|---|
| Version | 0.1 DRAFT |
| Length target | ≤2 pages |
| Related | `README.md`, `RESEARCH.md`, `NETANYA_OUTREACH.md`, `docs/archive/INDEX.md` |
