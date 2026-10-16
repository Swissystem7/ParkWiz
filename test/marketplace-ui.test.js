const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('marketplace page has accessible status regions, form labels, meter role, and reset button wiring', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'marketplace.html'), 'utf8');

  // Accessible live status regions for booking and host form results
  assert.match(html, /id="bookingResult"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="hostResult"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible spots region and dynamic spot booking labels
  assert.match(html, /id="spots"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /aria-label="שמירת המקום בדמו:\s*\$\{s\.name\}"/);

  // Visual meter has proper role and numeric range attributes
  assert.match(html, /class="meter"[^>]*role="meter"[^>]*aria-valuenow="58"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/);

  // Form controls have matching label for attributes
  assert.match(html, /<label for="spotType">/);
  assert.match(html, /<select id="spotType" name="spotType">/);
  assert.match(html, /<label for="address">/);
  assert.match(html, /<input id="address" name="address"/);
  assert.match(html, /<label for="hostPrice">/);
  assert.match(html, /<input id="hostPrice" name="hostPrice"/);
  assert.match(html, /<label class="check" for="attest"><input id="attest" name="attest"/);

  // Reset booking button is wired to restore initial state
  assert.match(html, /window\.resetBooking\s*=\s*\(\)\s*=>\s*\{/);
  assert.match(html, /resetBooking\(\)/);
  assert.match(html, /איפוס בחירה/);
});
