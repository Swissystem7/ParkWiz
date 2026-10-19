// ParkWiz — `?site=` demo presets for the root page (issue #261).
//
// The root page is the Netanya *street* map, so a lot operator sent the Pages
// link for a lot pilot (Park Atidim / CityZone) should land on the lot's own
// numbers: `?site=atidim` turns on a panel over the map with a big free-spots
// counter, the occupancy percentage and an hourly load chart over a sample frame
// with marked bays. Default behaviour is the contract — no `?site=`, an empty
// value or an unknown one and parseSite() returns null, so index.html never
// touches the DOM. Pure, zero-dependency, UMD like the rest of src/lib: the
// hourly curve and the bay fill order are injected (atidim-lot.js#getHourlyCurve,
// #arrivalOrder), so this file owns no lot's rates — only how to lay them out.
// Every number is example data, and exampleNoteHe travels with the preset so no
// caller can render the panel without saying so.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizSitePreset = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // The pilot's standing promise to the operator, verbatim (#261).
  const FOOTER_HE = 'ללא זיהוי לוחיות • ללא שרת • ללא חומרה חדשה • רץ בדפדפן';
  const EXAMPLE_NOTE_HE = 'נתוני דוגמה — עקומת תפוסה אופיינית, לא מצלמה חיה';

  // Bay rectangles of pilot/sample-lot.svg in that file's own 800x480 user units:
  // two rows of six, first bay at (50,36), 124 apart across, 240 down. One <svg
  // viewBox> then holds image and marks, so a mark cannot drift off its bay.
  const SAMPLE_LOT = Object.freeze({
    image: './pilot/sample-lot.svg', width: 800, height: 480, cols: 6, rows: 2,
    bay: Object.freeze({ x: 50, y: 36, w: 108, h: 168, dx: 124, dy: 240 }),
  });

  const PRESETS = Object.freeze({
    atidim: Object.freeze({
      id: 'atidim', capacity: 220, lot: SAMPLE_LOT, deepLink: './demo/atidim.html',
      nameHe: 'חניון פארק עתידים — תל אביב', operatorHe: 'Park Atidim / CityZone',
      footerHe: FOOTER_HE, exampleNoteHe: EXAMPLE_NOTE_HE,
    }),
  });

  const clamp01 = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.min(1, Number(n))) : 0);
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));
  const wrapHour = (n) => (Number.isFinite(Number(n)) ? ((Math.floor(Number(n)) % 24) + 24) % 24 : null);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Accepts a bare query string, a `?`-prefixed one, or a whole URL: callers
  // pass location.search, but a hand-typed link arrives just as often. An
  // unknown site is not an error — the page simply stays itself.
  function parseSite(search) {
    const raw = String(search == null ? '' : search);
    const at = raw.indexOf('?');
    const hit = /(?:^|&)site=([^&]*)/.exec((at === -1 ? raw : raw.slice(at + 1)).split('#')[0]);
    if (!hit) return null;
    let id = hit[1];
    try { id = decodeURIComponent(id); } catch (e) { /* a bad %-escape is no preset */ }
    id = id.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PRESETS, id) ? id : null;
  }
  const presetFrom = (search) => PRESETS[parseSite(search)] || null;

  // Lot-wide counters for one point of the curve. `point` is an
  // atidim-lot.js#hourlyPoint result; only rate/hour/label are read.
  function counters(point, capacity) {
    const cap = Math.max(1, Math.round(Number(capacity) || 0) || 1), pt = point || {};
    const rate = clamp01(pt.rate);
    const occupied = clampInt(rate * cap, 0, cap);
    return {
      hour: wrapHour(pt.hour) || 0,
      label: typeof pt.label === 'string' ? pt.label : '',
      capacity: cap, occupied, free: cap - occupied, rate,
      percentage: Math.round(rate * 100),
      // Same thresholds as atidim-lot.js#calculateOccupancy, so the preset and
      // the operator demo never disagree about a word.
      statusHe: rate > 0.9 ? 'עמוס מאוד' : (rate > 0.75 ? 'תפוסה בינונית' : 'זמינות גבוהה'),
    };
  }

  // Marked bays over the sample frame. The frame shows a 12-bay sample, not all
  // 220 spaces, so the lot's own rate decides how many of the 12 read occupied and
  // the overlay cannot tell a different story from the big counter. `order`
  // (atidim-lot.js#arrivalOrder) scatters the fill so a half-full lot does not read
  // as a solid block; without it bays fill left to right — still reproducible.
  function sampleOverlay(rate, opts) {
    const o = opts || {}, lot = o.lot || SAMPLE_LOT;
    const total = Math.max(0, lot.cols * lot.rows);
    const occupied = clampInt(clamp01(rate) * total, 0, total);
    const order = Array.isArray(o.order) && o.order.length === total
      ? o.order : Array.from({ length: total }, (_, i) => i);
    const taken = new Set(order.slice(0, occupied));
    const out = [];
    for (let i = 0; i < total; i++) {
      out.push({
        id: 'S' + (i + 1), w: lot.bay.w, h: lot.bay.h, occupied: taken.has(i),
        x: lot.bay.x + (i % lot.cols) * lot.bay.dx,
        y: lot.bay.y + Math.floor(i / lot.cols) * lot.bay.dy,
      });
    }
    return out;
  }

  // Bar geometry for the hourly load chart. Time reads left to right even on an RTL
  // page (an hour axis mirrored into Hebrew order reads as a bug): bar 0 is midnight.
  function loadChart(curve, opts) {
    const o = opts || {}, width = Number(o.width) || 540, height = Number(o.height) || 170;
    const padX = Number(o.padX) || 26, padY = Number(o.padY) || 22;
    const peakThreshold = clamp01(o.peakThreshold == null ? 0.85 : o.peakThreshold);
    const points = Array.isArray(curve) ? curve : [];
    const plotH = Math.max(1, height - padY * 2);
    const slot = Math.max(1, width - padX * 2) / Math.max(1, points.length);
    const baselineY = height - padY;
    const nowHour = wrapHour(o.nowHour), round2 = (n) => Number(n.toFixed(2));
    const bars = points.map((pt, i) => {
      const rate = clamp01(pt && pt.rate);
      const label = pt && typeof pt.label === 'string' ? pt.label : String(i);
      const percentage = Math.round(rate * 100);
      return {
        hour: i, label, percentage, x: round2(padX + i * slot + 2), y: round2(baselineY - rate * plotH),
        w: round2(Math.max(1, slot - 4)), h: round2(rate * plotH),
        isPeak: rate >= peakThreshold, isNow: nowHour !== null && i === nowHour,
        // Every bar carries its own tooltip: a bar you cannot hover invites guessing.
        titleHe: label + ' · ' + percentage + '% תפוסה',
      };
    });
    return {
      width, height, padX, padY, baselineY, bars,
      peak: {
        y: round2(baselineY - plotH * peakThreshold),
        percentage: Math.round(peakThreshold * 100),
        labelHe: 'קו שיא ' + Math.round(peakThreshold * 100) + '%',
      },
      // Every third hour, so the axis stays readable on a phone.
      ticks: bars.filter((b) => b.hour % 3 === 0)
        .map((b) => ({ hour: b.hour, label: b.label, x: round2(b.x + b.w / 2) })),
    };
  }

  // The figures and the panel are emitted here rather than assembled from
  // placeholder markup in index.html, so each exists in exactly one place. The hex
  // values mirror index.html's --green/--red/--muted, the one thing an <svg> built
  // through innerHTML cannot inherit as a CSS variable.
  const FREE = '#22c55e', OCC = '#ef4444', IDLE = '#374151', MUTED = '#93b493';
  function frameSvg(marks, lot) {
    const l = lot || SAMPLE_LOT;
    return '<image href="' + esc(l.image) + '" x="0" y="0" width="' + l.width + '" height="' + l.height + '" preserveAspectRatio="none"/>' +
      marks.map((m) => '<rect x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h + '" rx="6"' +
        ' fill="' + (m.occupied ? 'rgba(239,68,68,.32)' : 'rgba(34,197,94,.3)') + '" stroke="' + (m.occupied ? OCC : FREE) +
        '" stroke-width="3"><title>' + esc(m.id + ' · ' + (m.occupied ? 'תפוס' : 'פנוי')) + '</title></rect>').join('');
  }

  function chartSvg(chart) {
    const right = chart.width - chart.padX;
    const line = (y, extra) => '<line x1="' + chart.padX + '" y1="' + y + '" x2="' + right + '" y2="' + y + '" stroke-width="1" ' + extra + '/>';
    return line(chart.baselineY, 'stroke="' + IDLE + '"') + line(chart.peak.y, 'stroke="' + OCC + '" stroke-dasharray="4,4"') +
      '<text x="' + (right - 4) + '" y="' + (chart.peak.y - 4) + '" fill="' + OCC + '" font-size="9" text-anchor="end">' + esc(chart.peak.labelHe) + '</text>' +
      chart.bars.map((b) => '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="2" fill="' +
        (b.isNow ? FREE : (b.isPeak ? OCC : IDLE)) + '"><title>' + esc(b.titleHe) + '</title></rect>').join('') +
      chart.ticks.map((t) => '<text x="' + t.x + '" y="' + (chart.baselineY + 14) + '" fill="' + MUTED +
        '" font-size="9" text-anchor="middle">' + esc(t.label) + '</text>').join('');
  }

  // `model` is src/lib/atidim-lot.js, injected: it supplies the lot's own wall-clock
  // hour (reading "now" off a laptop's UTC clock showed the wrong hour of the curve
  // in an earlier demo), its hourly curve and its fill order.
  function panelHtml(preset, model) {
    const nowHour = model.lotHour();
    const c = counters(model.hourlyPoint(nowHour, preset.capacity), preset.capacity);
    const marks = sampleOverlay(c.rate, { lot: preset.lot, order: model.arrivalOrder(preset.lot.cols * preset.lot.rows) });
    const chart = loadChart(model.getHourlyCurve(preset.capacity), { nowHour: nowHour, peakThreshold: model.PEAK_THRESHOLD });
    const fig = (titleHe, viewBox, labelHe, body, captionHe) => '<div class="sp-card"><h2>' + titleHe + '</h2><svg viewBox="' +
      viewBox + '" role="img" aria-label="' + labelHe + '">' + body + '</svg><div class="sp-lbl">' + captionHe + '</div></div>';
    return '<div class="sp-wrap">' +
      '<div><h1>' + esc(preset.nameHe) + '</h1><div class="sp-sub">' + esc(preset.operatorHe) + ' · ' + preset.capacity +
      ' מקומות · שעה ' + esc(c.label) + '</div></div>' +
      '<div class="sp-note" role="note">' + esc(preset.exampleNoteHe) + '</div>' +
      '<div class="sp-kpis" aria-live="polite">' +
      '<div class="sp-kpi free"><div class="sp-num">' + c.free + '</div><div class="sp-lbl">מקומות פנויים כעת (מתוך ' + preset.capacity + ')</div></div>' +
      '<div class="sp-kpi"><div class="sp-num">' + c.percentage + '%</div><div class="sp-lbl">אחוז תפוסה · ' + esc(c.statusHe) + '</div></div></div>' +
      fig('פריים לדוגמה — תאי חניה מסומנים', '0 0 ' + preset.lot.width + ' ' + preset.lot.height,
        'פריים חניון לדוגמה עם סימון תאי חניה — ירוק פנוי, אדום תפוס', frameSvg(marks, preset.lot),
        'בפריים: ' + marks.filter((m) => !m.occupied).length + ' פנויים מתוך ' + marks.length +
        ' תאים מסומנים (מדגם מתוך ' + preset.capacity + ' מקומות). ירוק = פנוי, אדום = תפוס.') +
      fig('עומס לפי שעות (יום עבודה אופייני)', '0 0 ' + chart.width + ' ' + chart.height,
        'גרף עומס תפוסה לאורך שעות היממה', chartSvg(chart),
        'העמודה הירוקה היא השעה הנוכחית (' + esc(c.label) + ' · ' + c.percentage + '%). הקו המקווקו הוא ' +
        esc(chart.peak.labelHe) + '. ' + esc(preset.exampleNoteHe) + '.') +
      '<div class="sp-actions"><a class="sp-btn primary" href="' + esc(preset.deepLink) + '">לדמו המפעיל המלא (מצלמה + Overlay)</a>' +
      '<a class="sp-btn" href="./offer.html">הזמנת פיילוט 4 שבועות</a>' +
      '<button class="sp-btn" type="button" id="spClose">סגירה · מעבר למפה</button></div>' +
      '<div class="sp-foot">' + esc(preset.footerHe) + '</div></div>';
  }

  return { FOOTER_HE, EXAMPLE_NOTE_HE, SAMPLE_LOT, PRESETS, parseSite, presetFrom, counters, sampleOverlay, loadChart, frameSvg, chartSvg, panelHtml };
});
