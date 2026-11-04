// Shared top nav for every ParkWiz HTML surface. One list, one renderer.
(function (root) {
  const LINKS = [
    { id: 'map', href: './', label: 'מפת חניה עירונית' },
    { id: 'brief', href: './pilot-brief.html', label: 'תקציר לעירייה' },
    { id: 'offer', href: './offer.html', label: 'הצעה / הזמן פיילוט' },
    { id: 'kit', href: './pilot-kit.html', label: 'ערכת פיילוט' },
    { id: 'atidim-pilot', href: './pilot-atidim.html', label: 'פיילוט פארק עתידים' },
    { id: 'calibrate', href: './pilot-calibrate.html', label: 'כיול 3 דק׳' },
    { id: 'eval', href: './pilot-eval.html', label: 'דיוק דמו' },
    { id: 'method', href: './pilot-method.html', label: 'מתודולוגיה' },
    { id: 'compare', href: './pilot-compare.html', label: 'השוואת דיוק' },
    { id: 'log', href: './pilot-log.html', label: 'יומן 30 יום' },
    { id: 'report', href: './pilot-report.html', label: 'דוח פיילוט' },
    { id: 'summary', href: './pilot-summary.html', label: 'סיכום לקריאה בלבד' },
    { id: 'privacy', href: './pilot-privacy.html', label: 'בקשת גישה / פרטיות' },
  ];

  function ensureNavCss() {
    if (typeof document === 'undefined' || document.getElementById('pw-surface-nav-css')) return;
    const s = document.createElement('style');
    s.id = 'pw-surface-nav-css';
    // Look: Claude Design system (project 4db02f73): white bar, 44px pills,
    // teal for the current page. Tokens from src/ui/tokens.css, with fallbacks
    // for pages that do not load it.
    s.textContent = '.pw-surface-nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:8px 12px;background:var(--pw-surface,#fff);border-bottom:1px solid var(--pw-line,#dde3e1);font:600 0.82rem var(--pw-font,system-ui,sans-serif)}'
      + '.pw-surface-nav a,.pw-surface-nav span.here{display:inline-flex;align-items:center;min-height:44px;color:var(--pw-ink,#14211f);border:1px solid var(--pw-line,#dde3e1);border-radius:12px;padding:0 14px;text-decoration:none;background:var(--pw-surface,#fff)}'
      + '.pw-surface-nav a:hover{background:var(--pw-brand-soft,#e3efee);color:var(--pw-brand,#0e5a5e)}'
      + '.pw-surface-nav a:focus-visible{outline:none;box-shadow:var(--pw-focus,0 0 0 3px #0e5a5e)}'
      + '.pw-surface-nav span.here{color:var(--pw-on-brand,#fff);background:var(--pw-brand,#0e5a5e);border-color:var(--pw-brand,#0e5a5e)}'
      + '.pw-surface-nav .pw-nav-brand{font-weight:700;font-size:1rem;color:var(--pw-brand,#0e5a5e);padding-inline-end:4px}'
      // Phones: one swipeable row instead of five wrapped rows above the content.
      + '@media(max-width:600px){.pw-surface-nav{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:6px 12px}'
      + '.pw-surface-nav::-webkit-scrollbar{display:none}.pw-surface-nav>*{flex-shrink:0;white-space:nowrap}}';
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
    brand.className = 'pw-nav-brand';
    host.appendChild(brand);
    LINKS.forEach((item) => {
      const el = document.createElement(item.id === active ? 'span' : 'a');
      el.textContent = item.label;
      if (item.id === active) {
        el.className = 'here';
        el.setAttribute('aria-current', 'page');
      } else el.href = item.href;
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
