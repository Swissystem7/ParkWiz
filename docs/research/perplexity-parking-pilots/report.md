# ParkWiz: נתוני חניונים ופיילוטים עירוניים (מחקר Perplexity)

- מקור: חיפוש Perplexity Pro רגיל, 16.11.2026, thread: https://www.perplexity.ai/session/ae0cf8e1-45d1-4b10-8702-3c2ab2630a2a
- מטרה: חומר רקע לפגישה בפארק עתידים
- הערה: התשובה מועתקת כמעט מילה במילה. הטבלאות הפכו לרשימות, ותגי הציטוט נשמרו בסוגריים מרובעים. המקורות המלאים נמצאים ב-sources.txt.

## שאלה
Smart parking and municipal parking pilots: give data and sources on (a) parking garage occupancy and search-for-parking time statistics in Israeli and global cities, (b) municipal smart-parking pilots (sensors, apps, dynamic pricing) with results, especially Israel (Tel Aviv, Netanya, Herzliya), and (c) what municipalities look for when evaluating a parking-tech startup pilot.

## תשובה (באנגלית, כפי שהתקבלה)

The strongest documented benchmark is San Francisco's SFpark: daytime garage occupancy rose from 51% to 59%, while reported street-parking search time fell from 11.6 to 6.6 minutes. Israel has useful deployment evidence, but substantially less public, independently evaluated outcome data, particularly for Netanya and Herzliya. Tel Aviv has large-scale private street-parking sensor data, which should not be confused with municipal garage occupancy or a controlled municipal pilot. [sfmta +3]

### A. Occupancy and parking-search statistics

- **San Francisco, SFpark (evaluation June 2014), municipal garages:** Average daytime occupancy rose from 51% to 59% (+8 pp). Garages kept parking available at least 97% of the time. This measures garage utilization, not search time. [sfmta]
- **SFpark, on-street search:** Intercept-survey search time fell from 11.6 to 6.6 minutes (−43%). Control areas fell from 6.4 to 5.6 minutes (−13%). The 43% figure is not control-adjusted. [sfmta]
- **SFpark, on-street occupancy:** The target range of 60–80% was achieved 31% more often (controls +6%). Blocks at 90–100% ("too full") were 16% less frequent, versus +51% in controls. [sfmta]
- **Central Tel Aviv, Pumba 2024–2025 report:** More than 1,000 sensors over about 8,000 spaces. Drivers without the app search for 38 minutes on average. This is private-company research, not a municipal survey. [parking-mobility]
- **Central Tel Aviv, Pumba 2025–2026 (as reported):** Mean occupancy was 99.8% in the monitored streets. On weekdays between 17:00 and 20:00, half of vacated spaces were taken within 2 minutes. Navigation-assisted search took about 13 minutes, versus 38 minutes without it. These are vendor-derived findings and do not establish causality. [mako.co]
- **Downtown LA Express Park:** 10% greater availability and a 37% reduction in parking duration (how long vehicles stay parked, not search time). [itskrs.its.dot]

**Israeli garage occupancy is an evidence gap.** No defensible published citywide garage-occupancy figure or garage search-time figure was found for Tel Aviv, Netanya or Herzliya.
- Tel Aviv smart-city documentation describes lot availability information, prices and automated payment in Ahuzot HaHof lots. It shows these functions exist, not that they were evaluated. [tel-aviv]
- Ahuzot HaHof publishes capacities (for example, a 53-space facility), which are not occupancy figures. [ahuzot]
- Third-party apps show live availability, but this is not a historical occupancy rate. [henyonim +1]
- For a credible Israeli garage study, request timestamped occupied-space counts, usable capacity, entries and exits, closures, reservations and subscriber allocations. Measure destination-to-garage search, entrance queuing and entrance-to-stall search separately. [sfmta]

### B. Municipal smart-parking pilots

**Israel**
- **Tel Aviv, municipal information and payment services:** Lot availability, navigation information, mobile payment and automated payment. The services are confirmed, but no occupancy or search-time improvement is quantified. [tel-aviv]
- **Tel Aviv, Pumba:** Camera and computer-vision sensors plus an app. Reports a search-time drop from 38 to 13 minutes. This is a private deployment, and municipal sponsorship was not established. [parking-mobility +2]
- **Netanya, "Era of Smart Parking" (25.3.2025):** Street parking meters removed in a move to app payment. No quantitative outcomes. This is payment modernization, not a sensor or dynamic-pricing pilot. [netanya]
- **Netanya, smart enforcement:** Cameras used against double parking, blocked lanes and crosswalk parking. No before/after numbers. [netanya]
- **Herzliya, beach-lot pricing pilot (2024):** Residents get 4 free hours, then a 50% discount. The arrangement was extended year-round to 5 lots and described as successful, with no occupancy or turnover data. [tzomet-hrz +1]
- **Kfar Saba, Spaceek (Nov 2015):** Sensors plus a navigation app. Reported to have passed its initial pilot, with no numbers. [globes]
- **Key point:** "Smart parking" covers several categories: payment, enforcement, occupancy detection, navigation and pricing. Success in one is not evidence for another.

**Global**
- **SFpark (April 2011):** About 6,000 street spaces and 12,250 garage spaces in 7 pilot districts, plus 2 control areas. Used in-ground sensors, networked meters and real-time information. Results:
  - Search time −43% (controls −13%).
  - Garage occupancy rose from 51% to 59%.
  - Average hourly prices −4% on street and −12% in garages.
  - Search-related VMT −30% (controls −6%).
  - Citations per meter −23%.
  - Caveats: it tested a package of changes, and "dynamic" prices were adjusted about every 8 weeks on street and quarterly in garages. [sfmta +1]
- **LA Express Park (May 2012, then Westwood, Hollywood and Venice):**
  - Downtown: +10% availability and −37% parking duration.
  - Venice: −26% parking duration.
  - Hollywood: −19% parking duration.
  - Some downtown areas: +16% revenue. [itskrs.its.dot]
- **Melbourne:** Real-time sensor data is published and nominally updated every 2 minutes. The portal warns of network delays, sensors not operating on public holidays, and construction-blocked spaces appearing vacant. A space reported as "empty" is not necessarily usable. [data.melbourne]

### C. What municipalities look for in a parking-tech startup pilot

**Prince George's County RFP (April 2026), scoring weights:**
- Technical approach: 40
- Experience and references: 25
- Fees and costs: 20
- Compliance and responsiveness: 15

It also requires:
- an open API and interoperability with existing systems
- secure data exchange and audit logs
- configurable workflows
- implementation, testing and training
- support and SLAs
- cyber-liability insurance [princegeorgescountymd]

**Local route:** Tel Aviv's Startup Committee allows real-world beta testing, including parking management, for up to 6 months with a limited number of participants. CityZone offers a testing site, data access and mentorship. This is not a commitment to procure after the trial. [tel-aviv]

**Practical checklist (a synthesis, not an official standard):**
- **Public problem:** A specific use case (search in one district, an underused lot, accessibility or loading spaces, enforcement workload). App downloads should not be the main metric.
- **Works in real conditions:** Independently checked observations, false-vacancy and false-occupancy rates, and performance by day and night, weather, occlusion and space type.
- **Actionable information:** End-to-end latency, stale-data handling, legal eligibility, closures, and whether the space is still usable when the driver arrives.
- **Improves outcomes:** Baseline plus a control area, search time, successful-parking rate, occupancy by time band, turnover and spillover.
- **Operable by the city:** Maintenance owner, fault alerts, installation requirements, support SLA, replacement procedures and training.
- **Integration:** With the existing parking, payment, GIS, enforcement and signage systems, not a standalone dashboard.
- **Privacy and security:** Data-flow map, data minimization, access control, audit logs, encryption, retention and deletion rules, and incident responsibility.
- **Full cost:** Hardware, connectivity, cloud, licenses, maintenance, integrations, replacements and removal.
- **Exit and scale:** Exportable data, documented interfaces, transition assistance, licensing terms and a priced expansion option.

**Proposed pilot design:**
1. One bounded problem, for example one garage plus the streets around it.
2. A baseline and an untreated comparison area before installation, following SFpark. [sfmta]
3. Separate technical acceptance (errors, latency, uptime, data completeness), operational fit (maintenance, workflow) and public benefit (search time, successful parking, fewer unusable recommendations).
4. Agree measurement definitions in advance (when "search time" starts and ends; the capacity, area and hours behind "occupancy").
5. Accessibility and access without the app, such as signage.
6. Written go/no-go criteria, budget limits, data handover and equipment-removal terms before launch. [parkingtoday]

**Claims to use and claims to avoid:**
- **Use:** "SFpark's municipal evaluation found a 43% before/after reduction in reported search time, versus 13% in control areas." **Avoid:** "Our sensors will reduce traffic by 43%."
- **Use:** "Pumba reports broad coverage in central Tel Aviv and shorter app-assisted searches." **Avoid:** "Tel Aviv municipality proved a 38-to-13-minute improvement."
- **Use:** "Netanya has documented payment modernization and digital enforcement." **Avoid:** "Netanya published successful sensor-pilot results."
- **Use:** "Herzliya extended a resident parking benefit after a pilot." **Avoid:** "Herzliya demonstrated successful dynamic pricing."

**Conclusion:** The strongest evidence package for an Israeli startup combines SFpark's methodology, local garage-operator data, and a narrow municipal pilot with criteria agreed in advance, while labeling vendor claims and local data gaps.
