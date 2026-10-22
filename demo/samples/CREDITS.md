# demo/samples — rehearsal clips for `demo/camera.html`

No video is committed here: tens of MB do not belong in `git` or on GitHub Pages
(`*.mp4`, `*.mov` and `*.webm` in this folder are git-ignored). **Download one clip
to this folder before a meeting with no Wi-Fi**, open `demo/camera.html` once while
online so the detector model (~6MB, CDN) is cached, then load the clip through
«קובץ וידאו או תמונה». A phone pointed at the meeting-room window works too.

Free parking-lot clips under the [Pexels License](https://www.pexels.com/license/)
(free for commercial use, no attribution required, no redistribution as-is):

| Clip | Source | Why it rehearses well |
|---|---|---|
| An aerial view of a parking lot with cars | https://www.pexels.com/video/an-aerial-view-of-a-parking-lot-with-cars-28125710/ | high camera angle like a lot CCTV mast, straight rows of bays |
| Time lapse video of a parking lot | https://www.pexels.com/video/time-lapse-video-of-a-parking-lot-5836409/ | fast turnover: many occupied → free transitions per minute, so the «התפנה תא» toast and the hourly heat-map fill quickly |

Pick the 720p / HD download: the detector runs at ~1.4 frames per second and a 4K
file only slows decoding. Drag one bay per parking space on the first frame; a
time-lapse moves fast, so expect the 3-frame debounce to drop the very shortest stops.

Clips are rehearsal material only. Nothing here is Atidim Park footage, and the
numbers the page shows on them are not pilot measurements.
