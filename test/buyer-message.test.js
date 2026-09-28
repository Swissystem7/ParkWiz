const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('CUT: the shared nav no longer sells a marketplace or a duplicate dashboard', () => {
  delete require.cache[require.resolve('../src/lib/surface-nav.js')];
  require('../src/lib/surface-nav.js');
  const ids = globalThis.ParkWizSurfaceNav.LINKS.map((l) => l.id);
  assert.ok(!ids.includes('market'), 'marketplace contradicts the municipal PIVOT');
  assert.ok(!ids.includes('dash'), 'dashboard duplicates the pilot report');
  for (const keep of ['map', 'brief', 'offer', 'kit', 'compare', 'report', 'privacy']) assert.ok(ids.includes(keep), keep);
  // the pages themselves stay (code is not deleted), only the message changes
  assert.ok(fs.existsSync(path.join(root, 'marketplace.html')));
  assert.ok(fs.existsSync(path.join(root, 'pilot-dashboard.html')));
});

test('CUT: the map hides the consumer demo (Premium, XP, sign-up, fake vendor events, rentals) unless asked', () => {
  const html = read('index.html');
  assert.match(html, /body:not\(\.consumer-demo-on\) \[data-consumer-demo\]\{display:none!important\}/);
  const tagged = [
    /<button class="btn btn-ghost" data-consumer-demo onclick="liveParkingEvent\(\)"/,
    /<button class="premium-btn" data-consumer-demo /,
    /<div class="pw-auth-area" data-consumer-demo id="pwAuthArea">/,
    /<span class="free-pill" data-consumer-demo id="planPill">/,
    /<div class="game-panel" data-consumer-demo id="gamePanel">/,
    /<div class="live-feed" data-consumer-demo>\s*<div class="feed-title"><span class="live-dot"/,
    /<div class="live-feed" data-consumer-demo style="border-color:rgba\(168,85,247/,
    /<div class="live-feed" data-consumer-demo style="border-color:rgba\(56,189,248/,
    /<div class="wa-banner" data-consumer-demo id="waBanner">/,
  ];
  for (const re of tagged) assert.match(html, re);
  // an explicit, labeled way back to the driver demo
  assert.match(html, /id="pwConsumerToggle"[^>]*aria-pressed="false"[^>]*>[^<]*דמו הנהגים/);
  // the consumer onboarding (XP, Premium) only runs in the driver demo
  assert.match(html, /if \(document\.body\.classList\.contains\('consumer-demo-on'\) && !localStorage\.getItem\('parkwiz_onboarded'\)\)/);
});
