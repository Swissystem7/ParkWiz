// Buyer view (the default since 2d2ed99) credits no XP for an "אני עוזב"
// report (#113), and since #163/#164 neither do the scheduled report nor the
// countdown card. But finishNavigation — reachable from the street card's
// "התחל ניווט" button, which is not demo-gated — still did
// `userScore += 20; updateXP(20)` for everyone. In the buyer view the XP
// widget is display:none, so getBoundingClientRect() is all zeros and the
// "+20 XP" pop landed at the page corner next to a toast that promised no
// points. The navigation demo must follow the same driver-demo rule and go
// through creditXp like every other XP source.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function fnBody(name) {
  const i = html.indexOf(`function ${name}(`);
  assert.ok(i > 0, `${name} exists`);
  return html.slice(i, html.indexOf('\n}\n', i));
}

test('the navigation demo credits XP only inside the driver demo', () => {
  const body = fnBody('finishNavigation');
  assert.doesNotMatch(body, /userScore \+= 20/, 'no inline XP increment bypassing creditXp');
  assert.doesNotMatch(body, /^\s*updateXP\(/m, 'updateXP is not called unconditionally');
  assert.match(
    body,
    /if \(document\.body\.classList\.contains\('consumer-demo-on'\)\) creditXp\(20\)/,
    'the 20 XP goes through creditXp behind the driver-demo switch'
  );
});

test('the street card navigation button is reachable in the buyer view', () => {
  // The gate above matters only because the entry point is visible to buyers.
  const btn = html.split('\n').find((l) => l.includes('onclick="startNavigation()"'));
  assert.ok(btn, 'start-navigation button exists');
  assert.doesNotMatch(btn, /data-consumer-demo/, 'navigation is part of the buyer view, so the XP gate must live in finishNavigation');
});

test('creditXp stays the single XP entry point outside updateXP itself', () => {
  const others = html.split('\n').filter((l) => /^\s*userScore \+= /.test(l));
  assert.deepEqual(others.map((l) => l.trim()), ['userScore += amount;'], 'only creditXp mutates userScore');
});
