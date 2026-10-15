// One clock for both views of the Atidim lot.
//
// The camera model (formatLotClock, lotHour) and the demo model (localHour,
// liveSnapshot) both need the hour of day at the lot. They used to each build
// their own Intl.DateTimeFormat, and only the camera one had the fallback for
// runtimes with no IANA zone data and the midnight-reported-as-"24" fix. Both
// now go through lotClockParts, which takes an overridable zone so a demo page
// can honour the zone that came out of demo/atidim-data.json.
// Resolution of PR #184 against master — see docs/dev/PR-184-CONFLICT-RESOLUTION.md.
const test = require('node:test');
const assert = require('node:assert/strict');

const lot = require('../src/lib/atidim-lot');

// 2026-10-19 07:30Z — 10:30 in Jerusalem (IDT, +03:00).
const MORNING = new Date('2026-10-19T07:30:00Z');

test('the demo lot and the camera model name one time zone', () => {
  assert.equal(lot.DEFAULT.timezone, lot.LOT_TIME_ZONE);
  assert.equal(lot.localHour(MORNING, lot.DEFAULT.timezone), lot.lotHour(MORNING));
});

test('lotClockParts honours an overridden zone and defaults to the lot', () => {
  const at = (zone) => lot.localHour(MORNING, zone);
  assert.equal(at(undefined), 10, 'no zone given — the lot\'s own');
  assert.equal(at(lot.LOT_TIME_ZONE), 10);
  assert.equal(at('UTC'), 7);
  assert.equal(at('America/New_York'), 3);
  // The camera clock still reads the lot's own zone, override or not.
  assert.equal(lot.formatLotClock(MORNING), '2026-10-19 10:30:00');
});

test('localHour follows the zone a site config asked for', () => {
  const abroad = { ...lot.DEFAULT, timezone: 'UTC' };
  assert.equal(lot.liveSnapshot(MORNING, abroad).hour, 7);
  assert.deepEqual(lot.liveSnapshot(MORNING, abroad).bays, lot.snapshotAt(7, abroad).bays);
  // The lot's own zone is still three hours ahead of that.
  assert.equal(lot.liveSnapshot(MORNING, lot.DEFAULT).hour, 10);
});

test('midnight is hour 0, never 24, in every zone', () => {
  // 2026-10-18 21:00Z is 00:00 the next day in Jerusalem.
  const midnight = new Date('2026-10-18T21:00:00Z');
  assert.equal(lot.localHour(midnight, lot.DEFAULT.timezone), 0);
  assert.equal(lot.localHour(new Date('2026-10-19T00:00:00Z'), 'UTC'), 0);
  // Hour 0 is a real hour of the curve, so the snapshot must be the quiet one.
  assert.equal(lot.liveSnapshot(midnight, lot.DEFAULT).hour, 0);
  assert.ok(lot.liveSnapshot(midnight, lot.DEFAULT).occupied < lot.stateAt(10, lot.DEFAULT).occupied);
});

test('an unusable zone falls back to host local time instead of throwing', () => {
  // Stands in for a runtime with no IANA zone data: Intl rejects the zone the
  // same way a --without-intl build rejects every zone.
  const h = lot.localHour(MORNING, 'Not/AZone');
  assert.equal(h, MORNING.getHours(), 'host local hour');
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 23);
  assert.doesNotThrow(() => lot.liveSnapshot(MORNING, { ...lot.DEFAULT, timezone: 'Not/AZone' }));
});

test('a bad clock input is hour 0, not NaN', () => {
  for (const bad of [new Date('nope'), 'not a date', NaN, {}]) {
    assert.equal(lot.localHour(bad, lot.DEFAULT.timezone), 0, String(bad));
  }
  // null and 0 are both epoch, which is a real instant — 02:00 in Jerusalem.
  assert.equal(lot.localHour(null, lot.DEFAULT.timezone), 2);
});

test('the hourly series timestamps stay two-digit and parseable', () => {
  const series = lot.hourlySeries(lot.DEFAULT);
  assert.equal(series.length, 24);
  series.forEach((rec, h) => {
    assert.equal(rec.ts, `2026-10-18T${h < 10 ? '0' + h : h}:00:00`);
    assert.equal(new Date(rec.ts + 'Z').getUTCHours(), h);
  });
});
