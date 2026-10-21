// ParkWiz — the edge bridge core (#266): Frigate MQTT in, ParkWiz JSON out.
//
// On site there is a mini PC running Frigate (vehicle detection on the park's
// own RTSP streams, one zone per bay) and go2rtc (RTSP -> WebRTC for the
// browser view). This module is the decision half of the bridge between that
// box and the ParkWiz page: MQTT topic + payload in, the ParkWiz wire message
// `{lot, spotId, occupied, ts}` out, plus the `spot-freed` event the epic
// hangs off and the camera-health warnings an operator has to see.
//
// It is deliberately a pure library: no MQTT client, no HTTP server, no
// sockets. The runtime process (edge/bridge, a later PR) owns the transport;
// everything that can be wrong — which topic means which bay, when a flicker
// is real, when a stream is dead or frozen, what may leave the site — is
// decided here so it is testable in plain node, with no broker and no camera.
//
// Two rules are structural rather than promised:
//   * No pixels. Frigate's `snapshot`/`clip`/`thumbnail` topics carry images;
//     they are classified and refused here, so an image cannot reach a
//     ParkWiz client even if someone subscribes to `frigate/#`.
//   * No credentials. RTSP users live in edge/.env on the box. Nothing in a
//     published message, and nothing in a bridge URL (normalizeBridgeUrl
//     rejects a URL carrying userinfo).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizEdgeBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FRIGATE_PREFIX = 'frigate';
  // Frigate counts objects per class. These are the classes that can occupy a
  // bay; 'person' is deliberately absent, as in src/lib/vision-occupancy.js.
  const VEHICLE_OBJECTS = Object.freeze(['car', 'truck', 'bus', 'motorcycle']);
  // Topic leaves that carry an image or a video payload. Never forwarded.
  const IMAGE_LEAVES = Object.freeze(['snapshot', 'clip', 'thumbnail', 'image']);
  // The acceptance bar of #266: a real occupancy change must be on the page
  // within ~2s. The only delay this library adds is the flicker hold, so the
  // hold is clamped well under the bar and the rest of the budget is left to
  // the broker, the socket and the render.
  const MAX_PUBLISH_LATENCY_MS = 2000;
  const DEFAULT_HOLD_MS = 700;
  const MAX_HOLD_MS = 1500;
  // No stats from Frigate for this long and the camera is treated as down:
  // Frigate publishes stats every ~5s, so 15s is three missed beats.
  const DEFAULT_OFFLINE_MS = 15000;
  // Frames arriving but nothing moving for this long is the signature of a
  // frozen RTSP stream (the decoder happily re-serves one stale frame).
  const DEFAULT_FROZEN_MS = 120000;
  // Keys a ParkWiz client may ever see. A whitelist, not a blacklist: a future
  // Frigate field cannot leak by being forgotten here.
  const MESSAGE_KEYS = Object.freeze([
    'type', 'lot', 'spotId', 'camera', 'occupied', 'ts', 'state', 'ok', 'warningHe', 'spots', 'health',
  ]);

  function str(v) {
    return v === undefined || v === null ? '' : String(v);
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // Frigate topics are `frigate/<name>/<leaf...>`, where <name> is a camera or
  // a zone and the two cannot be told apart from the string alone — that is
  // the bridge's job, against its own config. This only splits and flags the
  // well-known shapes, including the image ones it must refuse.
  function parseTopic(topic) {
    const parts = str(topic).split('/').filter((p) => p !== '');
    if (parts.length < 2 || parts[0] !== FRIGATE_PREFIX) return { kind: 'unknown' };
    const name = parts[1];
    const leaf = parts.length > 2 ? parts[parts.length - 1] : '';
    if (parts.length === 2) {
      if (name === 'available') return { kind: 'available' };
      if (name === 'stats') return { kind: 'stats' };
      if (name === 'events' || name === 'reviews') return { kind: 'events' };
      return { kind: 'unknown', name };
    }
    if (IMAGE_LEAVES.indexOf(leaf) >= 0) return { kind: 'image', name, leaf };
    if (leaf === 'motion') return { kind: 'motion', name };
    // `frigate/<name>/<object>` and `frigate/<name>/<object>/active` are both
    // counts; the `/active` variant excludes stationary cars, which is exactly
    // wrong for parking, so it is ignored rather than counted.
    if (parts.length === 3) return { kind: 'count', name, object: leaf };
    return { kind: 'unknown', name, leaf };
  }

  // One config object is the single source of truth for which Frigate zone is
  // which ParkWiz bay — edge/bridge/config.example.json on the box, and the
  // same zone names in edge/frigate/config.yml.
  function normalizeConfig(raw) {
    const o = raw && typeof raw === 'object' ? raw : {};
    const cameras = [];
    const zones = {};
    for (const cam of Array.isArray(o.cameras) ? o.cameras : []) {
      const name = str(cam && cam.name).trim();
      if (!name) continue;
      const map = {};
      const src = cam && cam.zones && typeof cam.zones === 'object' ? cam.zones : {};
      for (const zone of Object.keys(src)) {
        const spotId = str(src[zone]).trim();
        if (!zone.trim() || !spotId) continue;
        map[zone.trim()] = spotId;
        zones[zone.trim()] = { camera: name, spotId };
      }
      cameras.push({ name, zones: map });
    }
    return {
      lot: str(o.lot).trim() || 'atidim',
      // A hold of 0 is legitimate (a lab run with a clean stream), so only an
      // out-of-range value falls back to the default.
      holdMs: Math.max(0, Math.min(MAX_HOLD_MS, num(o.holdMs, DEFAULT_HOLD_MS))),
      offlineAfterMs: Math.max(1000, num(o.offlineAfterMs, DEFAULT_OFFLINE_MS)),
      frozenAfterMs: Math.max(5000, num(o.frozenAfterMs, DEFAULT_FROZEN_MS)),
      objects: (Array.isArray(o.objects) && o.objects.length ? o.objects : VEHICLE_OBJECTS).map(str),
      cameras,
      zones,
    };
  }

  // Everything published to a client passes through here, so an image, a plate
  // or a camera credential cannot ride along on an unexpected key.
  function sanitizeMessage(msg) {
    const o = msg && typeof msg === 'object' ? msg : {};
    const out = {};
    for (const key of MESSAGE_KEYS) {
      if (o[key] !== undefined) out[key] = o[key];
    }
    return out;
  }

  function isoAt(atMs) {
    const n = num(atMs, Date.now());
    return new Date(n).toISOString();
  }

  // The bridge: fold MQTT traffic into per-bay state, report the transitions
  // and the health changes that are due. onMessage/tick are the only movers,
  // and both return the messages to publish — the caller never guesses.
  function createBridge(rawConfig) {
    const config = normalizeConfig(rawConfig);
    const spots = new Map();   // spotId -> {spotId, camera, occupied, ts}
    const cams = new Map();    // camera -> health record
    const pending = new Map(); // spotId -> {occupied, since}
    let refusedImages = 0;
    let frigateUp = true;

    for (const cam of config.cameras) {
      cams.set(cam.name, {
        camera: cam.name, state: 'ok', fps: null,
        lastStatsAt: null, lastActivityAt: null, reported: 'ok',
      });
      for (const zone of Object.keys(cam.zones)) {
        const spotId = cam.zones[zone];
        spots.set(spotId, { spotId, camera: cam.name, occupied: false, ts: null });
      }
    }

    function camOf(name) {
      if (!cams.has(name)) {
        cams.set(name, {
          camera: name, state: 'ok', fps: null,
          lastStatsAt: null, lastActivityAt: null, reported: 'ok',
        });
      }
      return cams.get(name);
    }

    function warningFor(rec) {
      if (rec.state === 'offline') return 'מצלמה ' + rec.camera + ' לא מדווחת — התפוסה אינה מתעדכנת';
      if (rec.state === 'frozen') return 'ייתכן שהתמונה ממצלמה ' + rec.camera + ' קפואה — אין שינוי זמן רב';
      return '';
    }

    function healthMessage(rec, atMs) {
      return sanitizeMessage({
        type: 'health',
        lot: config.lot,
        camera: rec.camera,
        state: rec.state,
        ok: rec.state === 'ok',
        warningHe: warningFor(rec),
        ts: isoAt(atMs),
      });
    }

    // A health message is only published when the state actually changes, so a
    // camera that is down for an hour does not fill the operator's log.
    function flushHealth(atMs, out) {
      for (const rec of cams.values()) {
        if (rec.state === rec.reported) continue;
        rec.reported = rec.state;
        out.push(healthMessage(rec, atMs));
      }
      return out;
    }

    function setOccupied(spotId, occupied, atMs, out) {
      const spot = spots.get(spotId);
      if (!spot) return out;
      const was = spot.occupied;
      spot.occupied = occupied;
      spot.ts = isoAt(atMs);
      out.push(sanitizeMessage({
        type: 'spot', lot: config.lot, spotId, camera: spot.camera,
        occupied, ts: spot.ts,
      }));
      // occupied -> free is the event the rest of ParkWiz listens for; it is
      // emitted once per real freeing, after the hold, never on a flicker.
      if (was && !occupied) {
        out.push(sanitizeMessage({
          type: 'spot-freed', lot: config.lot, spotId, camera: spot.camera, ts: spot.ts,
        }));
      }
      return out;
    }

    function noteZone(zone, payload, atMs, out) {
      const target = config.zones[zone];
      if (!target) return out;
      camOf(target.camera).lastActivityAt = num(atMs, Date.now());
      const count = num(payload, NaN);
      if (!Number.isFinite(count)) return out;
      const occupied = count >= 1;
      const spot = spots.get(target.spotId);
      if (!spot) return out;
      if (spot.occupied === occupied) {
        pending.delete(target.spotId);
        return out;
      }
      if (config.holdMs <= 0) return setOccupied(target.spotId, occupied, atMs, out);
      const held = pending.get(target.spotId);
      if (!held || held.occupied !== occupied) {
        pending.set(target.spotId, { occupied, since: num(atMs, Date.now()) });
      }
      return out;
    }

    function noteStats(stats, atMs, out) {
      const byCam = stats && typeof stats === 'object' && stats.cameras && typeof stats.cameras === 'object'
        ? stats.cameras
        : {};
      const now = num(atMs, Date.now());
      for (const name of Object.keys(byCam)) {
        const rec = camOf(name);
        const fps = num(byCam[name] && byCam[name].camera_fps, 0);
        rec.fps = fps;
        rec.lastStatsAt = now;
        // No frames at all is a dead stream, whatever else the box reports.
        if (fps <= 0) rec.state = 'offline';
        else if (rec.state === 'offline') rec.state = 'ok';
      }
      return flushHealth(now, out);
    }

    function onMessage(topic, payload, atMs) {
      const out = [];
      const t = parseTopic(topic);
      if (t.kind === 'image') { refusedImages += 1; return out; }
      if (t.kind === 'available') {
        frigateUp = str(payload).trim().toLowerCase() === 'online';
        for (const rec of cams.values()) {
          if (!frigateUp) rec.state = 'offline';
          else if (rec.state === 'offline') rec.state = 'ok';
        }
        return flushHealth(atMs, out);
      }
      if (t.kind === 'stats') {
        let stats = payload;
        if (typeof stats === 'string') {
          try { stats = JSON.parse(stats); } catch (err) { return out; }
        }
        return noteStats(stats, atMs, out);
      }
      if (t.kind === 'motion') {
        camOf(t.name).lastActivityAt = num(atMs, Date.now());
        return out;
      }
      if (t.kind === 'count') {
        if (config.objects.indexOf(t.object) < 0) return out;
        if (config.zones[t.name]) return noteZone(t.name, payload, atMs, out);
        // A camera-level count is not occupancy (one count, many bays), but it
        // is proof the stream is alive — which is what tells frozen from dead.
        if (cams.has(t.name)) camOf(t.name).lastActivityAt = num(atMs, Date.now());
        return out;
      }
      return out;
    }

    // Called on a timer by the runtime. Releases holds that have matured and
    // ages cameras into offline/frozen — both need the clock, not a message.
    function tick(atMs) {
      const now = num(atMs, Date.now());
      const out = [];
      for (const [spotId, held] of Array.from(pending.entries())) {
        if (now - held.since < config.holdMs) continue;
        pending.delete(spotId);
        setOccupied(spotId, held.occupied, now, out);
      }
      for (const rec of cams.values()) {
        if (rec.state === 'offline' && (!frigateUp || rec.fps === 0)) continue;
        if (rec.lastStatsAt != null && now - rec.lastStatsAt > config.offlineAfterMs) {
          rec.state = 'offline';
        } else if (rec.lastActivityAt != null && now - rec.lastActivityAt > config.frozenAfterMs) {
          rec.state = 'frozen';
        } else if (rec.state !== 'offline') {
          rec.state = 'ok';
        }
      }
      return flushHealth(now, out);
    }

    // What a client gets the moment it connects, so a page opened mid-session
    // shows the lot as it is instead of waiting for the next change.
    function snapshot(atMs) {
      return sanitizeMessage({
        type: 'snapshot',
        lot: config.lot,
        ts: isoAt(atMs),
        spots: Array.from(spots.values()).map((s) => ({
          spotId: s.spotId, camera: s.camera, occupied: s.occupied, ts: s.ts,
        })),
        health: Array.from(cams.values()).map((rec) => ({
          camera: rec.camera, state: rec.state, ok: rec.state === 'ok', warningHe: warningFor(rec),
        })),
      });
    }

    return {
      config, onMessage, tick, snapshot,
      refusedImages: () => refusedImages,
      // The latency this library can add, for the runtime to budget against.
      maxLatencyMs: () => config.holdMs,
    };
  }

  // ---- client side (the ParkWiz page) ----------------------------------

  // The page trusts nothing from the wire: a message is JSON, of a known type,
  // and is reduced to the whitelisted keys before it touches the UI state.
  function parseFeedMessage(raw) {
    let msg = raw;
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); } catch (err) { return null; }
    }
    if (!msg || typeof msg !== 'object') return null;
    const type = str(msg.type);
    if (['spot', 'spot-freed', 'health', 'snapshot'].indexOf(type) < 0) return null;
    const out = sanitizeMessage(msg);
    out.type = type;
    if (type === 'spot' || type === 'spot-freed') {
      if (!str(out.spotId)) return null;
      out.spotId = str(out.spotId);
      if (type === 'spot') out.occupied = out.occupied === true || out.occupied === 'true';
    }
    return out;
  }

  // Fold one message into the page's live state. Returns a new object so a
  // render can diff cheaply; `freed` carries the bays to animate this frame.
  function applyMessage(state, msg, atMs) {
    const prev = state && typeof state === 'object' ? state : {};
    const was = prev.lastMessageAt != null ? prev.lastMessageAt : null;
    const next = {
      lot: prev.lot || '',
      spots: Object.assign({}, prev.spots),
      health: Object.assign({}, prev.health),
      lastMessageAt: num(atMs, was != null ? was : Date.now()),
      freed: [],
    };
    const m = parseFeedMessage(msg);
    // A message the page could not parse is not a heartbeat: leaving
    // lastMessageAt untouched is what lets shouldFallback() notice a bridge
    // that is connected but has stopped saying anything meaningful.
    if (!m) { next.lastMessageAt = was; return next; }
    if (m.lot) next.lot = str(m.lot);
    if (m.type === 'snapshot') {
      next.spots = {};
      for (const s of Array.isArray(m.spots) ? m.spots : []) {
        if (!s || !str(s.spotId)) continue;
        next.spots[str(s.spotId)] = { spotId: str(s.spotId), occupied: s.occupied === true, ts: str(s.ts) };
      }
      next.health = {};
      for (const h of Array.isArray(m.health) ? m.health : []) {
        if (!h || !str(h.camera)) continue;
        next.health[str(h.camera)] = { camera: str(h.camera), state: str(h.state), ok: h.ok === true, warningHe: str(h.warningHe) };
      }
    } else if (m.type === 'spot') {
      next.spots[m.spotId] = { spotId: m.spotId, occupied: m.occupied === true, ts: str(m.ts) };
    } else if (m.type === 'spot-freed') {
      next.spots[m.spotId] = { spotId: m.spotId, occupied: false, ts: str(m.ts), freedAt: str(m.ts) };
      next.freed = [m.spotId];
    } else if (m.type === 'health') {
      const camera = str(m.camera);
      if (camera) {
        next.health[camera] = { camera, state: str(m.state), ok: m.ok === true, warningHe: str(m.warningHe) };
      }
    }
    return next;
  }

  // Hebrew warnings for every unhealthy camera, in one list the UI can render
  // straight into a status region (#266 item 4).
  function healthWarnings(state) {
    const health = state && state.health && typeof state.health === 'object' ? state.health : {};
    const out = [];
    for (const key of Object.keys(health)) {
      const rec = health[key] || {};
      if (rec.ok === true) continue;
      out.push(str(rec.warningHe) || 'בעיה במצלמה ' + str(rec.camera));
    }
    return out;
  }

  // Whether the page must fall back to in-browser detection (#264). A bridge
  // that is configured but silent is worse than no bridge, because the screen
  // would keep showing a stale lot as if it were live — so silence falls back.
  function shouldFallback(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const staleAfterMs = Math.max(MAX_PUBLISH_LATENCY_MS, num(o.staleAfterMs, 10000));
    if (!str(o.url)) return { fallback: true, reason: 'no-bridge' };
    if (o.connected !== true) return { fallback: true, reason: 'disconnected' };
    const last = num(o.lastMessageAt, NaN);
    const now = num(o.now, Date.now());
    if (!Number.isFinite(last)) return { fallback: false, reason: 'awaiting-first-message' };
    if (now - last > staleAfterMs) return { fallback: true, reason: 'stale' };
    return { fallback: false, reason: 'live' };
  }

  // A bridge URL is operator-typed, so it is validated rather than trusted.
  // Credentials in the URL are refused outright: the one secret on this box is
  // the RTSP user, and it must never travel in a setting a browser persists.
  function normalizeBridgeUrl(value) {
    const raw = str(value).trim();
    if (!raw) return { ok: false, error: 'חסרה כתובת גשר' };
    let u;
    try { u = new URL(raw); } catch (err) { return { ok: false, error: 'כתובת לא תקינה' }; }
    if (['http:', 'https:', 'ws:', 'wss:'].indexOf(u.protocol) < 0) {
      return { ok: false, error: 'נדרשת כתובת http/ws' };
    }
    if (u.username || u.password) return { ok: false, error: 'אין להכניס סיסמה לכתובת' };
    const secure = u.protocol === 'https:' || u.protocol === 'wss:';
    const base = u.host + (u.pathname === '/' ? '' : u.pathname.replace(/\/$/, ''));
    return {
      ok: true,
      url: (secure ? 'https://' : 'http://') + base,
      sseUrl: (secure ? 'https://' : 'http://') + base + '/events',
      wsUrl: (secure ? 'wss://' : 'ws://') + base + '/ws',
    };
  }

  return {
    FRIGATE_PREFIX, VEHICLE_OBJECTS, IMAGE_LEAVES, MESSAGE_KEYS,
    MAX_PUBLISH_LATENCY_MS, DEFAULT_HOLD_MS, MAX_HOLD_MS,
    DEFAULT_OFFLINE_MS, DEFAULT_FROZEN_MS,
    parseTopic, normalizeConfig, sanitizeMessage, createBridge,
    parseFeedMessage, applyMessage, healthWarnings, shouldFallback, normalizeBridgeUrl,
  };
});
