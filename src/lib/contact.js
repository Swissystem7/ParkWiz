// ParkWiz — the one place a buyer finds out how to reach the developer.
//
// CONTACT is the ONLY value to fill: an email, a phone (WhatsApp) or an https
// link to a form. It ships empty on purpose — agents never invent contact
// details. While it is empty the direct line stays hidden and buyers get a
// Hebrew GitHub Issue form instead (public, needs a GitHub account; the block
// says so).
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
  // ← the owner fills this one value (email, phone or https link). Leave '' to hide.
  const CONTACT = '';

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
      direct.textContent = 'פנו ישירות: ' + CONTACT.trim();
      direct.rel = 'noopener';
      host.appendChild(direct);
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
