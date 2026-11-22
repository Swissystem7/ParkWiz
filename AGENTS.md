# Notes for coding agents

- **מדיניות מיזוג (חובה).** הענף הראשי (`master` או `main`) מוגן. אסור למזג PRs ישירות ואסור לדחוף ישירות אליו. פתח PR מענף לולאה (`loop/` או `dell/`) או dependabot. הלולאות לא ממזגות בעצמן. המיזוג האוטומטי בשרת (`auto_merge.sh` דרך `approved_merge.sh`) רץ רק כאשר סוקר ה-pre-PR (`pre_pr_review.sh` — Gemini או מודל אחר השונה מהמחבר) אישר בלי בעיות חוסמות, וכל בדיקות GitHub כולל `dell-ci/full-gate` ירוקות על ה-head הנוכחי, וה-PR הוא MERGEABLE בלי קונפליקט. אין להמתין לאישור מיזוג ידני נוסף. (כלל אבירן 22.11.2026 08:13.)
- **עיצוב.** Build UI minimal and functional; never wait for designs; approved Claude Design packages are applied later as polish.
- **CI.** `.github/workflows/ci.yml` מריץ `node --test` עם כיסוי, סריקת אבטחה והעלאה ל-Codecov בכל PR ובכל push ל-`master`. הרץ `npm test` מקומית לפני push.
- אין תלויות runtime — HTML/JS ונילה; הכל בדפדפן, פריסה דרך GitHub Pages.
