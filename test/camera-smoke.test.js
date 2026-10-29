// Runs demo/camera.html's inline script against a stub DOM, a stub 2D context
// and a fake cocoSsd, then drives a car into a dragged bay and out again. The
// parse test (camera-page-ui.test.js) proves the page is wired to the engine;
// this one proves the wiring moves the counters, fires exactly one
// parkwiz:spot-freed on the way out, renders both charts as real <svg>, and
// keeps the camera's tracks alive through start(). #264 slice 3.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'camera.html'), 'utf8');
const TFJS = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const COCO = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';

function inlineScript() {
  const m = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(m, 'camera page must have an inline script');
  return m[1];
}

const markupIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

function makeElement(id) {
  const classes = new Set();
  return {
    id,
    textContent: '',
    innerHTML: '',
    value: '',
    style: {},
    handlers: {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c) },
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    fire(type, ev) { (this.handlers[type] || []).forEach((fn) => fn(ev || {})); },
    removeAttribute() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    setPointerCapture() {},
  };
}

function makeContext(calls, canvas) {
  const op = (name) => () => { calls.push(name); };
  const buf = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  canvas._buf = buf;
  return {
    drawImage(src) {
      calls.push('drawImage');
      calls.push(canvas.id + ':draw:' + (src && src.id || 'source'));
      const n = canvas.width * canvas.height;
      if (src && src._buf) buf.set(src._buf.subarray(0, buf.length));
      else {
        for (let p = 0, i = 0; p < n; p++, i += 4) {
          buf[i] = (p * 7) % 256; buf[i + 1] = (p * 13) % 256; buf[i + 2] = (p * 29) % 256; buf[i + 3] = 255;
        }
      }
    },
    getImageData() { return { data: buf, width: canvas.width, height: canvas.height }; },
    putImageData(img) {
      calls.push('putImageData');
      calls.push(canvas.id + ':putImageData');
      if (img && img.data && img.data !== buf) buf.set(img.data.subarray(0, buf.length));
    },
    clearRect: op('clearRect'), fillRect: op('fillRect'),
    strokeRect: op('strokeRect'), fillText: op('fillText'), setLineDash: op('setLineDash'),
  };
}

function makeCanvas(id, calls) {
  const c = makeElement(id);
  c.width = 960;
  c.height = 540;
  c.getContext = () => c._ctx || (c._ctx = makeContext(calls, c));
  return c;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function settle() { for (let i = 0; i < 12; i++) await flush(); }

function runPage() {
  const elements = new Map();
  const ctxCalls = [];
  const events = [];
  const timers = [];
  const timeouts = [];
  const stopped = [];
  const loaded = [];
  const model = { detect: () => Promise.resolve([]) };
  let work = null;

  const canvas = makeCanvas('frame', ctxCalls);
  elements.set('frame', canvas);
  const video = makeElement('srcVideo');
  video.videoWidth = 960;
  video.videoHeight = 540;
  video.play = () => Promise.resolve();
  video.pause = () => {};
  elements.set('srcVideo', video);
  const image = makeElement('srcImage');
  image.naturalWidth = 960;
  image.naturalHeight = 540;
  elements.set('srcImage', image);

  const window = {
    ParkWizVisionOccupancy: require('../src/lib/vision-occupancy'),
    ParkWizOccupancy: require('../src/lib/occupancy'),
    ParkWizRedact: require('../src/lib/redact'),
    dispatchEvent(ev) { events.push(ev); return true; },
  };
  const document = {
    head: {
      appendChild(script) {
        loaded.push(script.src);
        if (script.src === COCO) window.cocoSsd = { load: () => Promise.resolve(model) };
        Promise.resolve().then(() => script.onload && script.onload());
      },
    },
    getElementById(id) {
      assert.ok(markupIds.has(id), 'script asks for #' + id + ' which is not in the markup');
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement(tag) {
      if (tag !== 'canvas') return { tag };
      work = makeCanvas('work', ctxCalls);
      return work;
    },
  };
  const stream = { getTracks: () => [{ stop() { stopped.push('track'); } }] };
  const sandbox = {
    window, document,
    navigator: { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } },
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    clearInterval: () => {},
    setTimeout: (fn) => { timeouts.push(fn); return timeouts.length; },
    clearTimeout: () => {},
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    URL: { createObjectURL: () => 'blob:fake' },
    Promise, Error, Date, Math, Number, String, Object, Array, Boolean, JSON, console,
  };
  vm.createContext(sandbox);
  new vm.Script(inlineScript(), { filename: 'demo/camera.html' }).runInContext(sandbox);
  const el = (id) => elements.get(id);
  return { el, canvas, work, video, model, events, timers, timeouts, stopped, loaded, ctxCalls };
}

function dragBay(page) {
  // A bay in the top-left quarter of a 960x540 frame: x 0.1..0.5, y 0.1..0.5.
  page.canvas.fire('pointerdown', { pointerId: 1, clientX: 96, clientY: 54 });
  page.canvas.fire('pointermove', { pointerId: 1, clientX: 300, clientY: 200 });
  page.canvas.fire('pointerup', { pointerId: 1, clientX: 480, clientY: 270 });
}

// One COCO-SSD style prediction whose pixel bbox covers the dragged bay.
const CAR = [{ class: 'car', score: 0.92, bbox: [96, 54, 384, 216] }];

async function frames(page, preds, n) {
  page.model.detect = () => Promise.resolve(preds);
  for (let i = 0; i < n; i++) { page.timers[0](); await settle(); }
}

test('a dragged bay shows up in the spot status and on the frame', () => {
  const page = runPage();
  assert.equal(page.el('kpiFree'), undefined, 'nothing is rendered before the first bay');
  dragBay(page);
  assert.match(page.el('spotStatus').textContent, /^1 תאים מסומנים\.$/);
  assert.equal(page.el('kpiFree').textContent, 1);
  assert.equal(page.el('kpiOcc').textContent, 0);
  assert.ok(page.ctxCalls.includes('fillRect'), 'the bay must be painted on the frame');
  // A drag too short to be a bay is refused in Hebrew, not silently.
  page.canvas.fire('pointerdown', { pointerId: 2, clientX: 10, clientY: 10 });
  page.canvas.fire('pointerup', { pointerId: 2, clientX: 12, clientY: 12 });
  assert.match(page.el('spotStatus').textContent, /הגרירה קצרה מדי/);
  assert.equal(page.el('kpiFree').textContent, 1);
});

test('the camera source loads the model once, starts the loop and keeps its tracks alive', async () => {
  const page = runPage();
  assert.equal(page.timers.length, 0, 'no detection loop before a source is chosen');
  page.el('btnCam').fire('click');
  await settle();
  assert.deepEqual(page.loaded, [TFJS, COCO], 'tfjs then coco-ssd, injected on first use only');
  assert.equal(page.timers.length, 1, 'start() arms exactly one interval');
  assert.equal(page.video.srcObject !== undefined, true);
  assert.deepEqual(page.stopped, [], 'start() must not stop the tracks of the camera just opened');
  assert.match(page.el('srcStatus').textContent, /המודל נטען/);
  // Stop releases the camera and says so.
  page.el('btnStop').fire('click');
  assert.deepEqual(page.stopped, ['track']);
  assert.equal(page.el('srcStatus').textContent, 'הזיהוי הופסק.');
});

test('a car entering and leaving the bay moves the counters and fires spot-freed once', async () => {
  const page = runPage();
  dragBay(page);
  page.el('btnCam').fire('click');
  await settle();
  // Three frames with the car: the debounce reports the bay as taken.
  await frames(page, CAR, 3);
  assert.equal(page.el('kpiFree').textContent, 0);
  assert.equal(page.el('kpiOcc').textContent, 1);
  assert.equal(page.el('kpiRate').textContent, '100%');
  assert.equal(page.el('kpiCars').textContent, 1);
  assert.deepEqual(page.events, [], 'a bay being taken is not a spot-freed event');
  // Two empty frames are a blink, not a freeing.
  await frames(page, [], 2);
  assert.equal(page.el('kpiOcc').textContent, 1);
  assert.deepEqual(page.events, []);
  // The third empty frame is the real transition: one event, one toast.
  await frames(page, [], 1);
  assert.equal(page.el('kpiFree').textContent, 1);
  assert.equal(page.el('kpiOcc').textContent, 0);
  assert.equal(page.el('kpiRate').textContent, '0%');
  assert.equal(page.events.length, 1);
  assert.equal(page.events[0].type, 'parkwiz:spot-freed');
  assert.equal(page.events[0].detail.spotId, 'ת1');
  assert.equal(page.events[0].detail.source, 'camera');
  assert.equal(page.events[0].detail.free, 1);
  assert.match(page.el('toast').textContent, /^התפנה תא ת1 · 1 פנויים$/);
  assert.ok(page.el('toast').classList.has('show'));
  // More empty frames must not re-fire for the same freeing.
  await frames(page, [], 4);
  assert.equal(page.events.length, 1);
});

test('both charts are rendered as SVG from the run\'s own detections', async () => {
  const page = runPage();
  dragBay(page);
  page.el('btnCam').fire('click');
  await settle();
  await frames(page, CAR, 3);
  await frames(page, [], 3);
  assert.match(page.el('sessionChart').innerHTML, /^<svg[\s\S]*<\/svg>$/);
  assert.match(page.el('hourChart').innerHTML, /^<svg[\s\S]*<\/svg>$/);
});

function rawAt(x, y) {
  const p = y * 960 + x;
  return [(p * 7) % 256, (p * 13) % 256, (p * 29) % 256];
}
function px(buf, x, y) {
  const i = (y * 960 + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2]];
}

test('the shown frame is redacted and a stale detection cannot publish the next raw frame', async () => {
  const page = runPage();
  page.el('btnCam').fire('click');
  await settle();
  const pending = [];
  page.model.detect = () => new Promise((resolve) => pending.push(resolve));
  page.timers[0]();
  page.timers[0]();
  assert.equal(pending.length, 2);
  // The first callback is older than the frame now sitting on `work`.
  pending[0]([{ class: 'person', score: 0.99, bbox: [0, 0, 400, 400] }]);
  await settle();
  assert.deepEqual(px(page.work._buf, 20, 20), rawAt(20, 20), 'stale callback left the new raw frame alone');
  assert.equal(page.ctxCalls.filter((c) => c === 'frame:putImageData').length, 0);
  pending[1](CAR);
  await settle();
  assert.deepEqual(px(page.canvas._buf, 10, 10), rawAt(10, 10), 'outside the car box the frame is untouched');
  assert.notDeepEqual(px(page.canvas._buf, 200, 100), rawAt(200, 100), 'inside the car box the frame is destroyed');
  assert.ok(page.ctxCalls.includes('frame:putImageData'));
  assert.equal(page.ctxCalls.filter((c) => c.startsWith('frame:draw:')).length, 0, 'the visible canvas never draws a source');
  assert.ok(page.ctxCalls.includes('work:draw:srcVideo'));
});

test('the page is reachable from the landing page, the offer and the Atidim demo', () => {
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  assert.match(read('index.html'), /href="\.\/demo\/camera\.html"/);
  assert.match(read('offer.html'), /href="\.\/demo\/camera\.html"/);
  assert.match(read('demo/atidim.html'), /href="\.\/camera\.html"/);
  assert.match(read('README.md'), /## איך מריצים את הדמו/);
  assert.match(read('README.md'), /demo\/camera\.html/);
  // Rehearsal clips are documented, never committed.
  const credits = read('demo/samples/CREDITS.md');
  assert.match(credits, /pexels\.com\/video\//);
  assert.deepEqual(fs.readdirSync(path.join(root, 'demo', 'samples')).filter((f) => /\.(mp4|mov|webm)$/i.test(f)), []);
});
