// ParkWiz — labeled synthetic occupancy scenes for evaluation.
//
// These patches are generated in-process. They are not municipal camera
// frames. The evaluator reports agreement against the labels we painted.
// Field accuracy versus a Netanya inspector is still unmeasured.
(function (root, factory) {
  const heu = (typeof module === 'object' && module.exports)
    ? require('./heuristic')
    : root.ParkWizHeuristic;
  const proto = (typeof module === 'object' && module.exports)
    ? require('./protocol')
    : root.ParkWizProtocol;
  const occ = (typeof module === 'object' && module.exports)
    ? require('./occupancy')
    : root.ParkWizOccupancy;
  const api = factory(heu, proto, occ);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizDataset = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (heu, proto, occ) {
  const PATCH_W = 24;
  const PATCH_H = 32;
  const SPOT_COUNT = 12;
  // Same occupancy pattern as pilot/sample-lot.svg
  const MIXED_CARS = Object.freeze([0, 2, 3, 6, 9, 10]);
  const WHITE_CARS = Object.freeze([1, 4]);
  const HARD_CARS = Object.freeze([2, 7, 11]);

  const LIGHTING_GAIN = Object.freeze({
    day: 1,
    dusk: 0.58,
    night: 0.28,
    wet: 0.9,
  });

  function clampByte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function mulRgb(rgb, g) {
    return [clampByte(rgb[0] * g), clampByte(rgb[1] * g), clampByte(rgb[2] * g)];
  }

  function hash32(n) {
    let x = (n + 0x9e3779b9) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  function noiseAt(seed, i) {
    return (hash32(seed * 4096 + i) % 13) - 6;
  }

  function fillRgba(w, h, rgb, seed) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const n = noiseAt(seed, i);
      data[i * 4] = clampByte(rgb[0] + n);
      data[i * 4 + 1] = clampByte(rgb[1] + n);
      data[i * 4 + 2] = clampByte(rgb[2] + n);
      data[i * 4 + 3] = 255;
    }
    return data;
  }

  function paintRect(data, w, h, x0, y0, rw, rh, rgb, seed) {
    const x1 = Math.max(0, Math.min(w, x0 + rw));
    const y1 = Math.max(0, Math.min(h, y0 + rh));
    const xs = Math.max(0, x0);
    const ys = Math.max(0, y0);
    for (let y = ys; y < y1; y++) {
      for (let x = xs; x < x1; x++) {
        const i = (y * w + x);
        const n = noiseAt(seed + 17, i);
        data[i * 4] = clampByte(rgb[0] + n);
        data[i * 4 + 1] = clampByte(rgb[1] + n);
        data[i * 4 + 2] = clampByte(rgb[2] + n);
        data[i * 4 + 3] = 255;
      }
    }
  }

  function asphaltRgb(lighting) {
    const base = [92, 101, 112];
    if (lighting === 'wet') return [78, 88, 102];
    const g = LIGHTING_GAIN[lighting] != null ? LIGHTING_GAIN[lighting] : 1;
    return mulRgb(base, g);
  }

  function carBodyRgb(index, lighting, kind) {
    if (kind === 'white') {
      const pale = [214, 218, 224];
      return lighting === 'night' ? mulRgb(pale, 0.35) : pale;
    }
    const bodies = [
      [28, 31, 40],
      [36, 24, 26],
      [22, 26, 34],
      [26, 34, 32],
      [34, 24, 28],
      [24, 28, 38],
    ];
    const base = bodies[index % bodies.length];
    const g = LIGHTING_GAIN[lighting] != null ? LIGHTING_GAIN[lighting] : 1;
    return mulRgb(base, lighting === 'wet' ? 0.85 : g);
  }

  function paintCar(data, index, lighting, kind) {
    const body = carBodyRgb(index, lighting, kind);
    paintRect(data, PATCH_W, PATCH_H, 2, 3, PATCH_W - 4, PATCH_H - 6, body, 80 + index);
    const windowRgb = lighting === 'night' ? [70, 78, 92] : [46, 53, 68];
    paintRect(data, PATCH_W, PATCH_H, 4, 7, PATCH_W - 8, 8, windowRgb, 180 + index);
    if (lighting === 'night') {
      paintRect(data, PATCH_W, PATCH_H, 4, PATCH_H - 8, 5, 3, [210, 200, 140], 240 + index);
      paintRect(data, PATCH_W, PATCH_H, PATCH_W - 9, PATCH_H - 8, 5, 3, [210, 200, 140], 260 + index);
    }
    if (lighting === 'wet') {
      paintRect(data, PATCH_W, PATCH_H, 6, 16, 8, 3, [170, 176, 186], 300 + index);
    }
  }

  function makePatch(opts) {
    const o = opts || {};
    const lighting = o.lighting || 'day';
    const occupied = !!o.occupied;
    const seed = (o.seed != null ? o.seed : 1) + (o.index || 0) * 31;
    const data = fillRgba(PATCH_W, PATCH_H, asphaltRgb(lighting), seed);
    if (o.kind === 'shadow') {
      paintRect(data, PATCH_W, PATCH_H, 3, 8, PATCH_W - 8, 14, mulRgb(asphaltRgb(lighting), 0.55), 400 + (o.index || 0));
    } else if (o.kind === 'glare') {
      paintRect(data, PATCH_W, PATCH_H, 5, 12, PATCH_W - 10, 4, [188, 194, 204], 420 + (o.index || 0));
    } else if (o.kind === 'tiny') {
      paintRect(data, PATCH_W, PATCH_H, 8, 11, 8, 10, carBodyRgb(o.index || 0, lighting, 'dark'), 440 + (o.index || 0));
    } else if (o.kind === 'camo') {
      const body = mulRgb(asphaltRgb(lighting), 0.88);
      paintRect(data, PATCH_W, PATCH_H, 2, 4, PATCH_W - 4, PATCH_H - 8, body, 460 + (o.index || 0));
      paintRect(data, PATCH_W, PATCH_H, 5, 8, PATCH_W - 10, 5, mulRgb(asphaltRgb(lighting), 0.7), 480 + (o.index || 0));
    } else if (occupied) {
      paintCar(data, o.index || 0, lighting, o.kind || 'dark');
    }
    if (o.gain != null && o.gain !== 1) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clampByte(data[i] * o.gain);
        data[i + 1] = clampByte(data[i + 1] * o.gain);
        data[i + 2] = clampByte(data[i + 2] * o.gain);
      }
    }
    return data;
  }

  function occupiedSet(scene) {
    if (scene === 'empty') return [];
    if (scene === 'full') {
      const all = [];
      for (let i = 0; i < SPOT_COUNT; i++) all.push(i);
      return all;
    }
    if (scene === 'white') return WHITE_CARS.slice();
    if (scene === 'hard') return HARD_CARS.slice();
    if (scene === 'trap') return [];
    return MIXED_CARS.slice();
  }

  function sceneDef(id, lighting, pattern, extra) {
    const occupiedAt = occupiedSet(pattern);
    const x = extra || {};
    return {
      id,
      lighting,
      pattern,
      kind: x.kind || '',
      gain: x.gain != null ? x.gain : 1,
      emptyLighting: x.emptyLighting || lighting,
      note: x.note || '',
      occupiedAt,
    };
  }

  const SCENE_DEFS = Object.freeze([
    sceneDef('day-empty', 'day', 'empty', { note: 'יום, כל המקומות פנויים.' }),
    sceneDef('day-mixed', 'day', 'mixed', { note: 'יום, אותה תבנית כמו sample-lot.svg.' }),
    sceneDef('day-full', 'day', 'full', { note: 'יום, כל המקומות תפוסים.' }),
    sceneDef('dusk-mixed', 'dusk', 'mixed', { note: 'דמדומים, אותם רכבים.' }),
    sceneDef('night-empty', 'night', 'empty', { note: 'לילה ריק — בלי ייחוס v1 מסמן הכול תפוס.' }),
    sceneDef('night-mixed', 'night', 'mixed', { note: 'לילה עם פנסים על רכבים.' }),
    sceneDef('wet-mixed', 'wet', 'mixed', { note: 'רטוב / השתקפות, אותם רכבים.' }),
    sceneDef('day-shifted-empty', 'day', 'empty', {
      gain: 0.55,
      emptyLighting: 'day',
      note: 'אותו מגרש ריק אחרי העננה — הזזת תאורה בלבד.',
    }),
    sceneDef('white-car-day', 'day', 'white', { note: 'רכבים בהירים על אספלט בהיר.' }),
    sceneDef('night-shifted-empty', 'night', 'empty', {
      gain: 0.7,
      emptyLighting: 'night',
      note: 'לילה ריק כהה יותר — בלי רכב.',
    }),
    sceneDef('shadow-false', 'day', 'trap', {
      kind: 'shadow',
      note: 'צל על מקום ריק — מלכודת false-positive.',
    }),
    sceneDef('glare-false', 'wet', 'trap', {
      kind: 'glare',
      note: 'השתקפות על מקום ריק — מלכודת false-positive.',
    }),
    sceneDef('camouflage-day', 'day', 'hard', {
      kind: 'camo',
      note: 'רכב בצבע אספלט כמעט — קשה לחיסור רקע.',
    }),
    sceneDef('tiny-car-day', 'day', 'hard', {
      kind: 'tiny',
      note: 'רכב קטן / חלקי בתוך המלבן.',
    }),
  ]);

  function buildScene(def) {
    const spots = [];
    for (let i = 0; i < SPOT_COUNT; i++) {
      const occupied = def.occupiedAt.indexOf(i) !== -1;
      const kind = def.pattern === 'white' && occupied ? 'white' : 'dark';
      const cur = makePatch({
        lighting: def.lighting === 'wet' ? 'wet' : def.lighting,
        occupied,
        index: i,
        seed: 1000,
        gain: def.gain,
        kind: def.kind || kind,
      });
      const empty = makePatch({
        lighting: def.emptyLighting === 'wet' ? 'wet' : def.emptyLighting,
        occupied: false,
        index: i,
        seed: 2000,
        gain: 1,
        kind: 'dark',
      });
      const emptyNight = makePatch({
        lighting: 'night',
        occupied: false,
        index: i,
        seed: 3000,
        gain: 1,
        kind: 'dark',
      });
      spots.push({
        id: 's' + (i + 1),
        index: i,
        occupied,
        cur,
        empty,
        emptyNight,
      });
    }
    return {
      id: def.id,
      lighting: def.lighting === 'wet' ? 'dusk' : def.lighting,
      lightingLabel: def.lighting,
      pattern: def.pattern,
      note: def.note,
      synthetic: true,
      fieldMeasured: false,
      spots,
    };
  }

  function scenes() {
    return SCENE_DEFS.map(buildScene);
  }

  function manifest() {
    return {
      version: 2,
      kind: 'parkwiz-demo-dataset',
      synthetic: true,
      fieldMeasured: false,
      street: 'הרצל, נתניה',
      note: 'סצנות מסונתזות בריפו. לא צילום עירייה ולא ספירת פקח.',
      patch: { width: PATCH_W, height: PATCH_H, spots: SPOT_COUNT },
      mixedCars: MIXED_CARS.slice(),
      scenes: SCENE_DEFS.map((d) => ({
        id: d.id,
        lighting: d.lighting,
        pattern: d.pattern,
        kind: d.kind || '',
        occupiedAt: d.occupiedAt.slice(),
        note: d.note,
      })),
    };
  }

  function spotItem(spot, useSamples) {
    const curStats = heu.statsFromRgba(spot.cur);
    const emptyStats = heu.statsFromRgba(spot.empty);
    const nightStats = heu.statsFromRgba(spot.emptyNight);
    const item = {
      id: spot.id,
      cur: curStats,
      empty: emptyStats,
      emptyNight: nightStats,
    };
    if (useSamples) {
      item.curSamples = heu.lumaSamples(spot.cur);
      item.emptySamples = heu.lumaSamples(spot.empty);
      item.emptyNightSamples = heu.lumaSamples(spot.emptyNight);
    }
    return item;
  }

  function judgeSpot(spot, predicted) {
    const pred = !!(predicted && predicted.occupied);
    return {
      id: spot.id,
      expected: spot.occupied,
      predicted: pred,
      agree: pred === spot.occupied,
      method: predicted ? predicted.method : 'unknown',
      lighting: predicted ? predicted.lighting : '',
      score: predicted ? predicted.score : 0,
    };
  }

  function evaluateScene(scene, mode) {
    const useSamples = mode !== 'legacy' && mode !== 'normalized';
    const items = scene.spots.map((s) => spotItem(s, useSamples));
    let estimates;
    if (mode === 'legacy') {
      estimates = items.map((it) => {
        const r = heu.estimateOccupiedLegacy(it.cur, it.empty);
        return { id: it.id, ...(r || { occupied: false, method: 'unknown', confidence: 0 }) };
      });
    } else if (mode === 'normalized') {
      estimates = items.map((it) => {
        const r = heu.estimateOccupied(it.cur, it.empty, { lighting: scene.lighting });
        return { id: it.id, ...(r || { occupied: false, method: 'unknown', confidence: 0 }) };
      });
    } else {
      estimates = heu.estimateLot(items, { lighting: scene.lighting }).estimates;
    }
    const judged = scene.spots.map((s, i) => judgeSpot(s, estimates[i]));
    const agree = judged.filter((j) => j.agree).length;
    const n = judged.length;
    return {
      id: scene.id,
      lighting: scene.lightingLabel || scene.lighting,
      note: scene.note,
      n,
      agree,
      rate: n ? agree / n : null,
      method: estimates[0] ? estimates[0].method : 'unknown',
      spots: judged,
    };
  }

  function rollup(sceneReports) {
    const list = Array.isArray(sceneReports) ? sceneReports : [];
    let n = 0;
    let agree = 0;
    const byLighting = {};
    list.forEach((s) => {
      n += s.n;
      agree += s.agree;
      const key = s.lighting || 'day';
      if (!byLighting[key]) byLighting[key] = { n: 0, agree: 0, rate: null };
      byLighting[key].n += s.n;
      byLighting[key].agree += s.agree;
    });
    Object.keys(byLighting).forEach((k) => {
      const b = byLighting[k];
      b.rate = b.n ? b.agree / b.n : null;
    });
    return {
      n,
      agree,
      rate: n ? agree / n : null,
      wilson: proto && proto.wilsonInterval ? proto.wilsonInterval(agree, n, 1.96) : null,
      byLighting,
    };
  }

  function evaluate(mode, sceneList) {
    const list = sceneList || scenes();
    const sceneReports = list.map((s) => evaluateScene(s, mode || 'v2'));
    const summary = rollup(sceneReports);
    return {
      kind: 'synthetic-demo',
      synthetic: true,
      fieldMeasured: false,
      mode: mode || 'v2',
      note: 'הסכמה מול תוויות שציירנו במחולל. לא דיוק שדה מול פקח בנתניה.',
      scenes: sceneReports,
      ...summary,
    };
  }

  function compareMethods(sceneList) {
    const list = sceneList || scenes();
    const v2 = evaluate('v2', list);
    const normalized = evaluate('normalized', list);
    const legacy = evaluate('legacy', list);
    return {
      kind: 'synthetic-demo-compare',
      synthetic: true,
      fieldMeasured: false,
      note: 'השוואת v2 (חיסור רקע) מול נרמול-תאורה בלבד ומול היוריסטיקת v1. לא מדידת שטח.',
      v2,
      normalized,
      legacy,
      improved: v2.rate != null && legacy.rate != null ? v2.rate - legacy.rate : null,
    };
  }

  // loadSampleOccupancy - the shipped pilot dataset read as occupancy records.
  //
  // Both arguments are the *text* of a JSON file (pilot/dataset/manifest.json
  // and pilot/dataset/labels.json). This function opens nothing, fetches
  // nothing and reads no clock: the caller decides where the bytes came from.
  // Unparseable text gives an empty list rather than an exception, because the
  // pilot pages hand it whatever is in a textarea.
  //
  // The manifest supplies the street and the spot count; the labels supply the
  // ground truth. A manifest scene with no matching label is skipped - an
  // unlabelled scene is not a measurement. Records come back through
  // occupancy.normalize, in manifest scene order.
  //
  // source is 'dataset-label' and confidence is 0, deliberately. These are
  // labels we painted in this repo. They are not a camera reading and they are
  // not an inspector count, and nothing downstream should be able to mistake
  // them for one.
  function parseJsonText(text) {
    if (typeof text !== 'string') return null;
    try {
      const v = JSON.parse(text);
      return v && typeof v === 'object' ? v : null;
    } catch (e) {
      return null;
    }
  }

  // The spot index a label entry names, or null when it names none.
  //
  // Number() is not this test. Number(null), Number(''), Number(false),
  // Number([]) and Number('  ') are all 0; Number(true) and Number('1e0') are
  // 1; Number('0x2') is 2. Every one of those is an integer inside a 12-spot
  // lot, so a guard built on Number() turns a JSON entry that names no spot at
  // all into a spot the municipality is told is occupied. Only a real number
  // and a plain decimal-integer string are evidence; a string with a sign, an
  // exponent, a radix prefix, a decimal point or surrounding space is not a
  // spot index and is discarded rather than guessed at.
  function labelIndex(raw) {
    if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
    if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) return Number(raw);
    return null;
  }

  // How many of the marked spots this label says are occupied. Indices that
  // are repeated, outside the lot, or not an index at all are not evidence and
  // do not count.
  function labelledOccupied(scene, total) {
    const at = Array.isArray(scene && scene.occupiedAt) ? scene.occupiedAt : [];
    const seen = [];
    at.forEach((raw) => {
      const i = labelIndex(raw);
      if (i == null || i < 0 || i >= total) return;
      if (seen.indexOf(i) === -1) seen.push(i);
    });
    return seen.length;
  }

  function loadSampleOccupancy(manifestText, labelsText) {
    const man = parseJsonText(manifestText);
    const lab = parseJsonText(labelsText);
    if (!man || !lab) return [];
    const total = Number(man.patch && man.patch.spots);
    if (!Number.isInteger(total) || total <= 0) return [];
    const labels = {};
    (Array.isArray(lab.scenes) ? lab.scenes : []).forEach((s) => {
      if (s && s.id != null) labels[String(s.id)] = s;
    });
    const out = [];
    (Array.isArray(man.scenes) ? man.scenes : []).forEach((s) => {
      if (!s || s.id == null) return;
      const label = labels[String(s.id)];
      if (!label) return;
      const rec = occ.normalize({
        ts: s.ts != null ? s.ts : '',
        street: man.street,
        total,
        occupied: labelledOccupied(label, total),
        source: 'dataset-label',
        confidence: 0,
      });
      if (!rec) return;
      rec.scene = String(s.id);
      rec.lighting = s.lighting != null ? String(s.lighting) : '';
      out.push(rec);
    });
    return out;
  }

  return {
    PATCH_W,
    PATCH_H,
    SPOT_COUNT,
    MIXED_CARS,
    WHITE_CARS,
    SCENE_DEFS,
    makePatch,
    scenes,
    manifest,
    evaluateScene,
    evaluate,
    compareMethods,
    rollup,
    loadSampleOccupancy,
  };
});
