# PW-001 Baseline Current-State Audit

Scope: factual, read-only audit of `index.html` (2,533 lines at audit time). Line numbers below refer to that file.

## 1. Every `Math.random()` usage

There are 37 calls:

- Line 920: chooses a random street for a fabricated `liveParkingEvent`.
- Line 922: chooses a random claimed source app (`פנגו`, `סלופארק`, or `ParkWiz`) for that fabricated event.
- Line 923: chooses a random vehicle type for that fabricated event.
- Line 924: randomly decides whether the fabricated vehicle exits (55%) or enters (45%).
- Line 925: randomizes the availability increase for a fabricated exit.
- Line 926: randomizes the alleged newly opened gap length.
- Line 932: randomizes the availability decrease for a fabricated entry.
- Line 1074: adds random jitter to the generated hourly availability pattern.
- Line 1123: chooses a random street for a generated legacy spot.
- Line 1125: generates the roll that assigns the generated spot as free, soon, or taken.
- Line 1128 (first call): randomizes the generated spot's horizontal position on a horizontal street.
- Line 1128 (second call): jitters the generated spot's horizontal position on a vertical street.
- Line 1129 (first call): jitters the generated spot's vertical position on a horizontal street.
- Line 1129 (second call): randomizes the generated spot's vertical position on a vertical street.
- Line 1131: fabricates a street number for the generated spot.
- Line 1132: fabricates the generated spot's distance (50–849 m).
- Line 1133: fabricates how many minutes ago the generated spot was reported (1–8).
- Line 1134: creates a random client-side ID for the generated spot.
- Line 1204: randomly decides whether a decorative building block receives a lit-window rectangle; this is visual decoration, not parking data.
- Line 1506: randomizes the displayed current spot/report count used in the street detail card.
- Line 1650: chooses a random street for a future user report if no street is selected.
- Line 1655: randomizes the future-report marker's horizontal position on a horizontal street.
- Line 1656: randomizes the future-report marker's vertical position on a vertical street.
- Line 1743: chooses a random street for an immediate user leaving report if no street is selected.
- Line 1852: chooses a random street whose availability will drift during each refresh.
- Line 1853: randomizes that street's availability drift.
- Line 2052: randomly labels a generated route parking candidate as blue-white or free.
- Line 2053: randomizes the displayed vacancy probability of a generated route parking candidate.
- Line 2055: randomizes the displayed hourly price of a generated blue-white route candidate.
- Line 2056 (first call): jitters a generated route candidate's horizontal position.
- Line 2056 (second call): jitters a generated route candidate's vertical position.
- Line 2188: randomly selects a weighted street for a simulated Pango event.
- Line 2196: randomizes the simulated Pango marker's horizontal position on a horizontal street.
- Line 2197: randomizes the simulated Pango marker's vertical position on a vertical street.
- Line 2198: randomizes the simulated Pango event lifetime between two and three minutes.
- Line 2201: fabricates the street number in the Pango feed message.
- Line 2208: randomizes the delay until the next simulated Pango event (6–10 seconds).

## 2. Every `setInterval`

- Line 942: calls `liveParkingEvent` every 8 seconds, fabricating parking entry/exit events and changing street availability.
- Line 1679: calls `pruneFutureReports` every 5 seconds to activate and expire locally stored future user reports.
- Line 1717: runs the leaving-report countdown once per second; it clears itself at zero.
- Line 1759: advances the community-feed display timer once per second and rotates the shown item every 4 seconds.
- Line 2134: advances the explicitly simulated 8-second navigation animation every 50 ms; it is cleared when navigation finishes.
- Line 2211: every 5 seconds, removes expired simulated Pango events and reverses their temporary availability boosts.
- Line 2225: calls `refreshStreets` every 3.5 seconds; that function randomly drifts two street availability values and resets the “updated” age.
- Line 2227: redraws animated/pulsing map state every 60 ms while a route, Pango event, future report, or recent flash is active.

## 3. `liveParkingEvent` mechanism

`liveParkingEvent` is defined at lines 919–941 and scheduled every 8 seconds at line 942. It randomly selects a street, an alleged provider (`פנגו`, `סלופארק`, or `ParkWiz`), and a vehicle type (lines 920–924). It then fabricates either an exit or entry: an exit increases the street's availability, invents a gap size, inserts a provider-branded community-feed message, and can trigger a matching-vehicle toast (lines 925–930); an entry decreases availability and inserts a provider-branded “took a space” message (lines 931–934). It also expires fabricated gap data after three minutes (line 936–937). No network call, provider SDK, server, authenticated user event, or other real source feeds this mechanism.

## 4. Pango / Cellopark / סלופרק mentions

- Line 504: “Pango integration” is explicitly labeled a demo (`הדמיה`) and says a commercial version would require cooperation with parking-payment providers. Simulated.
- Lines 917–918: the “live feed” names Pango and `סלופארק` in a hard-coded provider array. Events attributed to them are randomly generated by `liveParkingEvent`; simulated. (`סלופארק` is the spelling present in the file; the requested spelling `סלופרק` does not occur.)
- Lines 922 and 928: a random provider is selected and its name is inserted into a fabricated entry/exit feed message. Simulated.
- Lines 1371, 1387: comments/rendering describe Pango payment-ended events and show “מתפנה (פנגו) ~2 דק'”; these render the simulated `pangoEvents` array. Simulated.
- Lines 1520–1522: the street card displays a Pango event count. It always starts at a fabricated baseline of 2 and adds simulated `pangoEvents`; simulated.
- Lines 2005, 2153–2156: `pangoEvents` is an in-memory array checked during navigation; it has no real provider backing. Simulated.
- Line 2146: navigation may claim that a driver is ending a Pango session 50 meters to the right. This is conditional on the simulated array, not real location/payment data. Simulated.
- Lines 2181–2209: the Pango layer is explicitly labeled “simulation”; it fabricates weighted streets, marker positions, expiry, street numbers, “payment ended” feed messages, and an availability boost, then schedules another fake event after 6–10 seconds. Simulated.
- Lines 2211–2222: simulated Pango events are expired and their fabricated availability boost is reverted. Simulated maintenance logic.
- `Cellopark` and `Cello` do not occur anywhere in `index.html`.

## 5. Claims of real-time / live / `זמן אמת` / `נתון אמת`

- Lines 9–10: SEO metadata claims real-time parking discovery. Not backed by a real-time source; availability is initialized locally and randomly mutated.
- Line 11: Open Graph metadata calls the map “live,” community-based, and able to reserve in advance. The displayed feed is substantially prewritten/generated and timer-driven; no remote community source or booking backend is present.
- Line 413: the hero says street parking availability is shown “in real time.” Not backed by a real source.
- Lines 418–420: the UI shows a pulsing “live update” badge and “updated 0 seconds ago.” Its age is controlled locally and reset by the random refresh loop (lines 1847–1857, 2225), not by receipt of source data.
- Line 439: claims the community reports in real time. The feed includes fabricated provider events and static/local items; there is no remote community feed.
- Lines 467–469: labels the panel as a live/recent community feed. It is local browser state and simulated content, not a live service.
- Line 788: calls a selected car-park record “real data, Tel Aviv Municipality.” The record comes from local `tlv-lots.json` loaded at line 758. It may be a municipal-data snapshot, but `index.html` supplies no source URL, license, retrieval/update time, or live status; it is not evidence of live occupancy.
- Line 814: repeats “Ahuzot HaHof — real data, Tel Aviv Municipality” for local lot features loaded at line 805. Same limitation: local static data and no provenance metadata or live occupancy feed in the file.
- Line 1846: the code itself labels the refresh section “Live simulation”; lines 1847–1857 randomly mutate availability and reset the update timer. This directly shows that the apparent live availability refresh is simulated.
- Line 2466: the privacy text claims the service computes parking availability in real time. No real-time source backs that computation in this file.
- Line 2479: onboarding calls the map live and based on real-time community reports. No remote report source backs the claim; the displayed state is local, seeded, user-entered in the current browser, and/or randomly fabricated.

## 6. Local JSON datasets

- `tlv-zones.json`: loaded at line 804 (inside the municipal-layer toggle). It supplies parking-zone geometry/tooltips at lines 808–811. It is a local static dataset, not presented as live occupancy; it is presented as municipal zone data. The file contains no source URL, license, snapshot date, or update timestamp.
- `tlv-lots.json`: loaded at line 758 for vacation-plan car-park fallback records and again at line 805 for the municipal map layer. It is presented as “real data, Tel Aviv Municipality” at lines 788 and 814, but not explicitly as live. It supplies facility identity/location context only; there is no live capacity or occupancy field consumption in `index.html`, and no source URL, license, snapshot date, or update timestamp is shown.

No other local JSON dataset is loaded by `index.html`.

## 7. Payment, booking, fine, and tow features

- Premium purchase/activation: the pricing UI advertises paid plans and advance booking at lines 287–320. `activatePremium` (lines 1899–1907) only flips the in-memory `isPremium` flag and changes UI text; no checkout, payment provider, account entitlement, or recurring billing exists. It is not visibly labeled as a simulation in the pricing UI.
- Standard space reservation: the modal at lines 640–650 advertises a ₪4.50 reservation for 30 minutes with payment at the end. `openReserve`/`confirmReserve` at lines 1801–1810 merely open/close the modal and show a success/charge toast; no inventory lock, persistence, payment, or booking backend exists. This flow is not marked as simulation in the modal.
- Private-space marketplace: the five private listings are hard-coded at lines 945–951. The rental route is explicitly labeled credit-card payment “simulation” at line 975, and the form visibly warns “simulation — do not enter a real card” at line 995. `payRent` at lines 1024–1035 waits locally, sets `booked = true`, updates the marker, and displays confirmation; it does not transmit or charge card data. This payment flow is marked as simulation, although the listing identities, availability, guarantee, and booking confirmation are not separately labeled as fabricated.
- Pango/payment-ended feature: line 504 explicitly labels the integration as a demo; lines 2181–2209 explicitly generate simulated payment-ended events. No actual parking payment is started, ended, or queried.
- Fine claims: line 741 states reserved-space fines of ₪250–₪1,000; line 992 imposes a ₪100 late fine in the private-rental promise. Neither claim is sourced or enforced in code. The line 992 fine is inside the payment simulation; line 741 is not marked as simulation.
- Tow claims: line 992 says late renters will be towed at their expense, while line 2458 disclaims responsibility for towing. There is no tow workflow or external enforcement integration. The threat appears inside the simulated private-rental flow, but it is not independently labeled as a simulation.
- Legal booking language: line 2461 describes Premium as monthly billed and says advance booking depends on actual availability and is not guaranteed. No billing or actual-availability backend exists, and this legal copy is not marked as simulation.

## Honest verdict

The app presents itself in metadata, core UI, onboarding, pricing, and legal/privacy copy as a live, community-powered, real-time parking service with provider events, forecasts, navigation, paid Premium access, advance reservations, private-space booking, payments, fines, and towing consequences. What is actually implemented in `index.html` is a browser-only prototype: street availability, reports, Pango/סלופארק events, route candidates, counts, prices, and refreshes are hard-coded, locally generated, user-entered only in the current page, or randomized on timers; bookings and payments only change in-memory UI state. The two local municipal JSON files can provide static zone and car-park context, but the file contains no provenance/update metadata and no live occupancy feed. Therefore the municipal geometry/facility snapshot is the only plausibly real external data represented, while the operational “live,” integration, payment, and booking claims are not backed by real services.
