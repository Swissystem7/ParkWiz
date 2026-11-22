# Notes for coding agents

- **מדיניות מיזוג (חובה).** הענף הראשי ( או ) מוגן. אסור למזג PRs ישירות ואסור לדחוף ישירות אליו. פתח PR מענף לולאה ( או ) או dependabot. הלולאות לא ממזגות בעצמן. המיזוג האוטומטי בשרת ( דרך ) רץ רק כאשר סוקר ה-pre-PR ( — Gemini או מודל אחר השונה מהמחבר) אישר בלי בעיות חוסמות, וכל בדיקות GitHub כולל  ירוקות על ה-head הנוכחי, וה-PR הוא MERGEABLE בלי קונפליקט. אין להמתין לאישור מיזוג ידני נוסף. (כלל אבירן 22.11.2026 08:13.)
- **עיצוב.** Build UI minimal and functional; never wait for designs; approved Claude Design packages are applied later as polish.
- **CI.** `.github/workflows/ci.yml` מריץ `node --test` עם כיסוי, סריקת אבטחה והעלאה ל-Codecov בכל PR ובכל push ל-`master`. הרץ `npm test` מקומית לפני push.
- אין תלויות runtime — HTML/JS ונילה; הכל בדפדפן, פריסה דרך GitHub Pages.
