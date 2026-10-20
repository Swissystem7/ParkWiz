/* Light / dark theme switch (#339). Loaded with a plain <script src> in <head>
   so data-theme is on <html> before the first paint (no flash of the wrong
   theme). The choice is remembered per browser; with no choice the OS
   preference wins. Any button with [data-theme-toggle] becomes the switch. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ParkWizTheme = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined') api.boot(document, window);
})(this, function () {
  'use strict';
  var KEY = 'parkwiz_theme';
  var THEME_COLOR = { dark: '#0b1210', light: '#f3f6f4' };

  function resolveTheme(stored, prefersLight) {
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersLight ? 'light' : 'dark';
  }

  function nextTheme(theme) {
    return theme === 'light' ? 'dark' : 'light';
  }

  // The button names the theme it switches TO, so a screen reader hears the action.
  function toggleLabel(theme) {
    return theme === 'light' ? 'מעבר לערכת צבעים כהה' : 'מעבר לערכת צבעים בהירה';
  }

  function toggleIcon(theme) {
    return theme === 'light' ? '🌙' : '☀️';
  }

  function apply(doc, theme) {
    doc.documentElement.setAttribute('data-theme', theme);
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
  }

  function paint(btn, theme) {
    btn.textContent = toggleIcon(theme);
    btn.setAttribute('aria-label', toggleLabel(theme));
    btn.setAttribute('title', toggleLabel(theme));
  }

  function boot(doc, win) {
    var stored = null;
    try { stored = win.localStorage.getItem(KEY); } catch (e) {}
    var prefersLight = !!(win.matchMedia && win.matchMedia('(prefers-color-scheme: light)').matches);
    var theme = resolveTheme(stored, prefersLight);
    apply(doc, theme);
    doc.addEventListener('DOMContentLoaded', function () {
      var buttons = doc.querySelectorAll('[data-theme-toggle]');
      Array.prototype.forEach.call(buttons, function (btn) {
        paint(btn, theme);
        btn.addEventListener('click', function () {
          theme = nextTheme(theme);
          try { win.localStorage.setItem(KEY, theme); } catch (e) {}
          apply(doc, theme);
          Array.prototype.forEach.call(buttons, function (b) { paint(b, theme); });
        });
      });
    });
  }

  return { KEY: KEY, THEME_COLOR: THEME_COLOR, resolveTheme: resolveTheme, nextTheme: nextTheme,
    toggleLabel: toggleLabel, toggleIcon: toggleIcon, apply: apply, boot: boot };
});
