'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('leavingOverlay has region role, dialog container, and aria-labelledby', () => {
  assert.match(html, /id="leavingOverlay"[^>]*onclick="cancelLeaving\(event\)"[^>]*role="region"[^>]*aria-label="דיווח על פינוי חניה"/);
  assert.match(html, /<div class="leaving-box" role="dialog" aria-modal="true" aria-labelledby="leavingStep0Title">/);
  assert.match(html, /<div class="leaving-step-title" id="leavingStep0Title">🕐 מתי אתה יוצא\?<\/div>/);
  assert.match(html, /<div class="leaving-step-title" id="leavingStep1Title">🚗 איזה סוג חניה\?<\/div>/);
});

test('leavingOverlay buttons are semantic button elements with explicit type', () => {
  assert.match(html, /<button type="button" class="leaving-type-btn" onclick="leavingPickWhen\(0,this\)">🚗 עכשיו<\/button>/);
  assert.match(html, /<button type="button" class="cancel-btn" id="leavingCancelBtn0" onclick="cancelLeaving\(event\)">ביטול<\/button>/);
  assert.match(html, /<button type="button" class="leaving-type-btn" onclick="leavingPickType\('free',this\)">⚪ חינם<\/button>/);
  assert.match(html, /<button type="button" class="cancel-btn" id="leavingCancelBtn1" onclick="cancelLeaving\(event\)">ביטול<\/button>/);
  assert.match(html, /<button type="button" class="btn btn-primary" style="width:100%;margin-top:8px" onclick="leavingSubmit\(\)">שלח דיווח ✅<\/button>/);
  assert.match(html, /<button type="button" class="cancel-btn" id="leavingCancelBtn2" onclick="cancelLeaving\(event\)">ביטול<\/button>/);
});

test('spotsSlider has accessible label and aria attributes', () => {
  assert.match(html, /<label for="spotsSlider" class="leaving-step-title" id="leavingStep2Title" style="display:block">🅿️ כמה מקומות נפנו לידך\?<\/label>/);
  assert.match(html, /<input type="range" min="1" max="3" value="1"[^>]*id="spotsSlider"[^>]*aria-label="מספר מקומות שנפנו"[^>]*aria-labelledby="leavingStep2Title"/);
  assert.match(html, /<div class="leaving-slider-val" id="sliderVal" aria-live="polite">1<\/div>/);
  assert.match(html, /<div class="leaving-count" id="leavingCount" aria-live="polite">3<\/div>/);
  assert.match(html, /<div class="leaving-label" id="leavingLabel" aria-live="polite">מדווח בעוד\.\.\.<\/div>/);
});

test('cancelLeaving guards against clicks inside dialog content and handles backdrop click', () => {
  assert.match(html, /function cancelLeaving\(e\)\s*\{[\s\S]*?!e\.target\.closest\('\.cancel-btn'\)/);
  assert.match(html, /if \(leavingIv\)\s*\{\s*clearInterval\(leavingIv\);\s*leavingIv = null;\s*\}/);
});

test('escape key listener closes leavingOverlay when active', () => {
  assert.match(html, /window\.addEventListener\('keydown',\s*\(e\)\s*=>\s*\{[\s\S]*?e\.key === 'Escape'[\s\S]*?document\.getElementById\('leavingOverlay'\)[\s\S]*?cancelLeaving\(\)/);
});

test('sw.js syntax is valid and service worker cache is bumped past v35', () => {
  assert.doesNotThrow(() => {
    execFileSync('node', ['--check', path.join(root, 'sw.js')]);
  }, 'sw.js must be syntactically valid JavaScript');
  const matches = [...sw.matchAll(/const CACHE = 'parkwiz-field-v(\d+)';/g)];
  assert.equal(matches.length, 1, 'sw.js should have exactly one CACHE declaration');
  const v = Number(matches[0][1]);
  assert.ok(v >= 36, `expected CACHE version >= 36, got v${v}`);
});
