const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('pwAuthOverlay has accessible region role, dialog attributes, tablist, and form labels', () => {
  // Overlay landmark and backdrop click handler
  assert.match(html, /id="pwAuthOverlay"[^>]*onclick="pwCloseAuth\(event\)"[^>]*role="region"[^>]*aria-label="התחברות והרשמה"/);

  // Dialog container with role, aria-modal, and aria-labelledby
  assert.match(html, /<div class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pwAuthTitle">/);

  // Tablist and accessible tabs
  assert.match(html, /<div class="pw-tabs" role="tablist" aria-label="סוג כניסה">/);
  assert.match(html, /<button type="button" class="pw-tab active" id="pwTabLogin" role="tab" aria-selected="true" onclick="pwSetAuthTab\('login'\)">/);
  assert.match(html, /<button type="button" class="pw-tab" id="pwTabSignup" role="tab" aria-selected="false" onclick="pwSetAuthTab\('signup'\)">/);

  // Form controls have descriptive aria-labels
  assert.match(html, /<input class="pw-field" id="pwAuthName"[^>]*aria-label="שם מלא"/);
  assert.match(html, /<input class="pw-field" id="pwAuthEmail"[^>]*aria-label="כתובת אימייל"/);
  assert.match(html, /<input class="pw-field" id="pwAuthPass"[^>]*aria-label="סיסמה"/);

  // Error container has alert role
  assert.match(html, /<div class="pw-error" id="pwAuthError" role="alert" aria-live="assertive"><\/div>/);

  // Semantic button element for close
  assert.match(html, /<button type="button" class="pw-close" id="pwAuthCloseBtn" onclick="pwCloseAuth\(event\)" aria-label="סגור חלון התחברות">סגור<\/button>/);
});

test('pwLegalOverlay has accessible region role, dialog container, and semantic close button', () => {
  // Overlay landmark and backdrop click handler
  assert.match(html, /id="pwLegalOverlay"[^>]*onclick="pwCloseLegal\(event\)"[^>]*role="region"[^>]*aria-label="תנאי שימוש ומדיניות"/);

  // Dialog container with role, aria-modal, and aria-labelledby
  assert.match(html, /<div class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pwLegalTitle">/);

  // Legal body has region role
  assert.match(html, /<div class="pw-legal-body" id="pwLegalBody" role="region" aria-label="תוכן תנאי שימוש"><\/div>/);

  // Semantic button element for close
  assert.match(html, /<button type="button" class="pw-close" id="pwLegalCloseBtn" onclick="pwCloseLegal\(event\)" aria-label="סגור תנאי שימוש">סגור<\/button>/);
});

test('pwFbOverlay has accessible region role, dialog container, accessible star controls, and semantic close button', () => {
  // Trigger button has aria-label
  assert.match(html, /<button class="pw-fb-fab" onclick="pwOpenFeedback\(\)" aria-label="פתח חלון משוב">/);

  // Overlay landmark and backdrop click handler
  assert.match(html, /id="pwFbOverlay"[^>]*onclick="pwCloseFeedback\(event\)"[^>]*role="region"[^>]*aria-label="משוב משתמשים"/);

  // Dialog container with role, aria-modal, and aria-labelledby
  assert.match(html, /<div class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pwFbTitle">/);
  assert.match(html, /<h2 id="pwFbTitle">נשמח לשמוע ממך 💚<\/h2>/);

  // Star rating group and accessible button items
  assert.match(html, /<div class="pw-fb-stars" id="pwFbStars" role="group" aria-label="דירוג בכוכבים"><\/div>/);
  assert.match(html, /pwRenderFbStars[\s\S]*?<button type="button" class="pw-fb-star[\s\S]*?aria-label="\$\{n\} כוכבים"/);

  // Textarea has aria-label
  assert.match(html, /<textarea class="pw-fb-text" id="pwFbText"[^>]*aria-label="תוכן המשוב">/);

  // Semantic button element for close
  assert.match(html, /<button type="button" class="pw-close" id="pwFbCloseBtn" onclick="pwCloseFeedback\(event\)" aria-label="סגור חלון משוב">ביטול<\/button>/);
});

test('modal close functions guard against clicks inside dialog content', () => {
  assert.match(html, /function pwCloseAuth\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#pwAuthCloseBtn'\) && !e\.target\.closest\('\.pw-close'\)/);
  assert.match(html, /function pwCloseLegal\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#pwLegalCloseBtn'\) && !e\.target\.closest\('\.pw-close'\)/);
  assert.match(html, /function pwCloseFeedback\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#pwFbCloseBtn'\) && !e\.target\.closest\('\.pw-close'\)/);
});

test('pwSetAuthTab updates aria-selected attributes on tab buttons', () => {
  assert.match(html, /tabLogin\.setAttribute\('aria-selected',\s*isLogin \? 'true' : 'false'\);/);
  assert.match(html, /tabSignup\.setAttribute\('aria-selected',\s*!isLogin \? 'true' : 'false'\);/);
});

test('escape key listener closes pwAuthOverlay, pwLegalOverlay, and pwFbOverlay when active', () => {
  assert.match(html, /window\.addEventListener\('keydown',\s*\(e\)\s*=>\s*\{[\s\S]*?e\.key === 'Escape'[\s\S]*?pwCloseAuth\(\)[\s\S]*?pwCloseLegal\(\)[\s\S]*?pwCloseFeedback\(\)/);
});

test('service worker cache is bumped to v27 or later following modal accessibility update', () => {
  const v = Number((sw.match(/const CACHE = 'parkwiz-field-v(\d+)';/) || [])[1]);
  assert.ok(v >= 27, 'cache version ' + v + ' regressed below v27');
});
