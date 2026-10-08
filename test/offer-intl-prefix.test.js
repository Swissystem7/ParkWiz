const test = require('node:test');
const assert = require('node:assert/strict');
const { toIntlPhone, whatsappHref } = require('../src/lib/offer');

test('the 00 international dialing prefix is dropped, not prefixed with 972 again', () => {
  assert.equal(toIntlPhone('00972526333106'), '972526333106');
  assert.equal(toIntlPhone('00 972-52-633-3106'), '972526333106');
});

test('a domestic trunk 0 kept after the country code is dropped', () => {
  assert.equal(toIntlPhone('+972 052-633-3106'), '972526333106');
  assert.equal(toIntlPhone('+972 (0)52 633 3106'), '972526333106');
  assert.equal(toIntlPhone('009720526333106'), '972526333106');
});

test('formats that already worked are unchanged', () => {
  assert.equal(toIntlPhone('0526333106'), '972526333106');
  assert.equal(toIntlPhone('+972526333106'), '972526333106');
  assert.equal(toIntlPhone('526333106'), '972526333106');
  assert.equal(toIntlPhone(''), '');
  assert.equal(whatsappHref('00972526333106', ''), 'https://wa.me/972526333106');
});
