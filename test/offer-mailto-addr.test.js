const test = require('node:test');
const assert = require('node:assert/strict');
const offer = require('../src/lib/offer.js');

test('mailto address cannot smuggle extra headers', () => {
  const href = offer.mailtoHref('a@b.com?bcc=spy@x.com', 'S', 'B');
  assert.equal(href, 'mailto:a@b.com%3Fbcc=spy@x.com?subject=S&body=B');
  assert.equal(href.split('?').length, 2);
});

test('mailto address encodes & # % and leaves plain addresses alone', () => {
  assert.equal(offer.mailtoHref('r&d#1%@city.il'), 'mailto:r%26d%231%25@city.il');
  assert.equal(offer.mailtoHref(' info@netanya.muni.il '), 'mailto:info@netanya.muni.il');
});
