# ParkWiz

Street-parking availability demo for **Netanya**. Drivers see a chance (not a guarantee) of finding a curb space, and can file a community “I’m leaving” report that updates that chance.

- **What:** A browser demo of street-parking availability on a Leaflet map of Netanya, driven by a static hourly model plus local community reports.
- **For whom:** Drivers looking for curb parking in Netanya, and anyone evaluating the demo.
- **How:** Vanilla HTML/JS hosted on [GitHub Pages](https://swissystem7.github.io/ParkWiz/). No server, no camera pipeline, no live municipal feed.

## [דמו ParkWiz](https://swissystem7.github.io/ParkWiz/)

הדמו מציג הערכת סיכוי לחניית רחוב בנתניה. אפשר לבחור רחוב במפה או בחיפוש, לראות אחוז זמינות לפי שעה, ולדווח “אני עוזב” כדי לעדכן את הסיכוי. הנתונים מקומיים בדפדפן — זו הדגמה, לא שירות חי.

## What this repo is (and is not)

This repository is the Netanya street-parking demo in `index.html`, plus small tested helpers under `src/lib/` and `lib/`. A static GeoJSON layer of municipal lots (`netanya-lots.geojson`) is shown as **locations only**, not live occupancy.

It is **not** a CCTV occupancy product. There is no camera ingest, no vision pipeline, and no claim that video frames are processed here.

Other HTML pages in the tree (`marketplace.html`, `pilot-dashboard.html`) are extra demo surfaces. They are not a separate product identity.

## Premium

> ⚠️ **הערה:** תכונת Premium היא הדגמאתית בלבד — לא מתבצעת גביה אמיתית.

הועלה מהמחשב של אבירן — יולי 2026.
