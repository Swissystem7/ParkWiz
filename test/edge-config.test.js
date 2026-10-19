// The edge stack is configuration, and configuration is exactly what rots
// between the repo and a mini PC in a parking garage. Two things are pinned
// here because getting them wrong is silent on the box: a zone name that no
// longer maps to a bay (the stall just never updates), and a secret or an
// inbound port that sneaks into a template someone copies verbatim.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EB = require('../src/lib/edge-bridge');

const root = path.join(__dirname, '..');
const edge = path.join(root, 'edge');
const read = (...p) => fs.readFileSync(path.join(edge, ...p), 'utf8');
const compose = read('docker-compose.yml');
const frigate = read('frigate', 'config.yml');
const go2rtc = read('go2rtc', 'go2rtc.yaml');
const mosquitto = read('mosquitto', 'mosquitto.conf');
const envExample = read('.env.example');
const bridgeConfig = JSON.parse(read('bridge', 'config.example.json'));
const doc = fs.readFileSync(path.join(root, 'docs', 'edge-setup-he.md'), 'utf8');

// Frigate's zone names are the join key with the bridge. Pulling them out of
// the YAML by hand keeps this repo at zero dependencies.
function frigateZones(yaml) {
  const block = yaml.slice(yaml.indexOf('    zones:'));
  const out = [];
  for (const line of block.split('\n')) {
    const m = /^      ([a-z0-9_]+):\s*$/.exec(line);
    if (m) out.push(m[1]);
    if (/^cameras:|^# RTSP/.test(line)) break;
  }
  return out;
}

test('every Frigate zone maps to exactly one ParkWiz bay, and back', () => {
  const zones = frigateZones(frigate);
  assert.ok(zones.length >= 3, 'the template must ship a worked multi-bay example');
  const cfg = EB.normalizeConfig(bridgeConfig);
  assert.deepEqual(zones.slice().sort(), Object.keys(cfg.zones).sort());
  const bays = zones.map((z) => cfg.zones[z].spotId);
  assert.deepEqual(bays, Array.from(new Set(bays)), 'two zones cannot share one bay');
  // The lot-prefixed zone convention is what lets one box serve two lots.
  for (const zone of zones) assert.ok(zone.startsWith(cfg.lot + '_'), zone);
  // The camera in the bridge config is the camera Frigate actually defines.
  for (const cam of cfg.cameras) assert.match(frigate, new RegExp('\\n  ' + cam.name + ':'));
});

test('the bridge config stays inside the publish budget of #266', () => {
  const cfg = EB.normalizeConfig(bridgeConfig);
  assert.ok(cfg.holdMs <= EB.MAX_HOLD_MS, 'hold must leave room under the ~2s bar');
  assert.ok(cfg.offlineAfterMs >= 15000, 'Frigate stats arrive every ~5s; do not alarm on one');
  assert.deepEqual(cfg.objects, ['car', 'truck', 'bus', 'motorcycle']);
  // A person walking the aisle is not an occupied bay.
  assert.equal(cfg.objects.indexOf('person'), -1);
});

test('no secret is committed anywhere under edge/', () => {
  assert.equal(fs.existsSync(path.join(edge, '.env')), false, 'edge/.env must never be committed');
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /^\.env$/m);
  for (const [name, text] of [
    ['docker-compose.yml', compose], ['frigate/config.yml', frigate],
    ['go2rtc.yaml', go2rtc], ['bridge config', JSON.stringify(bridgeConfig)],
  ]) {
    // Credentials only ever appear as a placeholder or an env reference.
    assert.doesNotMatch(text, /rtsp:\/\/[^\s'"$<{]+:[^\s'"$<{@]+@/, name);
    assert.doesNotMatch(text, /(password|passwd|secret)\s*[:=]\s*["']?[^\s"'#${<]+/i, name);
  }
  // Every value in .env.example is empty or an obvious non-secret default.
  for (const line of envExample.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [key, value] = line.split('=');
    if (/PASSWORD/.test(key)) assert.equal(value, '', key + ' must ship empty');
  }
  assert.match(envExample, /chmod 600/);
});

test('go2rtc holds the only camera credentials, and only by reference', () => {
  assert.match(go2rtc, /\$\{CAM_USER\}:\$\{CAM_PASSWORD\}@\$\{CAM_HOST\}/);
  // Both brands the pilot will actually meet are documented somewhere.
  assert.match(frigate, /Streaming\/Channels\/101/);
  assert.match(frigate, /cam\/realmonitor\?channel=1&subtype=0/);
  assert.match(go2rtc, /subtype=1/);
  // Frigate reads the restream rather than opening a second camera session.
  assert.match(frigate, /rtsp:\/\/127\.0\.0\.1:8554\//);
  // The looped-sample acceptance rig of #266 ships with the template.
  assert.match(go2rtc, /stream_loop -1/);
  assert.match(go2rtc, /\{output\}/);
  // No cloud relay for WebRTC: no STUN/TURN server is configured.
  assert.doesNotMatch(go2rtc, /stun:|turn:/);
});

test('nothing in the stack is reachable from the internet', () => {
  // Frigate's UI is bound to the box itself, not 0.0.0.0.
  assert.match(compose, /"127\.0\.0\.1:5000:5000"/);
  assert.doesNotMatch(compose, /^\s+- "5000:5000"/m);
  // The broker publishes no port at all.
  const mqttBlock = compose.slice(compose.indexOf('mosquitto:'), compose.indexOf('go2rtc:'));
  assert.doesNotMatch(mqttBlock, /^\s+ports:/m);
  assert.doesNotMatch(mosquitto, /listener\s+1883\s+0\.0\.0\.0/);
  assert.match(mosquitto, /allow_anonymous true/);
  // Images pinned: a silently-upgraded detector is a silently-changed pilot.
  for (const image of [/eclipse-mosquitto:2\.\d+\.\d+/, /go2rtc:1\.\d+\.\d+/, /frigate:0\.\d+\.\d+/]) {
    assert.match(compose, image);
  }
  assert.doesNotMatch(compose, /image:.*:latest/);
});

test('recording and snapshots are off, so no video accumulates on site', () => {
  assert.match(frigate, /snapshots:\n\s+enabled: false/);
  assert.match(frigate, /record:\n\s+enabled: false/);
  assert.doesNotMatch(frigate, /- person/);
  // Motion is published because it is how the bridge tells frozen from dead.
  assert.match(frigate, /mqtt_off_delay/);
  assert.match(frigate, /stats_interval/);
});

test('the Hebrew setup guide stays a usable on-site runbook', () => {
  assert.match(doc, /^# התקנת קופסת הקצה של ParkWiz/m);
  for (const heading of [
    '## 1. מה צריך',
    '## 2. התקנה',
    '## 3. סימון החניות',
    '## 4. הגשר',
    '## 5. בריאות המצלמה',
    '## 6. בדיקת קבלה בלי מצלמה באתר',
    "## 7. צ'ק-ליסט ל-IT של החניון",
    '## 8. פרטיות',
  ]) {
    assert.ok(doc.indexOf(heading) >= 0, 'missing section: ' + heading);
  }
  // The three IT conditions of #266, each as a checklist item.
  assert.match(doc, /- \[ \] \*\*משתמש RTSP לקריאה בלבד\*\*/);
  assert.match(doc, /- \[ \] \*\*אין פתיחת פורט נכנס מהאינטרנט\*\*/);
  assert.match(doc, /- \[ \] \*\*הווידאו לא יוצא מהאתר\.\*\*/);
  // It must point at the real files, so a reader can follow it with the repo.
  for (const ref of ['edge/.env', 'edge/frigate/config.yml', 'edge/bridge/config.json', 'src/lib/edge-bridge.js']) {
    assert.ok(doc.indexOf(ref) >= 0, 'guide does not mention ' + ref);
  }
  // The acceptance bar and the fallback are both written down, in Hebrew.
  assert.match(doc, /כ-2 שניות/);
  assert.match(doc, /#264/);
  assert.match(doc, /אין זיהוי מספרי רישוי/);
  // A guide that leaks a password is worse than no guide.
  assert.doesNotMatch(doc, /rtsp:\/\/[^\s'"$<{]+:[^\s'"$<{@]+@/);
});
