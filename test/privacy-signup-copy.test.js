const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function privacyHtml() {
  const start = html.indexOf("privacy: { title: 'מדיניות פרטיות (דמו)'");
  assert.ok(start >= 0, 'privacy modal text not found');
  const end = html.indexOf('` }', start);
  return html.slice(start, end);
}

test('the local sign-up exists in the app (name + email in parkwiz_user, email copied to parkwiz_analytics)', () => {
  assert.match(html, /const PW_USER_KEY = 'parkwiz_user';/);
  assert.match(html, /const key = 'parkwiz_analytics';/);
  assert.match(html, /track\(pwAuthMode === 'signup' \? 'signup' : 'login', \{ email \}\)/);
});

test('privacy text no longer says there is no sign-up and describes the local storage', () => {
  const privacy = privacyHtml();
  assert.doesNotMatch(privacy, /אין הרשמה/);
  assert.match(privacy, /הרשמה מקומית/);
  assert.match(privacy, /השם והאימייל/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /יומן האנליטיקה/);
  assert.match(privacy, /לא נשלח לשרת/);
});
