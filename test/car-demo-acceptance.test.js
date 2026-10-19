// The #267 acceptance criterion is a behaviour, not a string: "a simulated EV
// receives a freed spot within ~2s". Regex tests over the markup cannot prove
// that, so this test boots demo/car-demo.html's own inline script against a
// minimal fake DOM, clicks the real buttons, and measures the real elapsed
// time with the page's real setTimeout. A page that wires the relay up wrongly
// — wrong subscriber radius, echo back to the publisher, a crash in the offer
// handler — fails here rather than in front of an owner.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const carApi = require('../src/lib/car-api');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'car-demo.html'), 'utf8');
const mainScript = [...html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/gi)].map((m) => m[1])[0];

function fakeElement(tag) {
  const listeners = {};
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attrs: {},
    dataset: {},
    style: {},
    className: '',
    textContent: '',
    value: '',
    disabled: false,
    type: '',
    appendChild(child) { el.children.push(child); return child; },
    replaceChildren() { el.children = []; },
    setAttribute(name, value) { el.attrs[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type) { (listeners[type] || []).forEach((fn) => fn({ type })); },
  };
  return el;
}

// Ids the page reads with getElementById, plus the slider's initial value and
// the two aria-pressed buttons, taken from the markup so the harness cannot
// drift from the page it is testing.
function bootPage() {
  const byId = new Map();
  for (const m of html.matchAll(/id="([A-Za-z][\w-]*)"/g)) {
    if (!byId.has(m[1])) byId.set(m[1], fakeElement('div'));
  }
  byId.get('batterySlider').value = html.match(/id="batterySlider"[\s\S]*?value="(\d+)"/)[1];
  byId.get('btnSubscribe').setAttribute('aria-pressed', 'false');
  byId.get('btnClaim').disabled = true;
  byId.get('btnRelease').disabled = true;
  // The status regions ship with their default copy in the markup, and the
  // page is entitled to leave it there, so the harness has to start with it.
  for (const id of ['evStatus', 'leavingStatus', 'ocppStatus', 'eventLogEmpty', 'kpiLatency']) {
    const m = html.match(new RegExp('id="' + id + '"[^>]*>([^<]*)'));
    byId.get(id).textContent = m ? m[1].trim() : '';
  }

  const ctx = {
    document: {
      getElementById: (id) => byId.get(id) || null,
      createElement: fakeElement,
      addEventListener() {},
    },
    navigator: {},
    console,
  };
  ctx.window = ctx;
  ctx.ParkWizCarApi = carApi;
  // Real timers on purpose: the page's simulated uplink has to be measured,
  // not stubbed away to zero.
  ctx.setTimeout = setTimeout;
  ctx.clearTimeout = clearTimeout;
  ctx.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(mainScript, ctx);
  return byId;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('a subscribed simulated EV is offered a freed spot well inside 2 seconds', async () => {
  const byId = bootPage();
  const target = Number(html.match(/const LATENCY_TARGET_MS = (\d+);/)[1]);
  const delay = Number(html.match(/const RADIO_DELAY_MS = (\d+);/)[1]);

  byId.get('btnSubscribe').fire('click');
  assert.equal(byId.get('btnSubscribe').getAttribute('aria-pressed'), 'true');

  const leavingButtons = byId.get('leavingBtns').children;
  assert.ok(leavingButtons.length >= 3, 'the departing car needs street and charger bays');
  const started = Date.now();
  leavingButtons[0].fire('click');
  await wait(delay + 300);

  const status = byId.get('evStatus').textContent;
  assert.match(status, /התקבל spot-freed/, 'the EV must be told a spot freed up: ' + status);
  assert.match(status, /בתוך היעד של 2 שניות/, status);
  const reported = Number((status.match(/(\d+) ms/) || [])[1]);
  assert.ok(Number.isFinite(reported), 'the page must report a measured latency: ' + status);
  assert.ok(reported <= target, 'reported ' + reported + 'ms, target ' + target + 'ms');
  assert.ok(Date.now() - started <= target, 'wall-clock delivery blew the 2s budget');
  assert.equal(byId.get('kpiLatency').textContent, reported + ' ms');
  assert.equal(byId.get('kpiDelivered').textContent, 1);
  assert.equal(byId.get('kpiRejected').textContent, 0);
  // Only one spot is known free, so it is offered as the nearest one — the car
  // is never sent to a charger bay it has no reason to believe is open.
  assert.match(byId.get('eventLog').textContent, /"reasonKey": "nearest"/);

  // Now a charger bay frees up too. It is the further bay, and the demo opens
  // on a low battery, so the offer has to switch to it — the whole point of
  // the EV path.
  leavingButtons[2].fire('click');
  await wait(delay + 300);
  assert.match(byId.get('evStatus').textContent, /תא טעינה/, byId.get('evStatus').textContent);
  assert.match(byId.get('evStatus').textContent, /מתחת לרף 25%/);
  assert.match(byId.get('eventLog').textContent, /"reasonKey": "charger-low-battery"/);
  assert.equal(byId.get('kpiDelivered').textContent, 2);

  // Claim then release, the way a driver who changes their mind would.
  assert.equal(byId.get('btnClaim').disabled, false);
  byId.get('btnClaim').fire('click');
  assert.match(byId.get('evStatus').textContent, /spot-claim/);
  assert.equal(byId.get('btnRelease').disabled, false);
  byId.get('btnRelease').fire('click');
  assert.match(byId.get('evStatus').textContent, /spot-release/);
});

test('an unsubscribed EV hears nothing, and nothing is silently lost', async () => {
  const byId = bootPage();
  const delay = Number(html.match(/const RADIO_DELAY_MS = (\d+);/)[1]);
  byId.get('leavingBtns').children[0].fire('click');
  await wait(delay + 150);
  assert.match(byId.get('leavingStatus').textContent, /אין רכב מנוי בטווח/);
  assert.equal(byId.get('evStatus').textContent, 'הרכב לא מנוי — אירוע שיפורסם עכשיו לא יימסר.');
  assert.equal(byId.get('kpiPublished').textContent, 1);
  assert.equal(byId.get('kpiDelivered').textContent, 0);
});

test('a departing car carrying a plate still frees the spot, minus the plate', async () => {
  const byId = bootPage();
  const delay = Number(html.match(/const RADIO_DELAY_MS = (\d+);/)[1]);
  byId.get('btnSubscribe').fire('click');
  byId.get('btnPlateProbe').fire('click');
  assert.match(byId.get('leavingStatus').textContent, /הוסרו מהאירוע לפני שהוא יצא לממסר/);
  assert.match(byId.get('leavingStatus').textContent, /plate/);
  await wait(delay + 300);
  assert.match(byId.get('evStatus').textContent, /התקבל spot-freed/);
  const log = byId.get('eventLog').textContent;
  assert.doesNotMatch(log, /12-345-67|WVWZZZ/, 'no plate or VIN may reach the relay log');
  assert.equal(byId.get('kpiDelivered').textContent, 1);
});

test('an OCPP charger going Available reaches the subscribed EV, Charging does not', async () => {
  const byId = bootPage();
  const delay = Number(html.match(/const RADIO_DELAY_MS = (\d+);/)[1]);
  byId.get('btnSubscribe').fire('click');
  const ocppButtons = byId.get('ocppBtns').children;
  assert.ok(ocppButtons.length >= 2, 'the simulator needs at least two chargers');

  // First tick leaves CP-01 on Preparing — nothing to announce.
  ocppButtons[0].fire('click');
  assert.match(byId.get('ocppStatus').textContent, /אין מה לפרסם/);
  await wait(delay + 150);
  assert.equal(byId.get('kpiDelivered').textContent, 0);

  // Walk it round to Available; that is the one transition that publishes.
  for (let i = 0; i < 3; i++) ocppButtons[0].fire('click');
  assert.match(byId.get('ocppStatus').textContent, /מפרסם spot-freed/);
  await wait(delay + 300);
  assert.equal(byId.get('kpiDelivered').textContent, 1);
  assert.match(byId.get('evStatus').textContent, /התקבל spot-freed/);
  assert.match(byId.get('eventLog').textContent, /"readOnly": true/);
});

test('reset puts the simulator back to an empty, unsubscribed state', async () => {
  const byId = bootPage();
  const delay = Number(html.match(/const RADIO_DELAY_MS = (\d+);/)[1]);
  byId.get('btnSubscribe').fire('click');
  byId.get('leavingBtns').children[0].fire('click');
  await wait(delay + 300);
  assert.equal(byId.get('kpiDelivered').textContent, 1);

  byId.get('btnReset').fire('click');
  assert.equal(byId.get('kpiLatency').textContent, '—');
  assert.equal(byId.get('kpiPublished').textContent, 0);
  assert.equal(byId.get('kpiDelivered').textContent, 0);
  assert.equal(byId.get('eventLog').textContent, '');
  assert.equal(byId.get('eventLogEmpty').style.display, 'block');
  assert.equal(byId.get('btnSubscribe').getAttribute('aria-pressed'), 'false');
  assert.equal(byId.get('btnClaim').disabled, true);
});
