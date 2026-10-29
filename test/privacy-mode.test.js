// The privacy-mode lock (#281). Pixel destruction is a later slice; what this
// file pins is the rule the operator UI is built on: privacy mode starts on,
// and outside a dev host it cannot be turned off.
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/lib/redact.js');

function mode(hostname, protocol) {
  return R.createPrivacyMode({ hostname, protocol: protocol || 'https:' });
}

test('an unknown environment is production and stays on', () => {
  for (const env of [null, undefined, {}, { hostname: '' }, { hostname: 'swissystem7.github.io' }]) {
    const privacy = R.createPrivacyMode(env);
    assert.equal(privacy.locked, true, JSON.stringify(env));
    assert.equal(privacy.enabled, true);
    assert.equal(privacy.setEnabled(false), true);
    assert.equal(privacy.toggle(), true);
    assert.equal(privacy.enabled, true);
    assert.equal(privacy.labelHe(), 'מצב פרטיות פועל — נעול בבילד ייצור');
    assert.equal(privacy.labelEn(), 'Privacy mode ON — locked in production');
  }
});

test('a dev host can turn privacy mode off and back on', () => {
  for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '0.0.0.0', '::1', 'park.local']) {
    const privacy = mode(host);
    assert.equal(privacy.locked, false, host);
    assert.equal(privacy.enabled, true);
    assert.equal(privacy.labelHe(), 'מצב פרטיות פועל');
    assert.equal(privacy.labelEn(), 'Privacy mode ON');
    assert.equal(privacy.toggle(), false);
    assert.equal(privacy.enabled, false);
    assert.equal(privacy.labelHe(), 'מצב פרטיות כבוי — פיתוח בלבד');
    assert.equal(privacy.labelEn(), 'Privacy mode OFF — development only');
    assert.equal(privacy.setEnabled(true), true);
    assert.equal(privacy.enabled, true);
  }
});

test('a file opened off a USB stick is a dev host even with an empty name', () => {
  assert.equal(R.isDevHost('', 'file:'), true);
  assert.equal(R.isDevHost('github.io', 'file:'), true);
  const privacy = R.createPrivacyMode({ hostname: '', protocol: 'file:' });
  assert.equal(privacy.locked, false);
  assert.equal(privacy.toggle(), false);
});

test('lookalike hosts stay locked', () => {
  for (const host of ['localhost.evil.com', 'evil.localhost', 'notlocalhost', 'local', 'github.io']) {
    assert.equal(R.isDevHost(host, 'https:'), false, host);
    assert.equal(mode(host).locked, true, host);
  }
});

test('a destructured toggle still honours the lock', () => {
  const production = mode('park.example');
  const { toggle } = production;
  assert.equal(toggle(), true);
  assert.equal(production.enabled, true);

  const dev = mode('localhost');
  const flip = dev.toggle;
  assert.equal(flip(), false);
  assert.equal(dev.enabled, false);
  assert.equal(flip(), true);
  assert.equal(dev.enabled, true);
});
