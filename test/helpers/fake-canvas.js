// Enough of the canvas 2d API for the redaction pipeline to run under node:
// drawImage from a frame-like source, getImageData, putImageData. The browser
// clears the bitmap when width/height are assigned, so this does too — that is
// what guarantees a stale raw frame cannot survive a resize.
function fakeCanvas(width, height) {
  const canvas = {
    _w: width || 0,
    _h: height || 0,
    data: new Uint8ClampedArray((width || 0) * (height || 0) * 4),
    puts: 0,
    get width() { return this._w; },
    set width(v) { this._w = v | 0; this.data = new Uint8ClampedArray(this._w * this._h * 4); },
    get height() { return this._h; },
    set height(v) { this._h = v | 0; this.data = new Uint8ClampedArray(this._w * this._h * 4); },
    getContext() {
      return {
        drawImage: (src) => {
          if (src.width !== canvas._w || src.height !== canvas._h) {
            throw new Error('fakeCanvas: drawImage does not scale');
          }
          canvas.data.set(src.data);
        },
        // A real getImageData hands back a detached copy; redactFrame mutates
        // it and putImageData writes it back, so copying here keeps the fake
        // honest about when the canvas bitmap actually changes.
        getImageData: (x, y, w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(canvas.data),
        }),
        putImageData: (img) => { canvas.data.set(img.data); canvas.puts++; },
      };
    },
  };
  return canvas;
}

// A frame source shaped like an <img>/<video> as far as redactSource cares.
function fakeSource(frame, width, height) {
  return { data: frame, width, height, naturalWidth: width, naturalHeight: height };
}

module.exports = { fakeCanvas, fakeSource };
