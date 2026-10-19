// src/lib/site-preset.js plus the ?site= block it drives in index.html (#261).
//
// Two things must hold at once and they pull in opposite directions: ?site=atidim
// renders a free-spots counter, a percentage and an hourly chart, and without it the
// page is the map it always was. So the panel is tested through the lib and the inline
// block against a stub DOM — a blank panel at the CityZone meeting is the failure mode.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const SP = require('../src/lib/site-preset.js');
const LOT = require('../src/lib/atidim-lot.js');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('parseSite accepts a known site and refuses everything else', () => {
  assert.equal(SP.parseSite('?site=atidim'), 'atidim');
  assert.equal(SP.parseSite('site=atidim'), 'atidim');
  assert.equal(SP.parseSite('?lang=he&site=ATIDIM&x=1'), 'atidim');
  assert.equal(SP.parseSite('https://x.github.io/ParkWiz/?site=%20atidim%20#map'), 'atidim');
  // The default page is the contract: anything unknown leaves it alone.
  for (const q of ['', '?', '?site=', '?site=netanya', '?website=atidim', '?site=%E0%A4%A', null, undefined]) {
    assert.equal(SP.parseSite(q), null, 'must not activate a preset for ' + JSON.stringify(q));
    assert.equal(SP.presetFrom(q), null);
  }
  // The preset promises the pilot's terms verbatim and claims no live feed.
  const p = SP.presetFrom('?site=atidim');
  assert.equal(p.footerHe, 'ללא זיהוי לוחיות • ללא שרת • ללא חומרה חדשה • רץ בדפדפן');
  assert.match(p.exampleNoteHe, /נתוני דוגמה/);
  assert.match(p.exampleNoteHe, /לא מצלמה חיה/);
  assert.equal(p.capacity, LOT.ATIDIM_LOT.totalCapacity);
  assert.ok(fs.existsSync(path.join(root, p.lot.image.replace(/^\.\//, ''))), 'sample frame must exist');
});

test('counters never exceed capacity and free + occupied is the whole lot', () => {
  for (let h = 0; h < 24; h++) {
    const c = SP.counters(LOT.hourlyPoint(h, 220), 220);
    assert.equal(c.free + c.occupied, 220);
    assert.ok(c.free >= 0 && c.percentage >= 0 && c.percentage <= 100);
    assert.match(c.label, /^\d{2}:00$/);
  }
  // A panel reading "זמינות גבוהה" at a 95% hour would be worse than no panel.
  assert.equal(SP.counters({ rate: 0.95, hour: 10 }, 220).statusHe, 'עמוס מאוד');
  assert.equal(SP.counters({ rate: 0.8, hour: 16 }, 220).statusHe, 'תפוסה בינונית');
  assert.equal(SP.counters({ rate: 0.05, hour: 3 }, 220).statusHe, 'זמינות גבוהה');
  // Junk in, no NaN out.
  const junk = SP.counters(null, 0);
  assert.equal(junk.free, junk.capacity);
  assert.equal(SP.counters({ rate: 5 }, 220).occupied, 220);
});

test('marks and bars stay inside their boxes and follow the lot rate', () => {
  const lot = SP.SAMPLE_LOT;
  const marks = SP.sampleOverlay(0.5, { lot });
  assert.equal(marks.length, lot.cols * lot.rows);
  for (const m of marks) {
    assert.ok(m.x >= 0 && m.x + m.w <= lot.width, m.id + ' runs off the frame');
    assert.ok(m.y >= 0 && m.y + m.h <= lot.height, m.id + ' runs off the frame');
  }
  // The overlay reads the lot's rate, so it cannot tell a different story from
  // the big counter; with the scattered fill order it also stays monotone, so a
  // bay taken at a lower rate does not teleport across the lot at a higher one.
  assert.equal(SP.sampleOverlay(0, { lot }).filter((m) => m.occupied).length, 0);
  assert.equal(SP.sampleOverlay(1, { lot }).filter((m) => !m.occupied).length, 0);
  assert.equal(marks.filter((m) => m.occupied).length, 6);
  const order = LOT.arrivalOrder(lot.cols * lot.rows);
  const high = SP.sampleOverlay(0.75, { lot, order });
  SP.sampleOverlay(0.25, { lot, order }).forEach((m, i) => assert.ok(!m.occupied || high[i].occupied));

  const chart = SP.loadChart(LOT.getHourlyCurve(220), { nowHour: 9, peakThreshold: LOT.PEAK_THRESHOLD });
  assert.equal(chart.bars.length, 24);
  for (const b of chart.bars) {
    assert.ok(b.x >= chart.padX && b.x + b.w <= chart.width - chart.padX + 2, b.label + ' off box');
    assert.ok(b.y >= chart.padY - 1 && b.h >= 0 && b.y + b.h <= chart.baselineY + 0.01, b.label + ' off box');
    assert.match(b.titleHe, /% תפוסה$/);
  }
  assert.deepEqual(chart.bars.filter((b) => b.isNow).map((b) => b.hour), [9]);
  assert.ok(chart.bars[3].h < chart.bars[9].h, 'night is quieter than mid-morning');
  assert.ok(chart.bars.some((b) => b.isPeak), 'the office-park curve has peak hours');
  assert.equal(chart.peak.percentage, Math.round(LOT.PEAK_THRESHOLD * 100));
  assert.ok(chart.peak.y > chart.padY && chart.peak.y < chart.baselineY);
  assert.deepEqual(chart.ticks.map((t) => t.hour), [0, 3, 6, 9, 12, 15, 18, 21]);
  assert.deepEqual(SP.loadChart([], {}).bars, [], 'an empty curve must not throw');
});

test('the panel shows the counter, the percentage, the chart and the promise', () => {
  const panel = SP.panelHtml(SP.PRESETS.atidim, LOT);
  const c = SP.counters(LOT.hourlyPoint(LOT.lotHour(), 220), 220);
  assert.match(panel, new RegExp('<div class="sp-num">' + c.free + '</div>'));
  assert.match(panel, new RegExp('<div class="sp-num">' + c.percentage + '%</div>'));
  assert.match(panel, /מקומות פנויים כעת \(מתוך 220\)/);
  assert.match(panel, new RegExp('אחוז תפוסה · ' + c.statusHe));
  // Both figures are drawn whole and labelled: the sample frame with one mark per
  // painted bay, the chart with a bar per hour plus the peak reference line.
  assert.equal((panel.match(/<svg [^>]*role="img" aria-label="[^"]+"/g) || []).length, 2);
  assert.equal((panel.match(/<image href="\.\/pilot\/sample-lot\.svg"/g) || []).length, 1);
  assert.equal((panel.match(/<rect /g) || []).length, 12 + 24);
  assert.match(panel, /קו שיא \d+%/);
  assert.match(panel, /פנויים מתוך 12 תאים מסומנים/);
  assert.match(panel, /class="sp-kpis" aria-live="polite"/);
  // Example data is flagged and the footer promise is on screen.
  assert.match(panel, /class="sp-note" role="note">נתוני דוגמה/);
  assert.match(panel, new RegExp('class="sp-foot">' + SP.FOOTER_HE.replace(/•/g, '.')));
  assert.match(panel, /href="\.\/demo\/atidim\.html"/);
  assert.doesNotMatch(panel, /NaN|undefined/);
});

// ── index.html wiring ──
function runPreset(search) {
  const block = [...html.matchAll(/<script(?![^>]*\ssrc=)>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]).find((s) => s.includes('ParkWizSitePreset'));
  assert.ok(block, 'index.html must boot the ?site= preset from an inline script');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of SP.panelHtml(SP.PRESETS.atidim, LOT).matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  const elements = new Map();
  const document = {
    getElementById(id) {
      assert.ok(ids.has(id), 'script asks for #' + id + ' which no markup provides');
      if (!elements.has(id)) {
        elements.set(id, { id, innerHTML: '', hidden: false, handlers: {},
          addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); } });
      }
      return elements.get(id);
    },
  };
  const sandbox = { document, window: { location: { search }, ParkWizSitePreset: SP, ParkWizAtidimLot: LOT } };
  vm.runInNewContext(block, sandbox, { filename: 'index.html#site-preset' });
  return elements;
}

test('index.html ships the panel hidden, scrollable and mobile-friendly', () => {
  assert.match(html, /<section class="site-preset" id="sitePreset" hidden role="region" aria-label="[^"]+"><\/section>/);
  assert.match(html, /src="src\/lib\/site-preset\.js"/);
  assert.match(html, /src="src\/lib\/atidim-lot\.js"/);
  // The body is 100dvh with overflow:hidden for the map, so the panel has to be
  // an overlay that scrolls on its own rather than another flex row.
  assert.match(html, /\.site-preset\b[^{]*\{[^}]*position:fixed/);
  assert.match(html, /\.site-preset\b[^{]*\{[^}]*overflow-y:auto/);
  assert.match(html, /@media \(max-width:420px\)\{\.site-preset/);
});

test('?site=atidim reveals the panel, and the default page never touches the DOM', () => {
  const el = runPreset('?site=atidim');
  const panel = el.get('sitePreset');
  assert.equal(panel.hidden, false, 'the preset panel must be revealed');
  assert.equal(panel.innerHTML, SP.panelHtml(SP.PRESETS.atidim, LOT));
  // Closing hands the operator back to the map underneath.
  el.get('spClose').handlers.click[0]({});
  assert.equal(panel.hidden, true);
  for (const q of ['', '?utm_source=mail', '?site=netanya']) {
    assert.equal(runPreset(q).size, 0, 'the preset must stay inert for ' + JSON.stringify(q));
  }
});

test('the preset lib is in the offline shell behind a bumped cache', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/src\/lib\/site-preset\.js'/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 19, 'a changed index.html needs a cache bump');
});
