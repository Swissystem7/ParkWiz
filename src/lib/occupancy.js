// ParkWiz — one occupancy record schema + SVG chart.
//
// Used by the municipal pilot pages (kit, report, dashboard). Records are
// { ts, street, total, occupied, source, confidence }. Legacy keys
// totalSpots / occupiedSpots / occupancyRate are accepted on input.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizOccupancy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LS = Object.freeze({
    spots: 'pw_pilot_spots',
    occupancy: 'pw_pilot_occupancy',
    street: 'pw_pilot_street',
    estimate: 'pw_pilot_last_estimate',
    accuracy: 'pw_pilot_accuracy',
  });

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function occupancyRate(r) {
    if (!r || !r.total) return 0;
    return r.occupied / r.total;
  }

  function pct(n) {
    return Math.round(n * 100) + '%';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return ts || '—';
    return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function normalize(o, fallbackStreet) {
    if (!o || typeof o !== 'object') return null;
    const total = num(o.total != null ? o.total : o.totalSpots);
    let occupied = num(o.occupied != null ? o.occupied : o.occupiedSpots);
    let rate = o.occupancyRate != null ? num(o.occupancyRate) : null;
    if (rate != null && rate > 1) rate /= 100;
    if (occupied == null && total > 0 && rate != null) occupied = Math.round(rate * total);
    if (total == null || total <= 0 || occupied == null) return null;
    return {
      ts: o.ts != null ? String(o.ts) : '',
      street: o.street != null ? String(o.street) : (fallbackStreet || '—'),
      total,
      occupied: Math.max(0, Math.min(total, occupied)),
      source: o.source != null ? String(o.source) : 'unknown',
      confidence: num(o.confidence) != null ? num(o.confidence) : 0,
    };
  }

  function parse(text, fallbackStreet) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    if (raw[0] === '[') {
      try {
        const a = JSON.parse(raw);
        if (Array.isArray(a)) return a.map((o) => normalize(o, fallbackStreet)).filter(Boolean);
      } catch (e) { /* fall through to JSONL */ }
    }
    const out = [];
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try {
        const n = normalize(JSON.parse(s), fallbackStreet);
        if (n) out.push(n);
      } catch (e) { /* skip bad line */ }
    }
    return out.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  }

  function summarize(records) {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) {
      return { count: 0, last: null, first: null, peak: null, low: null, avg: 0, conf: 0, sources: [] };
    }
    const rates = list.map(occupancyRate);
    let peakI = 0, lowI = 0, sum = 0, csum = 0;
    rates.forEach((r, i) => {
      if (r > rates[peakI]) peakI = i;
      if (r < rates[lowI]) lowI = i;
      sum += r;
      csum += Number(list[i].confidence) || 0;
    });
    return {
      count: list.length,
      last: list[list.length - 1],
      first: list[0],
      peak: list[peakI],
      low: list[lowI],
      avg: sum / list.length,
      conf: csum / list.length,
      sources: Array.from(new Set(list.map((r) => r.source))),
    };
  }

  function planningNotes(summary) {
    const notes = [];
    if (!summary || !summary.count) return ['אין רשומות — אין המלצת תכנון.'];
    if (summary.avg >= 0.75) notes.push('התפוסה הממוצעת גבוהה — לבדוק לחץ בשעות השיא לתכנון הסדרי חניה (לא לקנסות).');
    else notes.push('התפוסה הממוצעת בינונית/נמוכה בסדרה הזו — להצליב מול ספירת פקח לפני מסקנת מדיניות.');
    if (occupancyRate(summary.peak) - occupancyRate(summary.low) >= 0.35) {
      notes.push('יש פער גדול בין שפל לשיא — כדאי להציג לעירייה חלון זמן, לא מספר בודד.');
    }
    notes.push('אין בדוח זה המלצת אכיפה. מדידה אנונימית תפוס/פנוי בלבד.');
    return notes;
  }

  function chartSvg(records, opts) {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return '';
    const o = opts || {};
    const W = o.width || 760, H = o.height || 230;
    const m = { t: 12, r: 12, b: 32, l: 36 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const n = list.length;
    const x = (i) => (n <= 1 ? m.l + iw / 2 : m.l + (i / (n - 1)) * iw);
    const y = (r) => m.t + (1 - r) * ih;
    let grid = '', xlab = '';
    for (let g = 0; g <= 100; g += 25) {
      const yy = y(g / 100);
      grid += `<line x1="${m.l}" y1="${yy}" x2="${m.l + iw}" y2="${yy}" stroke="#e5e7eb"/>`;
      grid += `<text x="${m.l - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#6b7280">${g}%</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 8));
    list.forEach((r, i) => {
      if (i % step) return;
      const d = new Date(r.ts);
      const lbl = isNaN(d) ? String(i + 1) : String(d.getHours()).padStart(2, '0') + ':00';
      xlab += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#6b7280">${lbl}</text>`;
    });
    const line = list.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(occupancyRate(r)).toFixed(1)}`).join(' ');
    const stroke = o.stroke || '#0e7490';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="עקומת תפוסה">
      ${grid}${xlab}
      <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2.5"/>
    </svg>`;
  }

  function loadStoredOccupancy() {
    try {
      const raw = localStorage.getItem(LS.occupancy);
      return raw ? parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveOccupancy(list) {
    try {
      localStorage.setItem(LS.occupancy, JSON.stringify(list || []));
    } catch (e) { /* quota / private mode */ }
  }

  return {
    LS,
    normalize,
    parse,
    occupancyRate,
    pct,
    formatTime,
    summarize,
    planningNotes,
    chartSvg,
    loadStoredOccupancy,
    saveOccupancy,
  };
});
