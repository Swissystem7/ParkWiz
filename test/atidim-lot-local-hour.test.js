// The board model's clock (Refs #192; test folded from the Lenovo loop's #193).
// localHour used to run its own Intl.DateTimeFormat instead of going through
// lotClockParts, which cost it two things the camera clock already had:
//   * midnight: an hourCycle-h24 runtime answers "24" for 00:xx, and
//     baselineRateForHour(24) is 0 — the board read as an empty lot for the
//     first hour of every day instead of showing the 12% night floor.
//   * no IANA data (old WebView, --without-intl build): the bare Intl call
//     threw, so the page died on load instead of degrading to host local time.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lot = require('../src/lib/atidim-lot');

const MODULE_ID = require.resolve('../src/lib/atidim-lot');
// 18.10.2026 21:30 UTC is 00:30 the next day in Tel Aviv (IDT, UTC+3).
const PAST_MIDNIGHT = new Date('2026-10-18T21:30:00Z');
// 18.10.2026 06:30 UTC is 09:30 in Tel Aviv — the demo-meeting instant.
const MEETING_INSTANT = new Date('2026-10-18T06:30:00Z');

function hasJerusalemTimeZone() {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false });
    return fmt.format(MEETING_INSTANT).includes('09');
  } catch (err) {
    return false;
  }
}

test('localHour reports midnight as hour 0, never 24', () => {
  if (!hasJerusalemTimeZone()) return; // runtime without IANA data falls back to host time
  assert.equal(lot.localHour(PAST_MIDNIGHT), 0);
  assert.equal(lot.localHour(MEETING_INSTANT), 9);
});

test('the board clock and the camera clock agree on the hour', () => {
  if (!hasJerusalemTimeZone()) return;
  for (const when of [PAST_MIDNIGHT, MEETING_INSTANT, new Date('2026-10-18T13:05:00Z')]) {
    assert.equal(lot.localHour(when), lot.lotHour(when), when.toISOString());
  }
});

test('the lot is not empty just after midnight', () => {
  if (!hasJerusalemTimeZone()) return;
  const live = lot.liveSnapshot(PAST_MIDNIGHT, lot.DEFAULT);
  // The night floor is 12% of 18 bays, so two cars are still parked. Before the
  // fix this snapshot came back 0 occupied / 18 free / 0%.
  assert.equal(live.hour, 0);
  assert.deepEqual(
    { occupied: live.occupied, free: live.free },
    { occupied: lot.stateAt(0, lot.DEFAULT).occupied, free: lot.stateAt(0, lot.DEFAULT).free },
  );
  assert.ok(live.occupied > 0, 'night floor keeps some bays taken');
  assert.ok(live.bays.some(Boolean), 'the plan view shows those bays as taken');
});

test('localHour honours an explicit time zone and survives junk input', () => {
  if (hasJerusalemTimeZone()) assert.equal(lot.localHour(PAST_MIDNIGHT, 'UTC'), 21);
  for (const bad of [new Date('nope'), 'not a date', NaN, undefined, null, {}]) {
    const h = lot.localHour(bad);
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 23, String(bad) + ' -> ' + h);
  }
});

test('localHour falls back to host local time when the runtime has no Intl', () => {
  const savedIntl = globalThis.Intl;
  const savedGlobal = globalThis.ParkWizAtidimLot;
  delete require.cache[MODULE_ID];
  try {
    delete globalThis.Intl;
    const noIntl = require('../src/lib/atidim-lot');
    assert.equal(noIntl.localHour(MEETING_INSTANT), MEETING_INSTANT.getHours());
    // Still a usable snapshot, which is the whole point of the fallback.
    assert.equal(noIntl.liveSnapshot(MEETING_INSTANT, noIntl.DEFAULT).hour, MEETING_INSTANT.getHours());
  } finally {
    globalThis.Intl = savedIntl;
    delete require.cache[MODULE_ID];
    require('../src/lib/atidim-lot');
    globalThis.ParkWizAtidimLot = savedGlobal;
  }
});
