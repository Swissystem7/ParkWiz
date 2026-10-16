const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot dashboard page has empty states, accessible status regions, and a11y labels', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-dashboard.html'), 'utf8');

  // Empty state elements for tiles and chart
  assert.match(html, /<p class="empty-msg" id="tilesEmpty"[^>]*style="display:\s*none/);
  assert.match(html, /<p class="empty-msg" id="chartEmpty"[^>]*style="display:\s*none/);

  // Accessible live status element
  assert.match(html, /id="dashStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible form controls and containers
  assert.match(html, /id="ta"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="tiles"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="chart"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="reportPanel"[^>]*aria-labelledby="repTitle"[^>]*aria-live="polite"/);

  // Dynamic a11y attributes on generated tiles
  assert.match(html, /el\.setAttribute\("role",\s*"img"\)/);
  assert.match(html, /el\.setAttribute\("aria-label",\s*"מקום "\s*\+\s*\(i\s*\+\s*1\)\s*\+\s*": "\s*\+\s*\(free\s*\?\s*"פנוי"\s*:\s*"תפוס"\)\)/);

  // Guard report generation when no records loaded
  assert.match(html, /function makeReport\(\)\s*\{[\s\S]*?if\s*\(!RECORDS\.length\)\s*\{[\s\S]*?setStatus\("אין רשומות להפקת דוח עירוני\.",\s*true\);[\s\S]*?return;/);

  // render handles empty records state
  assert.match(html, /if\s*\(!RECORDS\.length\)\s*\{[\s\S]*?if\(tilesEmpty\)\s*tilesEmpty\.style\.display\s*=\s*"block";[\s\S]*?if\(chartEmpty\)\s*chartEmpty\.style\.display\s*=\s*"block";/);
});
