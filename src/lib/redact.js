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
// averaged away and only the box positions are kept. That distinction is the whole legal
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
// This file holds both halves: detection, and the destructive half (mosaic +
// blur over the located boxes). Nothing in the UI calls it yet — the camera
// hookup is the next slice of #289.
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

  // The destructive half. The mosaic is what destroys detail: unless a block
  // is passed, it scales with the box so a small, distant face still loses its
  // features. Plates get one solid tile — digits in a fixed font are too easy
  // to match against a fine mosaic. A light blur afterwards only softens the
  // tile seams so the result reads as "redacted", not as a rendering glitch.
  const REDACT = Object.freeze({ minBlock: 8, blockDivisor: 4, blurRadius: 2 });

  function validFrame(rgba, width, height) {
    return !!rgba && width > 0 && height > 0 && rgba.length >= width * height * RGBA_BYTES;
  }

  // Clip a box to the frame, rounding outward so a fractional edge never
  // leaves a sliver of the original pixels. Null when nothing is left.
  function clipRect(rect, width, height) {
    if (!rect || ![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)) return null;
    const x0 = Math.max(0, Math.floor(rect.x));
    const y0 = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
    const y1 = Math.min(height, Math.ceil(rect.y + rect.h));
    if (x1 <= x0 || y1 <= y0) return null;
    return { x0, y0, x1, y1 };
  }

  // Replace every block-sized tile inside rect with its mean colour. Alpha is
  // never written, so a redacted frame composites exactly like the original.
  function pixelateRect(rgba, width, height, rect, block) {
    if (!validFrame(rgba, width, height)) return false;
    const c = clipRect(rect, width, height);
    if (!c) return false;
    let size = block != null ? Math.floor(block) : Math.max(REDACT.minBlock,
      Math.ceil(Math.min(c.x1 - c.x0, c.y1 - c.y0) / REDACT.blockDivisor));
    // A 1px block would leave the box untouched yet still report success.
    if (!(size >= 2)) size = 2;
    for (let ty = c.y0; ty < c.y1; ty += size) {
      const yEnd = Math.min(c.y1, ty + size);
      for (let tx = c.x0; tx < c.x1; tx += size) {
        const xEnd = Math.min(c.x1, tx + size);
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = ty; y < yEnd; y++) {
          for (let x = tx, i = (y * width + tx) * RGBA_BYTES; x < xEnd; x++, i += RGBA_BYTES) {
            r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
          }
        }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        for (let y = ty; y < yEnd; y++) {
          for (let x = tx, i = (y * width + tx) * RGBA_BYTES; x < xEnd; x++, i += RGBA_BYTES) {
            rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b;
          }
        }
      }
    }
    return true;
  }

  // Separable box blur (horizontal into a scratch buffer, vertical back into
  // the frame), R/G/B only. Sampling clamps to the rect's own edges, so no
  // pixel outside rect is ever read or written — the lot around a face stays
  // byte-identical.
  function blurRect(rgba, width, height, rect, radius) {
    if (!validFrame(rgba, width, height)) return false;
    const c = clipRect(rect, width, height);
    if (!c) return false;
    const r = radius != null ? Math.floor(radius) : REDACT.blurRadius;
    if (!(r > 0)) return false;
    const w = c.x1 - c.x0, h = c.y1 - c.y0;
    const rx = Math.min(r, w - 1), ry = Math.min(r, h - 1);
    if (rx <= 0 && ry <= 0) return false;
    const tmp = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      const row = (c.y0 + y) * width;
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0;
        for (let k = -rx; k <= rx; k++) {
          const i = (row + c.x0 + Math.min(w - 1, Math.max(0, x + k))) * RGBA_BYTES;
          sr += rgba[i]; sg += rgba[i + 1]; sb += rgba[i + 2];
        }
        const o = (y * w + x) * 3, n = 2 * rx + 1;
        tmp[o] = sr / n; tmp[o + 1] = sg / n; tmp[o + 2] = sb / n;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0;
        for (let k = -ry; k <= ry; k++) {
          const o = (Math.min(h - 1, Math.max(0, y + k)) * w + x) * 3;
          sr += tmp[o]; sg += tmp[o + 1]; sb += tmp[o + 2];
        }
        const i = ((c.y0 + y) * width + c.x0 + x) * RGBA_BYTES, n = 2 * ry + 1;
        rgba[i] = Math.round(sr / n); rgba[i + 1] = Math.round(sg / n); rgba[i + 2] = Math.round(sb / n);
      }
    }
    return true;
  }

  // Locate and destroy faces and plates in one call. Accepts raw RGBA with
  // width/height, or an ImageData-like {data, width, height} (then the second
  // argument is opts). Mutates in place on purpose: the camera loop is
  // getImageData -> redact -> putImageData, and a per-frame copy of a 960x540
  // buffer is exactly the allocation churn that stutters a phone.
  // opts: mode 'mosaic' | 'both' (default, mosaic then seam blur), block,
  // radius, cell. There is no blur-only mode: a small blur alone leaves plates
  // and faces readable. A caller block below REDACT.minBlock is raised to it.
  function redactFrame(input, width, height, opts) {
    let rgba = input, w = width, h = height, options = opts;
    if (input && input.data && input.width) {
      rgba = input.data; w = input.width; h = input.height; options = width;
    }
    options = options || {};
    if (!validFrame(rgba, w, h)) return { faces: [], plates: [], cell: 0, redacted: 0 };
    const found = detectRegions(rgba, w, h, { cell: options.cell });
    const block = options.block != null ? Math.max(REDACT.minBlock, Math.floor(options.block) || 0) : null;
    const boxes = found.faces.map((rect) => [rect, block])
      .concat(found.plates.map((rect) => [rect, Math.max(rect.w, rect.h)]));
    let redacted = 0;
    for (const [rect, size] of boxes) {
      if (!pixelateRect(rgba, w, h, rect, size)) continue;
      if (options.mode !== 'mosaic') blurRect(rgba, w, h, rect, options.radius);
      redacted++;
    }
    return { faces: found.faces, plates: found.plates, cell: found.cell, redacted };
  }

  return {
    FACE,
    PLATE,
    REDACT,
    CELL_DIVISOR,
    cellSize,
    isSkin,
    isPlateYellow,
    detectRegions,
    pixelateRect,
    blurRect,
    redactFrame,
  };
});
