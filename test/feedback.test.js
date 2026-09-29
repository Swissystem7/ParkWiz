const test = require('node:test');
const assert = require('node:assert');

test('feedback module exports a function returning the feedback form URL', () => {
  let getFeedbackUrl;
  try {
    getFeedbackUrl = require('../src/lib/feedback');
  } catch {
    getFeedbackUrl = null;
  }

  assert.strictEqual(typeof getFeedbackUrl, 'function');
  const expectedUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=ParkWiz';
  assert.strictEqual(getFeedbackUrl(), expectedUrl);
});
