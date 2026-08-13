// Shared top nav for every ParkWiz HTML surface. One list, one renderer.
(function (root) {
  const LINKS = [
    { id: 'map', href: './', label: 'מפת חניה עירונית' },
    { id: 'kit', href: './pilot-kit.html', label: 'ערכת פיילוט' },
    { id: 'report', href: './pilot-report.html', label: 'דוח פיילוט' },
    { id: 'privacy', href: './pilot-privacy.html', label: 'בקשת גישה / פרטיות' },
    { id: 'dash', href: './pilot-dashboard.html', label: 'דשבורד פיילוט עירוני' },
    { id: 'market', href: './marketplace.html', label: 'שוק חניות פרטיות' },
  ];

  function ensureNavCss() {
    if (typeof document === 'undefined' || document.getElementById('pw-surface-nav-css')) return;
    const s = document.createElement('style');
    s.id = 'pw-surface-nav-css';
    s.textContent = '.pw-surface-nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:7px 12px;background:#0f1420;border-bottom:1px solid rgba(255,255,255,.08);font:600 0.78rem system-ui,sans-serif}'
      + '.pw-surface-nav a,.pw-surface-nav span.here{color:#e8f0ff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:3px 11px;text-decoration:none}'
      + '.pw-surface-nav span.here{color:#fff;background:rgba(14,116,144,.45);border-color:rgba(103,232,249,.45)}';
    document.head.appendChild(s);
  }

  function mountSurfaceNav(host) {
    if (!host) return;
    ensureNavCss();
    const active = host.getAttribute('data-active') || '';
    host.className = 'pw-surface-nav';
    host.setAttribute('aria-label', 'ניווט ParkWiz');
    host.replaceChildren();
    const brand = document.createElement('span');
    brand.textContent = 'ParkWiz';
    brand.style.color = '#8ba3c7';
    host.appendChild(brand);
    LINKS.forEach((item) => {
      const el = document.createElement(item.id === active ? 'span' : 'a');
      el.textContent = item.label;
      if (item.id === active) el.className = 'here';
      else el.href = item.href;
      host.appendChild(el);
    });
  }

  function boot() {
    mountSurfaceNav(document.getElementById('pwSurfaceNav'));
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  root.ParkWizSurfaceNav = { LINKS, mountSurfaceNav };
})(typeof globalThis !== 'undefined' ? globalThis : this);
