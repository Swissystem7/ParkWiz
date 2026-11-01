# Notes for coding agents

- **מדיניות מיזוג.** הענף `master` מוגן. אסור למזג PRs ישירות ואסור לדחוף ישירות ל-`master`. פתח PR, והפעל מיזוג אוטומטי מותנה בלבד: `gh pr merge <PR> --auto --squash --delete-branch`. המיזוג יתבצע רק כשכל שומרי הסף ירוקים — `Test, Security & Coverage (dell-ai)`, `CodeScene / Code Health` ו-`codecov/patch`. פירוט מלא: `CONTRIBUTING.md`.
- **CI.** `.github/workflows/ci.yml` מריץ `node --test` עם כיסוי, סריקת אבטחה והעלאה ל-Codecov בכל PR ובכל push ל-`master`. הרץ `npm test` מקומית לפני push.
- אין תלויות runtime — HTML/JS ונילה; הכל בדפדפן, פריסה דרך GitHub Pages.
