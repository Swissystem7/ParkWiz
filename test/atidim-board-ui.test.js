const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'demo', 'atidim-board.html');

test('atidim-board page has accessible status regions and copy buttons', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Accessible live status element for board announcements
  assert.match(html, /id="boardStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /\.board-status\s*\{/);

  // Copy action buttons in toolbar and arrival margin controls
  assert.match(html, /<button id="btnCopyBoard"[^>]*>העתק תקציר לוח<\/button>/);
  assert.match(html, /<button id="btnCopyMargin"[^>]*>העתק חלון הגעה<\/button>/);

  // Dynamic canvas aria-label update
  assert.match(html, /canvas\.setAttribute\("aria-label",\s*"מפת חניות: "\s*\+\s*snap\.free\s*\+\s*" פנויים מתוך "\s*\+\s*snap\.total\s*\+\s*" בשעה "\s*\+\s*label\(hour\)\)/);

  // Announcement and clipboard helper wiring
  assert.match(html, /function announce\(msg,\s*isErr\)/);
  assert.match(html, /function copyToClipboard\(text,\s*successMsg\)/);

  // Graceful fallback when modules are missing
  assert.match(html, /if\s*\(!LOT\s*\|\|\s*!OCC\s*\|\|\s*!MARGIN\)\s*\{[\s\S]*?announce\("מודולי החניון לא נטענו במלואם — נא לרענן את הדף\.",\s*true\);/);

  // Announcement messages on user interactions
  assert.match(html, /announce\("שעה שונתה ל-"\s*\+\s*label\(hour\)/);
  assert.match(html, /announce\("חזרה לשעה הנוכחית \("\s*\+\s*label\(hour\)\s*\+\s*"\) · "/);
  assert.match(html, /announce\("זמן נסיעה עודכן: "/);
  assert.match(html, /announce\("שולי ביטחון עודכנו: ±"/);

  // Copy buttons click handlers
  assert.match(html, /copyBoardBtn\.addEventListener\("click"/);
  assert.match(html, /copyMarginBtn\.addEventListener\("click"/);
  assert.match(html, /clearAlertsBtn\.addEventListener\("click"/);
  assert.match(html, /resetMarginBtn\.addEventListener\("click"/);
  assert.match(html, /<button id="btnClearAlerts"[^>]*>נקה התראות<\/button>/);
  assert.match(html, /<button id="btnResetMargin"[^>]*>אפס שוליים<\/button>/);
  assert.match(html, /"תקציר לוח המפעיל הועתק ללוח\."/);
  assert.match(html, /"פרטי חלון ההגעה הועתקו ללוח\."/);
  assert.match(html, /"אין התראות לניקוי\."/);
  assert.match(html, /"רשימת ההתראות נוקתה\."/);
  assert.match(html, /"שולי ההגעה כבר בערכי ברירת המחדל\."/);
  assert.match(html, /שולי ההגעה אופסו לברירת המחדל/);
});

test('clear alerts and reset margin buttons guard empty/default states and restore board state', async () => {
  const vm = require('node:vm');
  const lot = require('../src/lib/atidim-lot');
  const occ = require('../src/lib/occupancy');
  const marginLib = require('../src/lib/margin');
  const sf = require('../src/lib/spot-freed');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];

  function fakeEl(tag) {
    const el = {
      tagName: tag || 'div',
      textContent: '',
      innerHTML: '',
      value: '',
      hidden: false,
      children: [],
      attrs: {},
      handlers: {},
      style: {},
      setAttribute(k, v) { el.attrs[k] = v; },
      addEventListener(t, fn) { el.handlers[t] = fn; },
      appendChild(child) { el.children.push(child); return child; },
      replaceChildren() { el.children.length = 0; },
    };
    return el;
  }

  const els = new Map();
  const canvas = fakeEl('canvas');
  canvas.getContext = () => ({
    setTransform() {}, fillRect() {}, strokeRect() {}, fill() {}, stroke() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arcTo() {},
    setLineDash() {}, roundRect() {}, fillText() {},
  });
  els.set('bayCanvas', canvas);

  const document = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, fakeEl());
      return els.get(id);
    },
    createElement: (tag) => fakeEl(tag),
  };

  const fixedMs = Date.parse('2026-10-19T07:30:00Z');
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(fixedMs); }
    static now() { return fixedMs; }
  }

  const sandbox = {
    document,
    navigator: {},
    window: {
      devicePixelRatio: 1,
      addEventListener() {},
      ParkWizAtidimLot: lot,
      ParkWizOccupancy: occ,
      ParkWizMargin: marginLib,
      ParkWizSpotFreed: sf,
    },
    Date: FixedDate,
    Number, Math, Array, String, JSON,
    setInterval() {},
    fetch: () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'demo', 'atidim-data.json'), 'utf8'))),
    }),
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(inline, sandbox);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const get = (id) => document.getElementById(id);

  // 1. Empty alerts guard
  get('btnClearAlerts').handlers.click();
  assert.equal(get('boardStatus').textContent, 'אין התראות לניקוי.');

  // 2. Scrub to 19:00 so alerts populate, then clear them
  get('hourRange').handlers.input({ target: { value: '19' } });
  assert.ok(get('alertsList').children.length > 0);
  assert.equal(get('alertsEmpty').hidden, true);
  get('btnClearAlerts').handlers.click();
  assert.equal(get('alertsList').children.length, 0);
  assert.equal(get('alertsEmpty').hidden, false);
  assert.equal(get('boardStatus').textContent, 'רשימת ההתראות נוקתה.');

  // 3. Default margin guard
  get('btnResetMargin').handlers.click();
  assert.equal(get('boardStatus').textContent, 'שולי ההגעה כבר בערכי ברירת המחדל.');

  // 4. Change eta and buffer, then reset to defaults
  get('etaRange').handlers.input({ target: { value: '22' } });
  get('bufferRange').handlers.input({ target: { value: '15' } });
  assert.equal(get('etaOut').textContent, '22 דק׳');
  assert.equal(get('bufferOut').textContent, '±15 דק׳');
  get('btnResetMargin').handlers.click();
  assert.equal(get('etaOut').textContent, '8 דק׳');
  assert.equal(get('bufferOut').textContent, '±5 דק׳');
  assert.equal(get('boardStatus').textContent, 'שולי ההגעה אופסו לברירת המחדל (8 דק׳, ±5 דק׳).');
});
