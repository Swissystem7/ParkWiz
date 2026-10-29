// ParkWiz — on-device privacy redaction for camera frames.
//
// Privacy by design for the Park Atidim pilot: a frame is never displayed,
// stored or sent before faces and licence plates in it have been destroyed.
// Everything here runs in the browser on raw RGBA bytes — no model download,
// no network call, no worker, so it works offline exactly like the occupancy
// heuristic in heuristic.js.
//
// This is NOT recognition. There is no OCR, no LPR, no biometric template and
// no identity anywhere in this file. The detector only *locates* candidate
// regions by colour so the redactor can overwrite them; the located pixels are
// averaged away and the boxes are dropped. That distinction is the whole legal
// point under the Israeli Privacy Protection Law (and after the LPR ruling,
// עת"מ 12825-12-24): ParkWiz still cannot tell you who or which car it saw.
//
// Detection is deliberately a colour heuristic, like the rest of the kit:
//   faces  — skin-tone cells (YCbCr chroma window + R>G>B ordering), clustered
//            into blobs with a face-like aspect ratio.
//   plates — every Israeli plate format is high-chroma yellow, so a wide, short
//            blob of yellow is a plate candidate. Flat-bright (EU-white) plates
//            are deliberately NOT a class: that test also fires on the roof of
//            a white car, and blurring a random band across light vehicles both
//            looks broken and costs the occupancy read.
//
// This file holds the detection half and the privacy-mode lock. The pilot kit
// reads the lock: privacy mode starts on, and outside a dev host the operator
// cannot turn it off. The destructive half (mosaic + blur over the located
// boxes) is still the follow-up split out of #286; nothing here overwrites
// pixels yet.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizRedact = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RGBA_BYTES = 4;

  // Classification happens on a coarse cell grid, not per pixel: a 960x540
  // webcam frame becomes ~48x27 cells, which is what makes a per-frame pass
  // affordable inside requestAnimationFrame on a mid-range Android phone.
  const CELL_DIVISOR = 48;
  const MIN_CELL = 4;

  const FACE = {
    minCells: 3,
    maxWidthFrac: 0.4,
    maxHeightFrac: 0.5,
    minAspect: 0.5,   // height / width
    maxAspect: 2.6,
    padding: 0.25,
  };

  const PLATE = {
    minCells: 2,
    minAspect: 1.8,        // width / height
    minWidthFrac: 0.02,
    maxWidthFrac: 0.5,
    maxHeightFrac: 0.2,
    padding: 0.3,
  };

  function cellSize(width, height) {
    return Math.max(MIN_CELL, Math.round(Math.min(width, height) / CELL_DIVISOR));
  }

  // Mean R/G/B per cell. Sub-sampled inside the cell — a face or a plate is
  // many cells wide, so a quarter-resolution read of each cell is plenty.
  function cellMeans(rgba, width, height, cell) {
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const means = new Float32Array(cols * rows * 3);
    const step = Math.max(1, Math.floor(cell / 4));
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        let r = 0, g = 0, b = 0, n = 0;
        const yEnd = Math.min(height, cy * cell + cell);
        const xEnd = Math.min(width, cx * cell + cell);
        for (let y = cy * cell; y < yEnd; y += step) {
          let i = (y * width + cx * cell) * RGBA_BYTES;
          for (let x = cx * cell; x < xEnd; x += step, i += step * RGBA_BYTES) {
            r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
          }
        }
        const o = (cy * cols + cx) * 3;
        if (n) { means[o] = r / n; means[o + 1] = g / n; means[o + 2] = b / n; }
      }
    }
    return { cols, rows, means };
  }

  // Classic YCbCr skin window, tightened with the R>G>B ordering that real skin
  // has under daylight and sodium light alike. Grey asphalt (#5c6570) is bluer
  // than it is red, so the whole lot surface fails the ordering test.
  function isSkin(r, g, b) {
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    return y > 40 && y < 250 &&
      cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 &&
      r > 70 && r > g && g >= b - 6 && r - b > 12;
  }

  function isPlateYellow(r, g, b) {
    return r >= 150 && g >= 110 && b <= 120 && (r - b) >= 60 && (g - b) >= 40 && r >= g - 10;
  }

  // 4-connected blobs over a boolean cell mask, returned as cell-space boxes.
  function blobs(mask, cols, rows) {
    const seen = new Uint8Array(cols * rows);
    const out = [];
    const stack = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || seen[start]) continue;
      let cells = 0;
      let minX = cols, maxX = -1, minY = rows, maxY = -1;
      seen[start] = 1;
      stack.push(start);
      while (stack.length) {
        const idx = stack.pop();
        const x = idx % cols;
        const y = (idx - x) / cols;
        cells++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const neighbours = [
          x > 0 ? idx - 1 : -1,
          x < cols - 1 ? idx + 1 : -1,
          y > 0 ? idx - cols : -1,
          y < rows - 1 ? idx + cols : -1,
        ];
        for (const n of neighbours) {
          if (n >= 0 && mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
      }
      out.push({ minX, maxX, minY, maxY, cells });
    }
    return out;
  }

  function toRect(blob, cell, width, height, padding) {
    const x0 = blob.minX * cell;
    const y0 = blob.minY * cell;
    const x1 = Math.min(width, (blob.maxX + 1) * cell);
    const y1 = Math.min(height, (blob.maxY + 1) * cell);
    const padX = Math.round((x1 - x0) * padding);
    const padY = Math.round((y1 - y0) * padding);
    const x = Math.max(0, x0 - padX);
    const y = Math.max(0, y0 - padY);
    return {
      x,
      y,
      w: Math.min(width, x1 + padX) - x,
      h: Math.min(height, y1 + padY) - y,
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // Two blobs of the same kind that overlap after padding (a face split by a
  // shadow, a plate split by a bolt) must redact as one box, or the seam
  // between them stays sharp.
  function mergeRects(rects) {
    const out = [];
    for (const rect of rects) {
      let merged = false;
      for (const kept of out) {
        if (!overlaps(kept, rect)) continue;
        const x = Math.min(kept.x, rect.x);
        const y = Math.min(kept.y, rect.y);
        kept.w = Math.max(kept.x + kept.w, rect.x + rect.w) - x;
        kept.h = Math.max(kept.y + kept.h, rect.y + rect.h) - y;
        kept.x = x;
        kept.y = y;
        merged = true;
        break;
      }
      if (!merged) out.push({ ...rect });
    }
    return out;
  }

  function detectRegions(rgba, width, height, opts) {
    const options = opts || {};
    if (!rgba || !(width > 0) || !(height > 0)) return { faces: [], plates: [], cell: 0 };
    const cell = options.cell || cellSize(width, height);
    const { cols, rows, means } = cellMeans(rgba, width, height, cell);
    const skinMask = new Uint8Array(cols * rows);
    const yellowMask = new Uint8Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const r = means[i * 3], g = means[i * 3 + 1], b = means[i * 3 + 2];
      if (isSkin(r, g, b)) skinMask[i] = 1;
      else if (isPlateYellow(r, g, b)) yellowMask[i] = 1;
    }

    const faces = [];
    for (const blob of blobs(skinMask, cols, rows)) {
      if (blob.cells < FACE.minCells) continue;
      const rect = toRect(blob, cell, width, height, FACE.padding);
      if (rect.w > width * FACE.maxWidthFrac || rect.h > height * FACE.maxHeightFrac) continue;
      const aspect = rect.h / rect.w;
      if (aspect < FACE.minAspect || aspect > FACE.maxAspect) continue;
      faces.push(rect);
    }

    const plates = [];
    for (const blob of blobs(yellowMask, cols, rows)) {
      if (blob.cells < PLATE.minCells) continue;
      const rect = toRect(blob, cell, width, height, PLATE.padding);
      if (rect.w / rect.h < PLATE.minAspect) continue;
      if (rect.w < width * PLATE.minWidthFrac || rect.w > width * PLATE.maxWidthFrac) continue;
      if (rect.h > height * PLATE.maxHeightFrac) continue;
      plates.push(rect);
    }

    return { faces: mergeRects(faces), plates: mergeRects(plates), cell };
  }

  // Privacy mode is on by default and, outside a dev host, cannot be turned
  // off. The kit renders the control disabled so the park sees the guarantee
  // rather than a switch somebody could have flipped.
  const DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

  // Unknown environment counts as production. Defaulting the other way would
  // mean a page that failed to read its own location shipped an unlockable
  // guarantee as a flippable switch.
  function isDevHost(hostname, protocol) {
    const host = String(hostname == null ? '' : hostname).toLowerCase();
    if (protocol === 'file:') return true;   // opened straight off a USB stick
    return DEV_HOSTS.indexOf(host) !== -1 || host.endsWith('.local');
  }

  function createPrivacyMode(env) {
    const locked = !isDevHost(env && env.hostname, env && env.protocol);
    let enabled = true;
    function setEnabled(value) {
      if (locked) return enabled;                // production: always on
      enabled = !!value;
      return enabled;
    }
    return {
      get enabled() { return enabled; },
      get locked() { return locked; },
      setEnabled,
      // Closes over setEnabled rather than going through `this`, so a
      // destructured handler (`onclick = privacy.toggle`) still works.
      toggle() { return setEnabled(!enabled); },
      labelHe() {
        if (enabled) return locked ? 'מצב פרטיות פועל — נעול בבילד ייצור' : 'מצב פרטיות פועל';
        return 'מצב פרטיות כבוי — פיתוח בלבד';
      },
      labelEn() {
        if (enabled) return locked ? 'Privacy mode ON — locked in production' : 'Privacy mode ON';
        return 'Privacy mode OFF — development only';
      },
    };
  }

  return {
    FACE,
    PLATE,
    CELL_DIVISOR,
    cellSize,
    isSkin,
    isPlateYellow,
    detectRegions,
    isDevHost,
    createPrivacyMode,
  };
});
