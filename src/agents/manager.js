// ParkWiz — the lot-manager agent (#269 item 2).
//
// Two jobs, one state. It accumulates the day — the peak rate per hour, how
// many driver alerts went out — and it watches consecutive occupancy samples
// for the two shapes an operator actually wants to be woken for:
//
//   full-early   the lot is at capacity before the morning curve says it should
//                be, so the afternoon is already lost unless someone acts now
//   sudden-drop  occupancy fell off a cliff between two samples; far more often
//                a camera that stopped seeing cars than 60 cars leaving at once
//
// Each anomaly fires once per kind per hour: an operator who gets the same
// alert every 10 seconds stops reading alerts.
//
// `minutesSaved` is an explicit demo assumption (MINUTES_SAVED_PER_ALERT), not
// a measurement, and the Hebrew summary says so — this repo does not put
// numbers on an operator's screen that a pilot has not earned yet.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizManagerAgent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const NAME = 'manager';
  // Matches PEAK_THRESHOLD in src/lib/atidim-lot.js, kept local so this agent
  // stays zero-dependency like the rest of src/lib.
  const PEAK_RATE = 0.85;
  const FULL_RATE = 0.95;
  // Before this hour the typical Atidim curve is still below 0.8, so a full lot
  // is genuinely out of pattern rather than just a busy morning.
  const EARLY_HOUR = 9;
  const DROP_DELTA = 0.25;
  const MINUTES_SAVED_PER_ALERT = 7;

  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const hourLabel = (hour) => pad2(((Math.round(Number(hour)) % 24) + 24) % 24) + ':00';
  const pct = (rate) => Math.round(Math.max(0, Math.min(1, Number(rate) || 0)) * 100);

  // Number(null) is 0, so a sample that forgot its hour would otherwise be
  // filed under midnight and quietly become the day's "quiet hour" evidence.
  // A numeric string is still accepted — the page reads some of these from DOM.
  function validHour(hour) {
    if (typeof hour !== 'number' && (typeof hour !== 'string' || hour.trim() === '')) return false;
    const n = Number(hour);
    return Number.isInteger(n) && n >= 0 && n <= 23;
  }

  function createManagerAgent(options) {
    const opts = options || {};
    const lotName = String(opts.lotName || 'החניון');
    let peakByHour;
    let previous;
    let alerts;
    let anomalies;
    let samples;
    let firedKeys;

    function resetDay() {
      peakByHour = Object.create(null);
      previous = null;
      alerts = 0;
      anomalies = [];
      samples = 0;
      firedKeys = Object.create(null);
    }
    resetDay();

    function anomaly(kind, hour, textHe, at) {
      const key = kind + '@' + hour;
      if (firedKeys[key]) return null;
      firedKeys[key] = true;
      anomalies.push({ kind, hour, textHe, at });
      return { type: 'manager-anomaly', kind, hour, at, textHe };
    }

    function peakHours() {
      return Object.keys(peakByHour)
        .map(Number)
        .filter((hour) => peakByHour[hour] >= PEAK_RATE)
        .sort((a, b) => a - b);
    }

    function busiestHour() {
      const hours = Object.keys(peakByHour).map(Number);
      if (hours.length === 0) return null;
      return hours.reduce((best, hour) => (peakByHour[hour] > peakByHour[best] ? hour : best), hours[0]);
    }

    function summaryHe() {
      const busiest = busiestHour();
      const peaks = peakHours();
      const parts = ['סיכום יומי — ' + lotName];
      parts.push(samples + ' מדידות תפוסה');
      parts.push(busiest === null
        ? 'אין נתוני תפוסה עדיין'
        : 'שיא תפוסה ' + pct(peakByHour[busiest]) + '% ב-' + hourLabel(busiest));
      parts.push(peaks.length === 0
        ? 'לא נרשמו שעות שיא'
        : 'שעות שיא: ' + peaks.map(hourLabel).join(', '));
      parts.push(alerts + ' התראות נשלחו לנהגים');
      parts.push('~' + alerts * MINUTES_SAVED_PER_ALERT + ' דק׳ חיפוש נחסכו (הנחת דמו: ' +
        MINUTES_SAVED_PER_ALERT + ' דק׳ להתראה)');
      parts.push(anomalies.length + ' חריגות');
      return parts.join(' · ');
    }

    function onEvent(evt) {
      // The driver agent's alert comes back through the runtime, so the manager
      // counts real alerts instead of the page having to tell it twice.
      if (evt.type === 'driver-alert') {
        alerts += 1;
        return null;
      }
      if (evt.type !== 'occupancy-sample' || !validHour(evt.hour)) return null;
      const hour = Number(evt.hour);
      // Same guard as the hour: Number(null) is 0, and a null rate recorded as
      // 0% would read as "the lot emptied" and fire a sudden-drop anomaly.
      if (typeof evt.rate !== 'number' && (typeof evt.rate !== 'string' || evt.rate.trim() === '')) return null;
      const rate = Math.max(0, Math.min(1, Number(evt.rate)));
      if (!Number.isFinite(rate)) return null;

      // Past midnight the day starts over, and the day that just ended is the
      // summary worth reading. Emitted before the reset so it reports that day.
      const actions = [];
      if (previous && hour < previous.hour) {
        actions.push({ type: 'manager-summary', at: evt.at, textHe: summaryHe() });
        resetDay();
      }

      samples += 1;
      if (!(hour in peakByHour) || rate > peakByHour[hour]) peakByHour[hour] = rate;

      if (rate >= FULL_RATE && hour < EARLY_HOUR) {
        const hit = anomaly('full-early', hour, 'חריגה: החניון מלא כמעט לגמרי (' + pct(rate) +
          '%) כבר ב-' + hourLabel(hour) + ' — מוקדם מהעקומה האופיינית', evt.at);
        if (hit) actions.push(hit);
      }
      if (previous && previous.rate - rate >= DROP_DELTA) {
        const hit = anomaly('sudden-drop', hour, 'חריגה: צניחה חדה בתפוסה מ-' + pct(previous.rate) +
          '% ל-' + pct(rate) + '% — בדקו אם מצלמה ירדה או קפאה', evt.at);
        if (hit) actions.push(hit);
      }
      previous = { hour, rate };
      return actions;
    }

    function report() {
      return {
        samples,
        alerts,
        anomalies: anomalies.slice(),
        peakHours: peakHours(),
        busiestHour: busiestHour(),
        minutesSaved: alerts * MINUTES_SAVED_PER_ALERT,
        textHe: summaryHe(),
      };
    }

    // The manager has no timers of its own: everything it knows arrives as an
    // event. tick exists so every agent is the same shape for the runtime.
    function tick() {
      return null;
    }

    return { name: NAME, labelHe: 'סוכן מנהל חניון', onEvent, tick, report };
  }

  return {
    createManagerAgent,
    hourLabel,
    NAME,
    PEAK_RATE,
    FULL_RATE,
    EARLY_HOUR,
    DROP_DELTA,
    MINUTES_SAVED_PER_ALERT,
  };
});
