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
// A heuristic misses things, so the redactor is only one of the two guarantees.
// The other is structural and absolute: no raw frame is ever persisted or
// exported (see docs/privacy-redaction.md).
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
    mosaicCells: 3,
    blurPasses: 2,
  };

  const PLATE = {
    minCells: 2,
    minAspect: 1.8,        // width / height
    minWidthFrac: 0.02,
    maxWidthFrac: 0.5,
    maxHeightFrac: 0.2,
    padding: 0.3,
    // Two blocks across the plate: the glyph strip is averaged into flat
    // colour, so there is nothing left to read even at full zoom.
    mosaicCells: 2,
    blurPasses: 1,
  };

  function clampByte(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }

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

  // The intersection of the box with the frame, never a clamp of its origin: a
  // box that lies entirely off the left edge must come back empty, not slide to
  // x=0 and redact an innocent strip of the frame.
  function clipRect(rect, width, height) {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
    const y1 = Math.min(height, Math.ceil(rect.y + rect.h));
    return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
  }

  // Mosaic: split the box into cellsX x cellsY blocks and flatten each to its
  // own mean. Averaging is lossy in one direction only — the detail that
  // identified a person or a plate is gone from the buffer, not hidden in it.
  function pixelateRect(rgba, width, height, rect, cellsX, cellsY) {
    const r = clipRect(rect, width, height);
    if (!r.w || !r.h) return false;
    const nx = Math.max(1, cellsX | 0);
    const ny = Math.max(1, cellsY | 0);
    for (let by = 0; by < ny; by++) {
      const y0 = r.y + Math.floor((by * r.h) / ny);
      const y1 = r.y + Math.floor(((by + 1) * r.h) / ny);
      for (let bx = 0; bx < nx; bx++) {
        const x0 = r.x + Math.floor((bx * r.w) / nx);
        const x1 = r.x + Math.floor(((bx + 1) * r.w) / nx);
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          let i = (y * width + x0) * RGBA_BYTES;
          for (let x = x0; x < x1; x++, i += RGBA_BYTES) {
            sr += rgba[i]; sg += rgba[i + 1]; sb += rgba[i + 2]; n++;
          }
        }
        if (!n) continue;
        const mr = clampByte(sr / n), mg = clampByte(sg / n), mb = clampByte(sb / n);
        for (let y = y0; y < y1; y++) {
          let i = (y * width + x0) * RGBA_BYTES;
          for (let x = x0; x < x1; x++, i += RGBA_BYTES) {
            rgba[i] = mr; rgba[i + 1] = mg; rgba[i + 2] = mb;
          }
        }
      }
    }
    return true;
  }

  // 3x3 box blur confined to the box, read from a snapshot so passes do not
  // feed back into themselves. Run after the mosaic it softens the block seams,
  // which is what makes the result read as "blurred" rather than "censored".
  function blurRect(rgba, width, height, rect, passes) {
    const r = clipRect(rect, width, height);
    if (!r.w || !r.h) return false;
    const count = Math.max(0, passes | 0);
    for (let pass = 0; pass < count; pass++) {
      const src = new Uint8ClampedArray(r.w * r.h * RGBA_BYTES);
      for (let y = 0; y < r.h; y++) {
        const from = ((r.y + y) * width + r.x) * RGBA_BYTES;
        src.set(rgba.subarray(from, from + r.w * RGBA_BYTES), y * r.w * RGBA_BYTES);
      }
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          let sr = 0, sg = 0, sb = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const sy = y + dy;
            if (sy < 0 || sy >= r.h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const sx = x + dx;
              if (sx < 0 || sx >= r.w) continue;
              const i = (sy * r.w + sx) * RGBA_BYTES;
              sr += src[i]; sg += src[i + 1]; sb += src[i + 2]; n++;
            }
          }
          const o = ((r.y + y) * width + r.x + x) * RGBA_BYTES;
          rgba[o] = clampByte(sr / n);
          rgba[o + 1] = clampByte(sg / n);
          rgba[o + 2] = clampByte(sb / n);
        }
      }
    }
    return true;
  }

  function redactRect(rgba, width, height, rect, style) {
    const ok = pixelateRect(rgba, width, height, rect, style.mosaicCells, style.mosaicCells);
    if (!ok) return false;
    blurRect(rgba, width, height, rect, style.blurPasses);
    return true;
  }

  // The one entry point every frame must pass through. Mutates rgba in place
  // and reports what it destroyed; the boxes are for the operator overlay and
  // the frame counter, never for storage.
  function redactFrame(rgba, width, height, opts) {
    const options = opts || {};
    const found = options.regions || detectRegions(rgba, width, height, options);
    let redacted = 0;
    for (const rect of found.faces) {
      if (redactRect(rgba, width, height, rect, FACE)) redacted++;
    }
    for (const rect of found.plates) {
      if (redactRect(rgba, width, height, rect, PLATE)) redacted++;
    }
    return {
      width,
      height,
      cell: found.cell || 0,
      faces: found.faces.length,
      plates: found.plates.length,
      regions: redacted,
      boxes: { faces: found.faces, plates: found.plates },
    };
  }

  function redactCanvas(canvas, opts) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    if (!(w > 0) || !(h > 0)) return redactFrame(new Uint8ClampedArray(0), 0, 0, { regions: { faces: [], plates: [] } });
    const frame = ctx.getImageData(0, 0, w, h);
    const report = redactFrame(frame.data, w, h, opts);
    ctx.putImageData(frame, 0, 0);
    return report;
  }

  // Draws any frame source (an <img> of an uploaded snapshot, a <video> of an
  // uploaded clip / webcam / camera link, another canvas) into `canvas` and
  // redacts it before anybody can read the canvas back. Callers keep the
  // returned canvas and drop the source.
  function redactSource(source, canvas, opts) {
    const options = opts || {};
    // The source's own size wins over the canvas's. Pages reuse one offscreen
    // canvas for every frame, so trusting canvas.width would silently rescale
    // the second snapshot to the dimensions of the first.
    const w = options.width || source.naturalWidth || source.videoWidth || source.width || canvas.width;
    const h = options.height || source.naturalHeight || source.videoHeight || source.height || canvas.height;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    canvas.getContext('2d').drawImage(source, 0, 0, w, h);
    return redactCanvas(canvas, options);
  }

  // Live pipeline for a <video> (uploaded clip, webcam, or camera-link stream).
  // The video element itself is never shown — only this canvas is — so the
  // first thing a viewer can see is already redacted. `tick()` is one frame and
  // is driven by the injected scheduler, which keeps it testable off-browser.
  function createStreamRedactor(source, canvas, opts) {
    const options = opts || {};
    const schedule = options.schedule ||
      (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
    const cancel = options.cancel ||
      (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
    const state = { running: false, handle: null, frames: 0, report: null };

    function tick() {
      const report = redactSource(source, canvas, options);
      state.frames++;
      state.report = report;
      if (typeof options.onFrame === 'function') options.onFrame(report, state.frames);
      return report;
    }

    function loop() {
      if (!state.running) return;
      tick();
      state.handle = schedule ? schedule(loop) : null;
    }

    return {
      tick,
      get frames() { return state.frames; },
      get report() { return state.report; },
      get running() { return state.running; },
      start() {
        if (state.running) return;
        state.running = true;
        loop();
      },
      stop() {
        state.running = false;
        if (state.handle != null && cancel) cancel(state.handle);
        state.handle = null;
      },
    };
  }

  // Privacy mode is on by default and, outside a dev host, cannot be turned
  // off: the toggle in the operator UI is rendered disabled so the park sees
  // the guarantee rather than a switch somebody could have flipped.
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
      // destructured handler (`onclick={privacy.toggle}`) still works.
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
    pixelateRect,
    blurRect,
    redactFrame,
    redactCanvas,
    redactSource,
    createStreamRedactor,
    isDevHost,
    createPrivacyMode,
  };
});
