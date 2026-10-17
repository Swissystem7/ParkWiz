const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot kit page has empty states, accessible status regions, export guards, and copy action', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');

  // Accessible live status regions
  assert.match(html, /id="kitStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="estNote"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible containers and canvas
  assert.match(html, /id="calCanvas"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="spotList"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="chart"[^>]*role="region"[^>]*aria-label="[^"]+"/);

  // Accessible file input controls
  assert.match(html, /id="fileSnap"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileEmpty"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileNight"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileSpots"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileOcc"[^>]*aria-label="[^"]+"/);

  // Copy summary button wired
  assert.match(html, /id="btnCopySummary"/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",/);
  assert.match(html, /navigator\.clipboard\.writeText/);

  // Empty states for spot list and chart
  assert.match(html, /id="spotListEmpty"/);
  assert.match(html, /id="chartEmpty"/);

  // Export and manipulation guards
  assert.match(html, /document\.getElementById\("btnExportSpots"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?setStatus\("אין מלבנים לייצוא\.",\s*true\);[\s\S]*?return;/);
  assert.match(html, /document\.getElementById\("btnExportOcc"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.occupancy\.length\)\s*\{[\s\S]*?setStatus\("אין נתוני תפוסה לייצוא\.",\s*true\);[\s\S]*?return;/);
  assert.match(html, /document\.getElementById\("btnExportCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.occupancy\.length\)\s*\{[\s\S]*?setStatus\("אין נתוני תפוסה לייצוא\.",\s*true\);[\s\S]*?return;/);
  assert.match(html, /document\.getElementById\("btnUndo"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?setStatus\("אין מלבנים לביטול\.",\s*true\);[\s\S]*?return;/);
  assert.match(html, /document\.getElementById\("btnClear"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?setStatus\("אין מלבנים למחיקה\.",\s*true\);[\s\S]*?return;/);
});
