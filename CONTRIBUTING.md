# CONTRIBUTING — מדיניות תרומה ומיזוג

## מדיניות המיזוג ל-master
- הענף `master` מוגן: שינויים נכנסים אך ורק דרך Pull Request.
- שלושת שומרי הסף הנדרשים לפני מיזוג:
  1. `Test, Security & Coverage (dell-ai)` — צנרת ה-CI של הריפו (בדיקות `node --test`, כיסוי, סריקת אבטחה).
  2. `CodeScene / Code Health` — בדיקת איכות קוד מ-CodeScene.
  3. `codecov/patch` — כיסוי הבדיקות של השינוי מ-Codecov.
- הענף חייב להיות עדכני מול `master` לפני המיזוג.
- המיזוג מתבצע אך ורק באמצעות מיזוג אוטומטי מותנה:

  ```
  gh pr merge <PR_NUMBER> --auto --squash --delete-branch
  ```

  המיזוג יתבצע אוטומטית ברגע שכל שומרי הסף ירוקים, והענף יימחק.

## הנחיות מפורשות לסוכני AI (Antigravity, Cursor, Copilot וכדומה)
- **אסור למזג PRs ישירות** — לא `gh pr merge` ללא `--auto`, לא `--admin`, ולא מיזוג ידני בממשק.
- **אסור לדחוף ישירות ל-`master`** כדי לעקוף PR.
- הסוכן פותח PR, מוודא שהבדיקות ירוקות, ומפעיל מיזוג אוטומטי מותנה בלבד.
- שינויים ב-`.github/workflows/` מותרים אך ורק ל-`ci.yml`.

## חיבור ה-Runner (dell-ai)
הצנרת רצה כברירת מחדל על `ubuntu-latest`. כדי להעביר אותה ל-Dell:

1. הפק טוקן רישום (תקף שעה אחת בלבד, לכן מפיקים אותו רק בעת ההתקנה):

   ```
   gh api --method POST -H "Accept: application/vnd.github+json" \
     /repos/Swissystem7/ParkWiz/actions/runners/registration-token --jq .token
   ```

2. ב-Dell (Windows 11), ב-PowerShell — הפקודות המדויקות מופיעות ב-Settings ← Actions ← Runners ← New self-hosted runner; המהות:

   ```
   mkdir actions-runner; cd actions-runner
   # הורד וחלץ את חבילת actions-runner-win-x64 האחרונה
   ./config.cmd --url https://github.com/Swissystem7/ParkWiz --token <TOKEN> --labels dell-ai
   ./run.cmd
   ```

3. רק לאחר שה-runner מופיע כ-Idle בהגדרות הריפו — הגדר את משתנה הריפו `CI_RUNNER` (Settings ← Secrets and variables ← Actions ← Variables) לערך:

   ```
   ["dell-ai"]
   ```

מרגע זה ה-job של ה-CI ייקלט על ידי ה-Dell במקום ubuntu-latest.
