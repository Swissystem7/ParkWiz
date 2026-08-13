// ParkWiz — register the field service worker and surface offline/install state.
// No analytics, no push. Cache is local. Leaflet CDN is not part of the shell.
(function (root) {
  const STYLE_ID = 'pw-pwa-css';

  function ensureCss() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '#pw-offline-banner{display:none;position:sticky;top:0;z-index:10000;background:#78350f;color:#fffbeb;text-align:center;padding:8px 12px;font:700 .82rem system-ui,sans-serif}'
      + '#pw-offline-banner.show{display:block}'
      + '#pwInstallBtn.show{display:inline-block}';
    document.head.appendChild(s);
  }

  function banner() {
    let el = document.getElementById('pw-offline-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pw-offline-banner';
      el.setAttribute('role', 'status');
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  function syncOnline() {
    const el = banner();
    if (navigator.onLine === false) {
      el.classList.add('show');
      el.textContent = 'אין רשת — עובדים מהמטמון המקומי. ספירות נשמרות בדפדפן זה.';
    } else {
      el.classList.remove('show');
    }
  }

  function register() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () { /* file:// or blocked */ });
  }

  let deferredPrompt = null;

  function bindInstall() {
    const btn = document.getElementById('pwInstallBtn');
    window.addEventListener('beforeinstallprompt', function (ev) {
      ev.preventDefault();
      deferredPrompt = ev;
      if (btn) btn.classList.add('show');
    });
    if (btn) {
      btn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt = null;
        btn.classList.remove('show');
      });
    }
  }

  function boot() {
    if (typeof document === 'undefined') return;
    ensureCss();
    register();
    syncOnline();
    bindInstall();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  root.ParkWizPwa = { boot, register };
})(typeof globalThis !== 'undefined' ? globalThis : this);
