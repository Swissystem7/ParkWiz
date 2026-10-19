// Runs demo/atidim.html's inline script against a stub DOM and a stub 2D
// context. A parse test (atidim-demo-page.test.js) cannot catch a bad element
// id, a renamed model export or a canvas call that throws — and at this demo's
// stage a blank frame in front of the operator is the whole failure mode.
// The stub context deliberately omits roundRect, so the fallback path runs.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');

function inlineScript() {
  const m = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(m, 'demo page must have an inline script');
  return m[1];
}

// Ids and classes the script reaches for must exist in the markup; the stub
// hands back an element only for those, so a typo surfaces as a thrown error.
function markupIds() {
  return new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
}

function makeElement(id) {
  const el = {
    id,
    style: {},
    attributes: {},
    children: [],
    hidden: false,
    className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return name === 'data-cam' ? this.dataCam : this.attributes[name]; },
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    handlers: {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    appendChild(child) { el.children.push(child); return child; },
  };
  let text = '';
  // Assigning textContent drops the existing children, as a real DOM does.
  // The agents panel relies on exactly that to clear itself before re-render.
  Object.defineProperty(el, 'textContent', {
    get() { return text; },
    set(value) { text = String(value); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

// Flattened visible text of an element and everything appended under it.
function textOf(node) {
  if (!node) return '';
  if (typeof node.nodeText === 'string') return node.nodeText;
  return (node.textContent || '') + (node.children || []).map(textOf).join('');
}

// Every <a> appended anywhere under an element.
function linksIn(node) {
  if (!node || typeof node.nodeText === 'string') return [];
  const here = node.tagName === 'A' ? [node] : [];
  return here.concat(...(node.children || []).map(linksIn));
}

function makeContext(calls) {
  const noop = () => { calls.push('op'); };
  return {
    // roundRect is intentionally absent (Safari < 16 behaviour).
    clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, fill: noop, stroke: noop,
    setLineDash: noop, fillText: noop,
    createLinearGradient() { return { addColorStop() {} }; },
  };
}

function runPage() {
  const ids = markupIds();
  const elements = new Map();
  const ctxCalls = [];
  const timers = [];

  const canvas = makeElement('lotCanvas');
  canvas.width = 960;
  canvas.height = 540;
  canvas.getContext = () => makeContext(ctxCalls);
  elements.set('lotCanvas', canvas);

  const camButtons = ['cam-01', 'cam-02', 'cam-03'].map((cam) => {
    const btn = makeElement('cam-sel');
    btn.dataCam = cam;
    btn.textContent = cam;
    return btn;
  });

  const document = {
    getElementById(id) {
      assert.ok(ids.has(id), 'script asks for #' + id + ' which is not in the markup');
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelectorAll(sel) {
      assert.equal(sel, '.cam-sel', 'unexpected selector: ' + sel);
      return camButtons;
    },
    createElement(tag) {
      const el = makeElement(tag);
      el.tagName = String(tag).toUpperCase();
      return el;
    },
    createTextNode(value) { return { nodeText: String(value) }; },
  };

  const sandbox = {
    // The agent modules are loaded the way the page's <script src> tags load
    // them, so the panel below runs its real rendering path rather than the
    // "libs missing" fallback (#269 acceptance: no console errors).
    window: {
      ParkWizAtidimLot: require('../src/lib/atidim-lot'),
      ParkWizAgentBus: require('../src/agents/bus'),
      ParkWizAgentRuntime: require('../src/agents/runtime'),
      ParkWizDriverAgent: require('../src/agents/driver'),
      ParkWizManagerAgent: require('../src/agents/manager'),
    },
    document,
    navigator: {},
    location: { protocol: 'file:' },
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    clearInterval: () => {},
    Math, Date, Number, String, Object, Array, Boolean, JSON, Intl, isNaN,
  };
  vm.createContext(sandbox);
  new vm.Script(inlineScript()).runInContext(sandbox);
  return { elements, camButtons, canvas, ctxCalls, timers, document };
}

test('demo page boots: counters, chart and frame all render without throwing', () => {
  const page = runPage();
  const available = Number(page.elements.get('kpiAvailable').textContent);
  const occupied = Number(page.elements.get('kpiOccupied').textContent);
  assert.ok(Number.isInteger(available) && Number.isInteger(occupied));
  assert.equal(available + occupied, 220, 'free + occupied must equal lot capacity');
  assert.match(page.elements.get('kpiRate').textContent, /^\d{1,3}%$/);
  assert.match(page.elements.get('kpiCameraView').textContent, /^\d+ \/ \d+$/);
  assert.ok(page.elements.get('kpiStatus').textContent.length > 0);
  assert.match(page.elements.get('frameClock').textContent, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  // The chart is built as SVG markup with one bar per hour.
  const chart = page.elements.get('hourlyChart').innerHTML;
  assert.equal([...chart.matchAll(/<rect /g)].length, 24);
  assert.match(page.elements.get('chartNow').textContent, /השעה הנוכחית/);
  assert.match(page.elements.get('chartPeak').textContent, /שעות שיא/);
  // The frame actually drew, through the roundRect fallback.
  assert.ok(page.ctxCalls.length > 100, 'canvas draw produced no operations');
});

test('clicking a stall flips it and moves the live counters', () => {
  const page = runPage();
  const before = Number(page.elements.get('kpiOccupied').textContent);
  const click = page.canvas.handlers.click[0];
  // Centre of the first stall: cam-01 starts at x=0.06, y=0.30 of the frame.
  click({ clientX: 960 * 0.08, clientY: 540 * 0.35 });
  const after = Number(page.elements.get('kpiOccupied').textContent);
  assert.notEqual(after, before, 'toggling a stall must change the lot reading');
  assert.match(page.elements.get('bayStatus').textContent, /תא A-\d+ סומן כ/);
});

test('keyboard navigation walks stalls and toggles with space', () => {
  const page = runPage();
  const keydown = page.canvas.handlers.keydown[0];
  let prevented = 0;
  const key = (k) => keydown({ key: k, preventDefault: () => { prevented++; } });
  // The first arrow press just lands on stall 1; after that the step applies.
  key('ArrowDown');
  assert.match(page.elements.get('bayStatus').textContent, /^תא A-01 · (תפוס|פנוי)$/);
  // cam-01 is 2 rows x 12 cols, so ArrowDown moves a whole row, and ArrowRight
  // advances one stall to the right in the unmirrored bitmap.
  key('ArrowDown');
  assert.match(page.elements.get('bayStatus').textContent, /^תא A-13 /);
  key('ArrowRight');
  assert.match(page.elements.get('bayStatus').textContent, /^תא A-14 /);
  key('ArrowLeft');
  assert.match(page.elements.get('bayStatus').textContent, /^תא A-13 /);
  const before = Number(page.elements.get('kpiOccupied').textContent);
  key(' ');
  assert.notEqual(Number(page.elements.get('kpiOccupied').textContent), before);
  assert.equal(prevented, 5, 'every arrow and space press must not scroll the page');
});

test('switching cameras redraws a different zone with its own stall count', () => {
  const page = runPage();
  const perFrame = page.camButtons.map((btn) => {
    btn.handlers.click[0].call(btn);
    return page.elements.get('kpiCameraView').textContent.split(' / ')[1];
  });
  assert.deepEqual(perFrame, ['24', '30', '26'], 'each camera monitors its own stall count');
  assert.match(page.elements.get('camDesc').textContent, /מתחם עתידים 7/);
  assert.match(page.elements.get('hudCam').textContent, /CAM-03/);
});

test('reset returns the frame to the modelled state for the current hour', () => {
  const page = runPage();
  const seeded = page.elements.get('kpiOccupied').textContent;
  page.canvas.handlers.click[0]({ clientX: 960 * 0.08, clientY: 540 * 0.35 });
  assert.notEqual(page.elements.get('kpiOccupied').textContent, seeded);
  page.elements.get('btnReset').handlers.click[0].call(page.elements.get('btnReset'));
  assert.equal(page.elements.get('kpiOccupied').textContent, seeded);
  assert.match(page.elements.get('bayStatus').textContent, /אופס למצב האופייני לשעה \d{2}:00/);
});

// ---- the agents panel (#269), driven through the page's own handlers --------

function clickOn(page, id) {
  const el = page.elements.get(id);
  assert.ok(el && el.handlers.click, '#' + id + ' has no click handler');
  el.handlers.click[0].call(el);
  return el;
}

const logLines = (page) => page.elements.get('agentLog').children.map(textOf);

test('the agents panel boots with both agents on and an empty action log', () => {
  const page = runPage();
  const toggles = page.elements.get('agentToggles').children;
  assert.deepEqual(toggles.map((b) => b.textContent), ['סוכן נהג — פעיל', 'סוכן מנהל חניון — פעיל']);
  assert.deepEqual(toggles.map((b) => b.attributes['aria-pressed']), ['true', 'true']);
  assert.deepEqual(toggles.map((b) => b.attributes['data-agent']), ['driver', 'manager']);
  assert.match(textOf(page.elements.get('agentDriverSummary')), /^סוכן נהג: אין נהג ממתין$/);
  assert.match(textOf(page.elements.get('agentManagerSummary')), /סיכום יומי — חניון פארק עתידים/);
  assert.equal(page.elements.get('agentLog').children.length, 0);
  assert.equal(page.elements.get('agentLogEmpty').hidden, false);
});

// This is the acceptance run of #269 on the page itself: a waiting driver, a
// stall freed in the frame, an alert with a working Waze link.
test('acceptance: a waiting driver is alerted with a Waze link when a stall frees', () => {
  const page = runPage();
  const waitBtn = clickOn(page, 'btnDriverWaiting');
  assert.equal(waitBtn.attributes['aria-pressed'], 'true');
  assert.match(page.elements.get('bayStatus').textContent, /נהג ממתין נרשם/);

  clickOn(page, 'btnLeave');

  const lines = logLines(page);
  assert.ok(lines.some((line) => /התפנה תא [A-C]-\d+ · \d+ מ׳ הליכה/.test(line)),
    'expected a driver alert in the log: ' + lines.join(' | '));
  assert.ok(lines.some((line) => /^סוכן נהג · \d{2}:\d{2}:\d{2} —/.test(line)));
  assert.equal(page.elements.get('agentLogEmpty').hidden, true);

  const summary = page.elements.get('agentDriverSummary');
  assert.match(textOf(summary), /שמור כרגע: תא [A-C]-\d+ · 1 התראות נשלחו/);
  const links = linksIn(summary);
  assert.equal(links.length, 1, 'the held stall should offer exactly one Waze link');
  assert.match(links[0].href, /^https:\/\/waze\.com\/ul\?q=/);
  assert.equal(links[0].rel, 'noopener');
  assert.match(links[0].textContent, /Waze/);
});

test('acceptance: the manager summary counts the alert the driver agent sent', () => {
  const page = runPage();
  clickOn(page, 'btnDriverWaiting');
  clickOn(page, 'btnLeave');
  const summary = textOf(page.elements.get('agentManagerSummary'));
  assert.match(summary, /^סוכן מנהל חניון: סיכום יומי — חניון פארק עתידים/);
  assert.match(summary, /שיא תפוסה \d{1,3}% ב-\d{2}:00/);
  assert.match(summary, /1 התראות נשלחו לנהגים/);
  assert.match(summary, /~7 דק׳ חיפוש נחסכו \(הנחת דמו: 7 דק׳ להתראה\)/);
});

test('switching the driver agent off silences it and leaves the manager running', () => {
  const page = runPage();
  clickOn(page, 'btnDriverWaiting');
  const [driverToggle] = page.elements.get('agentToggles').children;
  driverToggle.handlers.click[0].call(driverToggle);
  assert.equal(driverToggle.attributes['aria-pressed'], 'false');
  assert.equal(driverToggle.textContent, 'סוכן נהג — כבוי');
  assert.match(page.elements.get('bayStatus').textContent, /סוכן נהג כובה/);

  clickOn(page, 'btnLeave');
  assert.ok(!logLines(page).some((line) => /התפנה תא/.test(line)), 'a disabled agent must not alert');
  assert.match(textOf(page.elements.get('agentDriverSummary')), /כבוי — לא מקבל אירועים/);
  assert.match(textOf(page.elements.get('agentManagerSummary')), /מדידות תפוסה/);
});

test('ending the simulated driver releases the hold and drops the Waze link', () => {
  const page = runPage();
  const waitBtn = clickOn(page, 'btnDriverWaiting');
  clickOn(page, 'btnLeave');
  waitBtn.handlers.click[0].call(waitBtn);

  assert.equal(waitBtn.attributes['aria-pressed'], 'false');
  const summary = page.elements.get('agentDriverSummary');
  assert.match(textOf(summary), /אין נהג ממתין/);
  assert.equal(linksIn(summary).length, 0, 'no hold means no navigate link');
  assert.ok(logLines(page).some((line) => /שחרור שמירה על תא .+הנהג סיים את החיפוש/.test(line)),
    logLines(page).join(' | '));
});

test('resetting the frame does not fake 24 arrivals at the agents', () => {
  const page = runPage();
  clickOn(page, 'btnDriverWaiting');
  clickOn(page, 'btnReset');
  assert.deepEqual(logLines(page), [], 'a frame reset must not publish stall events');
});

test('the page clock ticks the agents without throwing', () => {
  const page = runPage();
  clickOn(page, 'btnDriverWaiting');
  clickOn(page, 'btnLeave');
  assert.doesNotThrow(() => page.timers.forEach((fn) => fn()));
  // The hold runs for 90s, so a tick a moment later must not have dropped it.
  assert.match(textOf(page.elements.get('agentDriverSummary')), /שמור כרגע: תא/);
});

test('the clock tick keeps the frame timestamp fresh', () => {
  const page = runPage();
  assert.ok(page.timers.length >= 1, 'page must schedule a clock tick');
  page.elements.get('frameClock').textContent = '';
  page.timers.forEach((fn) => fn());
  assert.match(page.elements.get('frameClock').textContent, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});
