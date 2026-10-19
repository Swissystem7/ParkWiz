// Spot-freed events (#263). Two layers are covered here: the pure diff/feed/
// fan-out library, and demo/atidim.html actually wiring it up — a library that
// emits a perfect event helps nobody if the page never calls it, and the whole
// point of this feature is that a driver is told the moment a stall opens.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SE = require('../src/lib/spot-events');
const lotModel = require('../src/lib/atidim-lot');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');

const spotsOf = (...flags) => flags.map((occupied, i) => ({ id: 'A-0' + (i + 1), occupied }));

test('detectFreed reports only occupied -> free, matched by stall id', () => {
  const before = spotsOf(true, true, false);
  const after = spotsOf(false, true, true);
  const freed = SE.detectFreed(before, after, { lot: 'atidim', at: '2026-10-19T09:30:00.000Z' });
  assert.equal(freed.length, 1, 'an arrival is not a freeing');
  assert.deepEqual(freed[0], {
    lot: 'atidim',
    spotId: 'A-01',
    freedAt: '2026-10-19T09:30:00.000Z',
    // One stall is free in `after`, and the count must describe that snapshot.
    freeCount: 1,
  });
  // The event carries nothing a camera must never collect.
  assert.equal(lotModel.validatePrivacyCompliance(freed[0]).valid, true);
});

test('a camera switch swaps every stall id and must raise no events', () => {
  // Diffing by position would report all 26 stalls of the new zone as freed.
  const before = [{ id: 'A-01', occupied: true }, { id: 'A-02', occupied: true }];
  const after = [{ id: 'B-01', occupied: false }, { id: 'B-02', occupied: false }];
  assert.deepEqual(SE.detectFreed(before, after, { lot: 'atidim' }), []);
  // Nor may junk input throw on a page that is mid-boot.
  assert.deepEqual(SE.detectFreed(null, undefined, {}), []);
  assert.deepEqual(SE.detectFreed([], spotsOf(false)), []);
  // A freeing with no `at` is stamped now, not left undefined.
  assert.match(SE.detectFreed(spotsOf(true), spotsOf(false))[0].freedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('the feed keeps the last 20 events, newest first', () => {
  const feed = SE.createFeed(SE.FEED_LIMIT);
  assert.equal(SE.FEED_LIMIT, 20);
  for (let i = 1; i <= 25; i++) feed.push({ lot: 'atidim', spotId: 'A-' + i, freedAt: '', freeCount: i });
  const list = feed.list();
  assert.equal(list.length, 20);
  assert.equal(list[0].spotId, 'A-25', 'newest event belongs at the top');
  assert.equal(list[19].spotId, 'A-6', 'the oldest six must have aged out');
  feed.push(null);
  assert.equal(feed.size(), 20);
  feed.clear();
  assert.equal(feed.size(), 0);
});

test('publish reaches this page and other tabs, and neither can block the other', () => {
  const seen = [];
  const posted = [];
  const scope = {
    CustomEvent: function (type, init) { this.type = type; this.detail = init.detail; },
    dispatchEvent(e) { seen.push(e); return true; },
  };
  const channel = { postMessage(msg) { posted.push(msg); } };
  const ev = { lot: 'atidim', spotId: 'A-03', freedAt: 'now', freeCount: 2 };
  assert.deepEqual(SE.publish(ev, { scope, channel }), { dispatched: true, broadcast: true });
  assert.equal(seen[0].type, 'parkwiz:spot-freed');
  assert.deepEqual(seen[0].detail, ev);
  assert.deepEqual(posted[0], { type: 'parkwiz:spot-freed', event: ev });

  // A listener that throws must not cost the other tabs their message.
  const angry = Object.assign({}, scope, { dispatchEvent() { throw new Error('listener blew up'); } });
  assert.deepEqual(SE.publish(ev, { scope: angry, channel }), { dispatched: false, broadcast: true });
  assert.equal(posted.length, 2);
  // No DOM and no channel is a valid environment, not a crash.
  assert.deepEqual(SE.publish(ev, { scope: {} }), { dispatched: false, broadcast: false });
  assert.deepEqual(SE.publish(null, { scope, channel }), { dispatched: false, broadcast: false });
});

test('notify never prompts and only fires once permission is granted', () => {
  const shown = [];
  function Ctor(title, opts) { shown.push({ title, opts }); }
  const ev = { lot: 'atidim', spotId: 'A-03', freedAt: 'now', freeCount: 2 };
  assert.equal(SE.notify(ev, { scope: {} }), 'unsupported');
  Ctor.permission = 'default';
  assert.equal(SE.notify(ev, { scope: { Notification: Ctor } }), 'default');
  Ctor.permission = 'denied';
  assert.equal(SE.notify(ev, { scope: { Notification: Ctor } }), 'denied');
  Ctor.permission = 'granted';
  assert.equal(SE.notify(ev, { scope: { Notification: Ctor }, timeLabel: '09:30:00' }), 'shown');
  assert.equal(shown.length, 1, 'no notification may be raised before permission is granted');
  assert.equal(shown[0].title, 'מקום התפנה!');
  assert.equal(shown[0].opts.body, 'תא A-03 התפנה · 2 פנויים בפריים · 09:30:00');
  // With no caller-supplied label the body still carries a clock, never
  // "undefined" — and an unparseable stamp degrades to a placeholder.
  assert.match(SE.describeHe({ spotId: 'A-03', freedAt: '2026-10-19T06:30:00.000Z', freeCount: 2 }),
    /· \d{2}:\d{2}:\d{2}$/);
  assert.match(SE.describeHe(ev), /· --:--:--$/);
  assert.equal(SE.describeHe(null), '');
  // Re-freeing the same stall replaces its banner rather than stacking one.
  assert.equal(shown[0].opts.tag, 'parkwiz:spot-freed:A-03');
  assert.equal(Object.keys(shown[0].opts).join(','), 'body,tag', 'the payload stays PII-free');
});

// --- demo/atidim.html ------------------------------------------------------

function makeElement(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
    hidden: undefined,
    style: {},
    attributes: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return name === 'data-cam' ? this.dataCam : this.attributes[name]; },
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    handlers: {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
  };
}

function runPage(options) {
  const opts = options || {};
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const inline = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/i.exec(html)[1];
  const elements = new Map();
  const ctxCalls = [];
  const timers = [];
  const dispatched = [];
  const posted = [];
  const notifications = [];
  const clock = { t: Date.parse('2026-10-19T09:30:00.000Z') };

  const noop = () => { ctxCalls.push('op'); };
  const canvas = makeElement('lotCanvas');
  canvas.width = 960;
  canvas.height = 540;
  canvas.getContext = () => ({
    clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, fill: noop, stroke: noop,
    setLineDash: noop, fillText: noop, roundRect: noop,
    createLinearGradient() { return { addColorStop() {} }; },
  });
  elements.set('lotCanvas', canvas);

  const channel = { name: null, onmessage: null, postMessage(msg) { posted.push(msg); } };
  function Notification(title, init) { notifications.push({ title, init }); }
  Notification.permission = opts.permission || 'default';
  Notification.requestPermission = () => {
    Notification.permission = 'granted';
    return { then(fn) { fn(Notification.permission); return { catch() {} }; } };
  };

  // A Date whose "now" the test can move, so the toast and the map ring can be
  // expired on the page's own clock tick instead of by sleeping.
  const FakeDate = function (...args) { return args.length ? new Date(...args) : new Date(clock.t); };
  FakeDate.now = () => clock.t;
  FakeDate.prototype = Date.prototype;

  const sandbox = {
    window: {
      ParkWizAtidimLot: lotModel,
      ParkWizSpotEvents: opts.noEventsLib ? undefined : SE,
      CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
      dispatchEvent(e) { dispatched.push(e); return true; },
      BroadcastChannel: function (name) { channel.name = name; return channel; },
      Notification: opts.noNotifications ? undefined : Notification,
    },
    document: {
      getElementById(id) {
        assert.ok(ids.has(id), 'script asks for #' + id + ' which is not in the markup');
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
      },
      querySelectorAll() { return []; },
    },
    navigator: {},
    location: { protocol: 'file:' },
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    clearInterval: () => {},
    Math, Date: FakeDate, Number, String, Object, Array, Boolean, JSON, Intl, isNaN,
  };
  vm.createContext(sandbox);
  new vm.Script(inline).runInContext(sandbox);
  const el = (id) => elements.get(id) || sandbox.document.getElementById(id);
  const click = (id) => el(id).handlers.click[0].call(el(id));
  return { el, click, ctxCalls, timers, dispatched, posted, notifications, channel, clock, Notification };
}

test('the page boots with an empty, clearly-labelled feed and no toast', () => {
  const page = runPage();
  assert.match(page.el('freedFeed').innerHTML, /עדיין לא התפנה תא בפריים/);
  assert.equal(page.el('freedToast').hidden, undefined, 'the toast must not be shown before an event');
  assert.match(page.el('notifyState').textContent, /התראות דפדפן כבויות/);
  assert.equal(page.channel.name, 'parkwiz', 'the page must open the shared parkwiz channel');
});

test('freeing a stall raises the toast, the feed entry, the event and the notification', () => {
  const page = runPage({ permission: 'granted' });
  page.click('btnLeave');

  assert.equal(page.el('freedToast').hidden, false);
  assert.match(page.el('freedToast').textContent, /^מקום התפנה! תא [A-C]-\d+ · \d+ פנויים בפריים \(הדגמה\)$/);

  const feedHtml = page.el('freedFeed').innerHTML;
  assert.equal([...feedHtml.matchAll(/<li>/g)].length, 1);
  assert.match(feedHtml, /<span class="sid">[A-C]-\d+<\/span> התפנה · \d+ פנויים בפריים/);
  // Simulated data must say so, and carry the lot's own wall clock.
  assert.match(feedHtml, /\d{2}:\d{2}:\d{2} · atidim · הדמיה/);

  assert.equal(page.dispatched.length, 1, 'other code on this page subscribes to the CustomEvent');
  assert.equal(page.dispatched[0].type, 'parkwiz:spot-freed');
  const ev = page.dispatched[0].detail;
  assert.deepEqual(Object.keys(ev).sort(), ['freeCount', 'freedAt', 'lot', 'spotId']);
  assert.equal(ev.lot, 'atidim');

  assert.deepEqual(page.posted[0], { type: 'parkwiz:spot-freed', event: ev });
  assert.equal(page.notifications.length, 1);
  assert.equal(page.notifications[0].title, 'מקום התפנה!');

  // A car arriving is not a freeing: no second event, no second feed row.
  page.click('btnArrive');
  assert.equal(page.dispatched.length, 1);
  assert.equal([...page.el('freedFeed').innerHTML.matchAll(/<li>/g)].length, 1);
});

test('the toast and the map ring expire on the clock tick the page already runs', () => {
  const page = runPage();
  page.click('btnLeave');
  assert.equal(page.el('freedToast').hidden, false);
  const drawnWhileFlashing = page.ctxCalls.length;
  page.timers.forEach((fn) => fn());
  assert.equal(page.el('freedToast').hidden, false, 'the toast must survive the next tick');
  // Past the flash window the ring is dropped and the frame is redrawn without it.
  page.clock.t += 7000;
  page.timers.forEach((fn) => fn());
  assert.equal(page.el('freedToast').hidden, true);
  assert.ok(page.ctxCalls.length > drawnWhileFlashing, 'clearing the ring must redraw the frame');
});

test('a freeing broadcast by another tab shows up in this one', () => {
  const page = runPage();
  const ev = { lot: 'atidim', spotId: 'Z-99', freedAt: '2026-10-19T09:30:00.000Z', freeCount: 7 };
  page.channel.onmessage({ data: { type: 'parkwiz:spot-freed', event: ev } });
  assert.match(page.el('freedFeed').innerHTML, /<span class="sid">Z-99<\/span> התפנה · 7 פנויים/);
  assert.match(page.el('freedToast').textContent, /תא Z-99/);
  // Relaying it back out would ping-pong between the two tabs forever.
  assert.equal(page.posted.length, 0);
  assert.equal(page.dispatched.length, 0);
  page.channel.onmessage({ data: { type: 'something-else' } });
  page.channel.onmessage({});
  // The feed renders with innerHTML, so a hostile stall id is dropped, not escaped.
  page.channel.onmessage({ data: { type: 'parkwiz:spot-freed', event: { lot: 'atidim', spotId: '<img src=x onerror=alert(1)>', freeCount: 1 } } });
  assert.equal([...page.el('freedFeed').innerHTML.matchAll(/<li>/g)].length, 1);
  assert.doesNotMatch(page.el('freedFeed').innerHTML, /onerror/);
});

test('fromMessage accepts only the spot-freed wire shape', () => {
  const ok = { type: 'parkwiz:spot-freed', event: { lot: 'atidim', spotId: 'A-01', freedAt: '2026-10-19T09:30:00.000Z', freeCount: 3 } };
  assert.deepEqual(SE.fromMessage(ok), ok.event);
  // A missing or unparseable stamp is replaced, never rendered as-is.
  assert.match(SE.fromMessage({ type: ok.type, event: { lot: 'a', spotId: 'A-01', freeCount: 0 } }).freedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(SE.fromMessage(null), null);
  assert.equal(SE.fromMessage({ type: 'parkwiz:other', event: ok.event }), null, 'the channel is shared');
  assert.equal(SE.fromMessage({ type: ok.type, event: { lot: 'a', spotId: 'A 01', freeCount: 1 } }), null);
  assert.equal(SE.fromMessage({ type: ok.type, event: { lot: '', spotId: 'A-01', freeCount: 1 } }), null);
  assert.equal(SE.fromMessage({ type: ok.type, event: { lot: 'a', spotId: 'A-01', freeCount: 'lots' } }), null);
});

test('permission is only ever requested from an explicit click', () => {
  const page = runPage();
  assert.equal(page.Notification.permission, 'default', 'booting the page must not prompt');
  page.click('btnLeave');
  assert.equal(page.notifications.length, 0, 'no banner before the driver opts in');
  page.click('btnNotify');
  assert.equal(page.Notification.permission, 'granted');
  assert.match(page.el('notifyState').textContent, /התראות דפדפן פעילות/);
  page.click('btnLeave');
  assert.equal(page.notifications.length, 1);
});

test('a browser with no Notification support still gets the toast and the feed', () => {
  const page = runPage({ noNotifications: true });
  assert.match(page.el('notifyState').textContent, /לא תומך בהתראות/);
  page.click('btnLeave');
  assert.equal(page.el('freedToast').hidden, false);
  assert.equal(page.dispatched.length, 1);
});

test('the page markup and the offline shell carry the feature', () => {
  assert.match(html, /<script src="\.\.\/src\/lib\/spot-events\.js"><\/script>/);
  assert.match(html, /id="freedFeed"[^>]*role="log"/);
  assert.match(html, /id="freedToast"[^>]*role="alert"/);
  assert.match(html, /פיד התפנויות/);
  assert.match(html, /נתוני הדגמה בלבד/);
  assert.match(html, /parkwiz:spot-freed/);
  // Cache-first shell: a page that pulls in a new library without listing it
  // loads the demo offline with a dead feed.
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/src\/lib\/spot-events\.js'/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 19);
});
