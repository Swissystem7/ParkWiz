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
  assert.match(html, /<button type="button" class="pw-close" id="pwFbCloseBtn" onclick="pwCloseFeedback\(event\)" aria-label="ביטול — סגור חלון משוב">ביטול<\/button>/);
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

test('.pw-fb-fab text passes WCAG AA color-contrast (4.5:1) in both themes', () => {
  const tokens = fs.readFileSync(path.join(root, 'src/ui/tokens.css'), 'utf8');
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const block = (sel) => {
    const s = tokens.indexOf(sel + '{');
    return tokens.slice(s, tokens.indexOf('}', s));
  };
  const token = (css, name) => {
    const m = new RegExp('--pw-' + name + ':(#[0-9a-f]{6})').exec(css);
    assert.ok(m, 'missing --pw-' + name);
    return m[1];
  };
  const fab = (/\.pw-fb-fab\{([^}]*)\}/.exec(html) || [])[1] || '';
  const fgDecl = (/(?:^|;)color:([^;]+)/.exec(fab) || [])[1];
  const bgDecl = (/(?:^|;)background:([^;]+)/.exec(fab) || [])[1];
  assert.ok(fgDecl && bgDecl, '.pw-fb-fab must declare background and color');
  for (const [label, css] of [['dark', block(':root')], ['light', block('[data-theme="light"]')]]) {
    const brand = token(css, 'brand');
    const resolve = (decl) => {
      decl = decl.trim();
      if (decl.startsWith('#')) return decl;
      if (decl.includes('--pw-on-brand')) return token(css, 'on-brand');
      if (decl.includes('--green') || decl.includes('--pw-brand')) return brand;
      assert.fail(label + ': unresolvable color ' + decl);
    };
    const ratio = contrast(resolve(fgDecl), resolve(bgDecl));
    assert.ok(ratio >= 4.5, `${label}: .pw-fb-fab contrast ${ratio.toFixed(2)}:1 < 4.5:1`);
  }
});

test('service worker cache is bumped to v27 or later following modal accessibility update', () => {
  const v = Number((sw.match(/const CACHE = 'parkwiz-field-v(\d+)';/) || [])[1]);
  assert.ok(v >= 27, 'cache version ' + v + ' regressed below v27');
});
