// A deliberately tiny rasteriser for the pilot sample frames.
//
// It is not an SVG renderer: it understands flat-filled axis-aligned <rect>s and
// <circle>s painted in document order, inheriting a parent <g fill>, which is
// exactly what pilot/sample-lot*.svg is made of. That is enough to answer the
// question the redaction tests need answered without pulling a headless browser
// into a repo that has no dependencies — does the frame the operator actually
// loads contain regions the detector finds?
function parseColour(value) {
  const hex = String(value || '').trim();
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function attr(tag, name) {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
}

function fillRect(frame, width, height, x0, y0, w, h, rgb) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(height, Math.round(y0 + h)); y++) {
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(width, Math.round(x0 + w)); x++) {
      const i = (y * width + x) * 4;
      frame[i] = rgb[0]; frame[i + 1] = rgb[1]; frame[i + 2] = rgb[2]; frame[i + 3] = 255;
    }
  }
}

function fillCircle(frame, width, height, cx, cy, r, rgb) {
  for (let y = Math.max(0, Math.round(cy - r)); y < Math.min(height, Math.round(cy + r)); y++) {
    for (let x = Math.max(0, Math.round(cx - r)); x < Math.min(width, Math.round(cx + r)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const i = (y * width + x) * 4;
      frame[i] = rgb[0]; frame[i + 1] = rgb[1]; frame[i + 2] = rgb[2]; frame[i + 3] = 255;
    }
  }
}

function rasterSvg(svg) {
  const width = Number(attr(svg.slice(0, svg.indexOf('>') + 1), 'width'));
  const height = Number(attr(svg.slice(0, svg.indexOf('>') + 1), 'height'));
  const frame = new Uint8ClampedArray(width * height * 4);
  // <g fill="..."> sets the fill its children inherit; </g> pops it.
  const stack = [];
  const tags = svg.match(/<\/?(?:g|rect|circle)\b[^>]*>/g) || [];
  for (const tag of tags) {
    if (tag.startsWith('</g')) { stack.pop(); continue; }
    if (tag.startsWith('<g')) { stack.push(parseColour(attr(tag, 'fill'))); continue; }
    const rgb = parseColour(attr(tag, 'fill')) || stack.filter(Boolean).pop();
    if (!rgb) continue;   // stroke-only shape (the bay outlines)
    if (tag.startsWith('<rect')) {
      const x = Number(attr(tag, 'x') || 0);
      const y = Number(attr(tag, 'y') || 0);
      fillRect(frame, width, height, x, y, Number(attr(tag, 'width')), Number(attr(tag, 'height')), rgb);
    } else {
      fillCircle(frame, width, height,
        Number(attr(tag, 'cx')), Number(attr(tag, 'cy')), Number(attr(tag, 'r')), rgb);
    }
  }
  return { frame, width, height };
}

module.exports = { rasterSvg, parseColour };
