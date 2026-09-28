// ParkWiz — the one place a buyer finds out how to reach the developer.
//
// CONTACT is the ONLY value: an email, a phone (WhatsApp) or an https link to
// a form. The owner decided on 28.9 that it is his Google Form "משוב על
// האפליקציות", with the app field pre-filled as ParkWiz. If it is emptied, the
// direct line hides and buyers get a Hebrew GitHub Issue form instead (public,
// needs a GitHub account; the block says so).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizContact = api;
  if (typeof document !== 'undefined') {
    const boot = () => api.mountContact(document.getElementById('pwContact'));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ← the one value (email, phone or https link). '' falls back to the GitHub form.
  const CONTACT = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=ParkWiz';

  const REPO = 'https://github.com/Swissystem7/ParkWiz';

  function contactHref(value) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return null;
    if (/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(v)) return 'mailto:' + v;
    if (/^https:\/\/[^\s<>"']+$/i.test(v)) return v;
    const digits = v.replace(/[\s\-()]/g, '');
    if (/^\+?\d{9,15}$/.test(digits)) {
      let intl = digits.replace(/^\+/, '');
      if (intl.startsWith('0')) intl = '972' + intl.slice(1);
      return 'https://wa.me/' + intl;
    }
    return null;
  }

  function issueUrl(source) {
    const title = 'פנייה לגבי פיילוט ParkWiz';
    const body = [
      '> שימו לב: Issue ב־GitHub הוא ציבורי. אל תכתבו כאן טלפון, מייל או פרטים אישיים.',
      '',
      '**רשות / ארגון:** ',
      '**תפקיד (לא שם):** ',
      '**מה מעניין אתכם:** פיילוט מדידה / שאלה על פרטיות / אחר',
      '**איך נחזור אליכם:** למשל «דרך מוקד 106, לבקש את יחידת החדשנות»',
      '',
      '_נפתח מהדף: ' + String(source || 'unknown') + '_',
    ].join('\n');
    return REPO + '/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }

  function mountContact(host) {
    if (!host || typeof document === 'undefined') return;
    const source = host.getAttribute('data-source') || (location.pathname.split('/').pop() || 'index.html');
    const href = contactHref(CONTACT);
    host.className = 'pw-contact';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'יצירת קשר');
    host.style.cssText = 'border:1px solid currentColor;border-radius:10px;padding:8px 12px;margin:10px 0;font-size:.85rem;line-height:1.5';
    host.replaceChildren();
    const lead = document.createElement('b');
    lead.textContent = 'רוצים פיילוט או שאלה? ';
    host.appendChild(lead);
    const direct = document.createElement('a');
    direct.className = 'pw-contact-direct';
    direct.hidden = !href;
    if (href) {
      direct.href = href;
      direct.rel = 'noopener';
      if (href.startsWith('mailto:')) {
        direct.textContent = 'פנו ישירות: ' + CONTACT.trim();
      } else {
        // A form link is long; its label says what it is instead of printing the URL.
        const isForm = /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i.test(href);
        direct.textContent = href.startsWith('https://wa.me/') ? 'פנו ישירות ב־WhatsApp'
          : isForm ? 'פנו אלינו בטופס Google' : 'פנו אלינו בטופס';
        direct.target = '_blank';
      }
      host.appendChild(direct);
      if (!href.startsWith('mailto:')) {
        const hint = document.createElement('span');
        hint.textContent = ' (נפתח בחלון חדש; כתבו בלי פרטים אישיים)';
        host.appendChild(hint);
      }
      return;
    }
    const issue = document.createElement('a');
    issue.className = 'pw-contact-issue';
    issue.href = issueUrl(source);
    issue.target = '_blank';
    issue.rel = 'noopener';
    issue.textContent = 'פתחו פנייה בטופס GitHub (בעברית)';
    host.appendChild(issue);
    const note = document.createElement('span');
    note.textContent = ' — ציבורי ודורש חשבון GitHub; אל תכתבו שם פרטים אישיים. ערוץ ישיר עוד לא פורסם.';
    host.appendChild(note);
  }

  return { CONTACT, REPO, contactHref, issueUrl, mountContact };
});
