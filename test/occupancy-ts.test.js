// Backlog item 5: edge coverage for hourFromTs and weekdayFromTs.
//
// Both functions read what is *written* on the timestamp string. They never
// build a local Date and never consult the machine timezone, so the numbers
// below are the same on any host. Every expected weekday was computed from the
// proleptic Gregorian calendar in a python3 scratch script before the code was
// touched, not read out of the implementation.
//
// One real defect is fixed here and pinned below: weekdayFromTs used to hand
// Date.UTC() a date that does not exist (2026-02-30) and return the weekday of
// whatever day it rolled forward to. It now returns null.
const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

test('hourFromTs reads the written clock hour for every legal shape', () => {
  assert.equal(occ.hourFromTs('2026-08-12T08:00'), 8);
  assert.equal(occ.hourFromTs('2026-08-12T08:00:00'), 8);
  assert.equal(occ.hourFromTs('2026-08-12T08:00:00+03:00'), 8);
  assert.equal(occ.hourFromTs('2026-08-12T23:15:00Z'), 23);
  assert.equal(occ.hourFromTs('2026-08-12T00:00'), 0);
  assert.equal(occ.hourFromTs('2026-08-12T08'), 8);
});

test('hourFromTs returns null when there is no two-digit hour after a T', () => {
  // no T at all
  assert.equal(occ.hourFromTs('2026-08-12 08:00'), null);
  assert.equal(occ.hourFromTs('2026-08-12'), null);
  // lowercase t is not the ISO designator
  assert.equal(occ.hourFromTs('2026-08-12t08:00'), null);
  // a single-digit hour is not the short ISO form
  assert.equal(occ.hourFromTs('2026-08-12T8:00'), null);
  assert.equal(occ.hourFromTs('bad'), null);
  assert.equal(occ.hourFromTs(''), null);
  assert.equal(occ.hourFromTs(null), null);
  assert.equal(occ.hourFromTs(undefined), null);
  assert.equal(occ.hourFromTs(20260812), null);
});

test('hourFromTs never returns an hour outside 0..23', () => {
  assert.equal(occ.hourFromTs('2026-08-12T24:00'), null);
  assert.equal(occ.hourFromTs('2026-08-12T25:30'), null);
  assert.equal(occ.hourFromTs('2026-08-12T99:00'), null);
  // and nothing in between escapes the range either
  for (let h = 0; h <= 23; h++) {
    const ts = '2026-08-12T' + String(h).padStart(2, '0') + ':00';
    assert.equal(occ.hourFromTs(ts), h);
  }
});

test('hourFromTs reports the clock even when the date part is impossible', () => {
  // Documented split of responsibility: hourFromTs answers "what hour is
  // written", the calendar is normalize()'s and weekdayFromTs's problem.
  assert.equal(occ.hourFromTs('2026-02-30T08:00'), 8);
  assert.equal(occ.weekdayFromTs('2026-02-30T08:00'), null);
});

test('weekdayFromTs returns the Sunday-zero weekday of the written date', () => {
  assert.equal(occ.weekdayFromTs('2026-08-12T08:00:00+03:00'), 3); // Wednesday
  assert.equal(occ.weekdayFromTs('2026-08-12'), 3);
  assert.equal(occ.weekdayFromTs('2026-08-16'), 0); // Sunday
  assert.equal(occ.weekdayFromTs('2026-01-01'), 4);
  assert.equal(occ.weekdayFromTs('1999-12-31'), 5);
});

test('weekdayFromTs returns null for a date that never happened', () => {
  assert.equal(occ.weekdayFromTs('2026-02-30T08:00'), null);
  assert.equal(occ.weekdayFromTs('2026-04-31'), null);
  assert.equal(occ.weekdayFromTs('2026-13-01T08:00'), null);
  assert.equal(occ.weekdayFromTs('2026-00-10'), null);
  assert.equal(occ.weekdayFromTs('2026-08-00'), null);
  assert.equal(occ.weekdayFromTs('2026-08-32'), null);
});

test('weekdayFromTs gets the leap-year rule right in all four cases', () => {
  assert.equal(occ.weekdayFromTs('2024-02-29'), 4); // divisible by 4
  assert.equal(occ.weekdayFromTs('2000-02-29'), 2); // divisible by 400
  assert.equal(occ.weekdayFromTs('1900-02-29'), null); // divisible by 100, not 400
  assert.equal(occ.weekdayFromTs('2026-02-29'), null); // not divisible by 4
  assert.equal(occ.validCalendarDate(2024, 2, 29), true);
  assert.equal(occ.validCalendarDate(2000, 2, 29), true);
  assert.equal(occ.validCalendarDate(1900, 2, 29), false);
  assert.equal(occ.validCalendarDate(2026, 2, 29), false);
});

test('a written year below 100 stays that year instead of jumping to the 1900s', () => {
  // Date.UTC(12, 0, 1) means 1912-01-01, which is a Monday. The written date
  // 0012-01-01 is a Sunday in the proleptic Gregorian calendar.
  assert.equal(occ.weekdayFromTs('0012-01-01'), 0);
  assert.notEqual(occ.weekdayFromTs('0012-01-01'), new Date(Date.UTC(12, 0, 1)).getUTCDay());
});

test('weekdayFromTs returns null when there is no leading ISO date at all', () => {
  assert.equal(occ.weekdayFromTs('2026/08/12'), null);
  assert.equal(occ.weekdayFromTs('12-08-2026'), null);
  assert.equal(occ.weekdayFromTs('T08:00'), null);
  assert.equal(occ.weekdayFromTs('bad'), null);
  assert.equal(occ.weekdayFromTs(''), null);
  assert.equal(occ.weekdayFromTs(null), null);
  assert.equal(occ.weekdayFromTs(undefined), null);
});

test('every weekday weekdayFromTs can return is inside 0..6', () => {
  for (let day = 1; day <= 31; day++) {
    const ts = '2026-08-' + String(day).padStart(2, '0');
    const w = occ.weekdayFromTs(ts);
    assert.ok(Number.isInteger(w) && w >= 0 && w <= 6, ts + ' gave ' + w);
  }
  // August has 31 days, September has 30
  assert.equal(occ.weekdayFromTs('2026-09-31'), null);
});
