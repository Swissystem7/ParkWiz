// ParkWiz — honest municipal offer, outreach drafts, and a printable quote.
//
// No server, no payment, no invented ROI. A quote is a local draft until
// Aviran sends it. Amounts the developer types are labeled as such.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizOffer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CHECKED_ON = '2026-08-13';

  const BUYER = Object.freeze({
    authority: 'עיריית נתניה',
    unit: 'יחידת חדשנות / אגף תנועה וחניה',
    phone106: '106',
    phoneDirect: '09-8604400',
    whatsapp: '0526333106',
    whatsappNote: 'מוקד עירוני — לבקש ניתוב ליחידת חדשנות. לא תיבת רכש.',
    emailOfficial: null,
    emailNote: 'מייל רשמי של יחידת חדשנות: לא נמצא מקור.',
  });

  const SENDER_DEFAULT = Object.freeze({
    name: 'אבירן סוויסה',
    city: 'נתניה',
    role: 'מפתח',
  });

  const EXEMPTION = Object.freeze({
    regulation: 'תקנות העיריות (מכרזים), התשמ״ח–1987, תקנה 3(3)',
    regulationUrl: 'https://he.wikisource.org/wiki/%D7%AA%D7%A7%D7%A0%D7%95%D7%AA_%D7%94%D7%A2%D7%99%D7%A8%D7%99%D7%95%D7%AA_(%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D)',
    baseIls: 26000,
    officialIndexed2021: 145500,
    thirdPartyIls: 171500,
    thirdPartyWindow: '16.9.2026–15.10.2026',
    windowStart: '2026-09-16',
    windowEnd: '2026-10-15',
    checkedOn: '2026-09-27',
    thirdPartySource: 'https://www.c-on.com/copy-of-%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D',
    official2026File: null,
    note: '171,500 ₪ הוא חישוב צד ג׳ (c-on) לחלון 16.9–15.10.2026 לפי מדד שפורסם 15.9.2026, לא קובץ רשמי של משרד הפנים. הרף מתעדכן ב־16 בכל חודש. פטור עדיין דורש גזבר.',
  });

  const VENDOR_PRICES = Object.freeze([
    {
      id: 'camlytics',
      label: 'Camlytics Service',
      price: '10 $ לערוץ לחודש',
      url: 'https://camlytics.com/products',
      note: 'תוכנה כללית, לא חוזה נתניה.',
    },
    {
      id: 'pumba-b2c',
      label: 'פומבה לנהג',
      price: '29.90 ₪/חודש או 19.90 ₪ לשימוש',
      url: 'https://pumbaparking.com/',
      note: 'B2C בת״א עם חיישן. לא מחירון עירוני.',
    },
  ]);

  const PACKAGES = Object.freeze([
    {
      id: 'pilot-free',
      title: 'פיילוט מדידה',
      real: true,
      priceIls: 0,
      durationDays: 30,
      cameras: 1,
      blurb: 'ההצעה היחידה שקיימת היום. חינם. מצלמה אחת שכבר קיימת.',
      includes: [
        'כיול מלבני חניה על snapshot',
        'השוואה לספירת פקח ואחוז הסכמה',
        'יומן 30 יום + כלל עצירה',
        'דוח להדפסה ו־CSV/JSON',
      ],
      excludes: [
        'אכיפה / זיהוי לוחיות / שמירת וידאו',
        'מנוי נהגים / דיווח קהילה כשירות',
        'SLA, מוקד, ערבות, סליקה',
        'דיוק שנמדד בשטח — טרם נמדד',
      ],
    },
    {
      id: 'measure-after',
      title: 'חבילת מדידה אחרי פיילוט',
      real: false,
      priceIls: null,
      durationDays: 90,
      cameras: 1,
      blurb: 'טיוטת הצעת מחיר בלבד. אין מחירון שוק ישראלי. הסכום הוא מה שהמפתח מקליד.',
      includes: [
        'המשך מדידה על אותה מצלמה',
        'דוח תכנון (שיא / שפל / שעה עמוסה)',
        'ייצוא CSV/JSON',
      ],
      excludes: [
        'חוזה חתום',
        'אכיפה או הכנסות מקנסות',
        'החלפת פנגו / סלו',
        'הבטחת ROI',
      ],
    },
  ]);

  function trim(value) {
    return value == null ? '' : String(value).trim();
  }

  function digitsOnly(value) {
    return trim(value).replace(/\D/g, '');
  }

  function stripInternationalPrefix(digits) {
    if (digits.startsWith('00')) return digits.slice(2);
    return digits;
  }

  function normalizeIsraeliCountryCode(digits) {
    if (digits.startsWith('9720')) return '972' + digits.slice(4);
    if (digits.startsWith('972')) return digits;
    return null;
  }

  function formatIsraeliDomesticPhone(digits) {
    if (digits.startsWith('0') && digits.length >= 9) {
      return '972' + digits.slice(1);
    }
    if (digits.length === 9 && digits.startsWith('5')) {
      return '972' + digits;
    }
    return digits;
  }

  function toIntlPhone(phone) {
    const raw = digitsOnly(phone);
    if (!raw) return '';
    const stripped = stripInternationalPrefix(raw);
    const withCountryCode = normalizeIsraeliCountryCode(stripped);
    if (withCountryCode) return withCountryCode;
    return formatIsraeliDomesticPhone(stripped);
  }

  function formatIls(amount) {
    if (amount == null || amount === '') return '—';
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const rounded = Math.round(n);
    const sign = rounded < 0 ? '-' : '';
    const abs = String(Math.abs(rounded));
    const withSep = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + withSep + ' ₪';
  }

  function isValidEmail(value) {
    const s = trim(value);
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function packageById(id) {
    return PACKAGES.find((p) => p.id === id) || null;
  }

  function aboveExemption(amountIls) {
    const n = Number(amountIls);
    if (!Number.isFinite(n)) return false;
    return n >= EXEMPTION.thirdPartyIls;
  }

  // The cap is CPI-linked and changes on the 16th of every month. Outside its window it is a stale number.
  function exemptionStatus(atIso) {
    const day = String(atIso || new Date().toISOString()).slice(0, 10);
    const current = day >= EXEMPTION.windowStart && day <= EXEMPTION.windowEnd;
    return {
      day,
      current,
      expired: day > EXEMPTION.windowEnd,
      windowStart: EXEMPTION.windowStart,
      windowEnd: EXEMPTION.windowEnd,
    };
  }

  function resolveBookSender(src) {
    const rawName = trim(src.senderName);
    const senderName = src.senderName !== undefined ? rawName : SENDER_DEFAULT.name;
    return {
      senderName,
      senderPhone: trim(src.senderPhone),
      senderEmail: trim(src.senderEmail),
      senderRole: trim(src.senderRole) || SENDER_DEFAULT.role,
    };
  }

  function resolveBookRecipient(src) {
    const recipientName = trim(src.recipientName) || 'מוביל/ת עיר חכמה';
    const recipientPhone = trim(src.recipientPhone) || BUYER.whatsapp;
    return {
      recipientName,
      recipientRole: trim(src.recipientRole) || BUYER.role,
      recipientUnit: trim(src.recipientUnit) || BUYER.unit,
      authority: trim(src.authority) || BUYER.authority,
      channel: src.channel === 'whatsapp' ? 'whatsapp' : 'email',
      recipientEmail: trim(src.recipientEmail),
      recipientPhone,
      cameraStreet: trim(src.cameraStreet),
      accuracyNote: trim(src.accuracyNote) || 'טרם נמדד דיוק מול ספירת פקח בשטח.',
    };
  }

  function collectSenderErrors(fields, errors) {
    if (!fields.senderName) {
      errors.push('חסר שם השולח.');
    }
    if (!fields.senderPhone && !fields.senderEmail) {
      errors.push('צריך טלפון או מייל של השולח.');
    }
    if (fields.senderEmail && !isValidEmail(fields.senderEmail)) {
      errors.push('מייל השולח לא תקין.');
    }
  }

  function collectRecipientErrors(fields, errors) {
    if (fields.channel === 'email') {
      if (!fields.recipientEmail) {
        errors.push('חסר מייל נמען.');
      } else if (!isValidEmail(fields.recipientEmail)) {
        errors.push('מייל הנמען לא תקין.');
      }
      return;
    }
    if (!digitsOnly(fields.recipientPhone)) {
      errors.push('חסר מספר WhatsApp.');
    }
  }

  function validateBook(input) {
    const src = input || {};
    const errors = [];
    const sender = resolveBookSender(src);
    const recipient = resolveBookRecipient(src);
    const fields = { ...sender, ...recipient };

    collectSenderErrors(fields, errors);
    collectRecipientErrors(fields, errors);

    return {
      ok: errors.length === 0,
      errors,
      fields,
    };
  }

  function buildPilotSubject(fields) {
    const f = fields || {};
    return 'פיילוט טכני חינם ל־30 יום — תפוסת חניה אנונימית ממצלמה עירונית אחת';
  }

  function buildPilotBody(fields) {
    const f = fields || {};
    const name = f.recipientName || 'מוביל/ת עיר חכמה';
    const street = f.cameraStreet ? ` הרחוב המוצע לצילום: ${f.cameraStreet}.` : '';
    const accuracy = f.accuracyNote || 'טרם נמדד דיוק מול ספירת פקח בשטח.';
    const contact = [f.senderPhone, f.senderEmail].filter(Boolean).join(' | ') || '[טלפון / מייל]';
    return [
      `שלום ${name},`,
      '',
      `אני ${f.senderName || SENDER_DEFAULT.name}, ${f.senderRole || SENDER_DEFAULT.role} מ${SENDER_DEFAULT.city}.`,
      '',
      'אחרי פס״ד LPR (עת״מ 12825-12-24) אי אפשר להפעיל זיהוי לוחיות לאכיפת כחול-לבן בלי חוק. מה שעדיין אפשר למדוד הוא פשוט יותר: תפוס / פנוי, בלי לזהות רכב.',
      '',
      'יש לי ערכת דפדפן שמכיילים עליה מלבני חניה על snapshot, משווים לספירת פקח, ומקבלים אחוז הסכמה עם רווח סמך. אין שרת, אין שמירת וידאו, אין לוחיות. ההערכה היא היוריסטיקת בהירות — לא בינה מלאכותית.',
      '',
      `אני מציע פיילוט חינם ל־30 יום על מצלמה אחת שכבר קיימת.${street} נדרשת רק גישת snapshot.`,
      `מצב המדידה היום: ${accuracy}`,
      '',
      'בסוף התקופה תקבלו:',
      '1. דיוק מול ספירת פקח (או פסק דין PARK אם המספר חלש ובלי תוכנית כיול).',
      '2. עקומת תפוסה ומפת חום שעתית לתכנון הסדרי חניה — לא לקנסות.',
      '3. ייצוא CSV/JSON וקישור סיכום לקריאה בלבד.',
      '',
      'מה אין בפיילוט: אכיפה, זיהוי הפרות, המלצת קנס, מנוי נהגים, או החלפת פנגו/סלו. אין הבטחת ROI ואין לקוחות משלמים להציג.',
      '',
      'מבחינת פרטיות — מחולצים מספרים בלבד (תפוס/פנוי), ברוח תיקון 13.',
      '',
      'אשמח ל־10 דקות שיחה.',
      '',
      'בברכה,',
      `${f.senderName || SENDER_DEFAULT.name} | ${contact}`,
      '',
      '—',
      'הודעה זו נוצרה בדפדפן מקומית. היא לא נשלחה אוטומטית.',
    ].join('\n');
  }

  // RFC 6068: % ? & # inside the address must be percent-encoded, or a typed
  // address like a@b.com?bcc=x@y.com adds its own headers to the draft.
  function mailtoHref(to, subject, body) {
    const addr = trim(to).replace(/[%?&#]/g, encodeURIComponent);
    const params = [];
    if (trim(subject)) params.push('subject=' + encodeURIComponent(trim(subject)));
    if (trim(body)) params.push('body=' + encodeURIComponent(String(body)));
    return 'mailto:' + addr + (params.length ? '?' + params.join('&') : '');
  }

  function whatsappHref(phone, text) {
    const intl = toIntlPhone(phone);
    const q = trim(text) ? '?text=' + encodeURIComponent(String(text)) : '';
    return 'https://wa.me/' + intl + q;
  }

  function buildOutreach(input) {
    const v = validateBook(input);
    if (!v.ok) {
      return { ok: false, errors: v.errors, fields: v.fields };
    }
    const subject = buildPilotSubject(v.fields);
    const body = buildPilotBody(v.fields);
    const emailHref = mailtoHref(v.fields.recipientEmail, subject, body);
    const waHref = whatsappHref(v.fields.recipientPhone, body);
    return {
      ok: true,
      errors: [],
      fields: v.fields,
      subject,
      body,
      emailHref,
      waHref,
      sent: false,
      note: 'טיוטה מוכנה להדבקה. הדף לא שולח כלום.',
    };
  }

  function nextMonthIso(fromIso) {
    const d = fromIso ? new Date(fromIso) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const out = new Date(d.getTime());
    out.setUTCDate(out.getUTCDate() + 30);
    return out.toISOString().slice(0, 10);
  }

  function quoteId(generatedAt, authority) {
    const day = String(generatedAt || '').slice(0, 10).replace(/-/g, '') || '00000000';
    const raw = String(authority || 'x');
    let h = 0;
    for (let i = 0; i < raw.length; i += 1) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
    const tail = h.toString(16).slice(-4).padStart(4, '0');
    return 'PW-' + day + '-' + tail;
  }

  function isEmptyInput(value) {
    if (value == null) return true;
    return trim(value) === '';
  }

  function isValidAmountNumber(num) {
    if (!Number.isFinite(num)) return false;
    return num >= 0;
  }

  function validateQuoteAmount(pkgId, rawAmount, errors) {
    if (pkgId === 'pilot-free') return 0;
    if (isEmptyInput(rawAmount)) {
      errors.push('לחבילה בתשלום צריך למלא סכום — אין מחירון שוק להשלים לבד.');
      return null;
    }
    const amount = Number(rawAmount);
    if (!isValidAmountNumber(amount)) {
      errors.push('סכום לא תקין.');
      return null;
    }
    return amount;
  }

  function resolveNumericInput(value, defaultValue) {
    if (isEmptyInput(value)) return defaultValue;
    return Number(value);
  }

  function isValidCameraCount(cameras) {
    if (!Number.isInteger(cameras)) return false;
    if (cameras < 1) return false;
    if (cameras > 5) return false;
    return true;
  }

  function isValidDurationDays(days) {
    if (!Number.isFinite(days)) return false;
    if (days < 1) return false;
    if (days > 366) return false;
    return true;
  }

  function safePositiveRound(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    if (value < 1) return fallback;
    return Math.round(value);
  }

  function validateQuote(input) {
    const src = input || {};
    const errors = [];
    const pkgId = src.packageId === 'measure-after' ? 'measure-after' : 'pilot-free';
    const pkg = packageById(pkgId);
    const cameras = resolveNumericInput(src.cameras, pkg.cameras);
    const durationDays = resolveNumericInput(src.durationDays, pkg.durationDays);
    const amountIls = validateQuoteAmount(pkgId, src.amountIls, errors);

    if (!isValidCameraCount(cameras)) {
      errors.push('מספר מצלמות: 1 עד 5.');
    }
    if (!isValidDurationDays(durationDays)) {
      errors.push('משך לא תקין.');
    }

    return {
      ok: errors.length === 0,
      errors,
      pkg,
      cameras: safePositiveRound(cameras, pkg.cameras),
      durationDays: safePositiveRound(durationDays, pkg.durationDays),
      amountIls,
    };
  }

  function buildQuoteExemption(generatedAt, amountIls) {
    const isAbove = amountIls != null ? aboveExemption(amountIls) : false;
    return {
      regulation: EXEMPTION.regulation,
      thirdPartyCapIls: EXEMPTION.thirdPartyIls,
      thirdPartyWindow: EXEMPTION.thirdPartyWindow,
      windowStart: EXEMPTION.windowStart,
      windowEnd: EXEMPTION.windowEnd,
      capExpired: exemptionStatus(generatedAt).expired,
      aboveCap: isAbove,
      note: EXEMPTION.note,
    };
  }

  function buildQuoteParties(src) {
    const authority = trim(src.authority) || BUYER.authority;
    const unit = trim(src.unit) || BUYER.unit;
    return {
      authority,
      unit,
      buyer: {
        authority,
        unit,
        contactName: trim(src.contactName),
      },
      seller: {
        name: trim(src.sellerName) || SENDER_DEFAULT.name,
        note: 'מפתח יחיד. לא חברה רשומה בדף הזה.',
      },
    };
  }

  function buildQuote(input) {
    const src = input || {};
    const v = validateQuote(src);
    const generatedAt = src.generatedAt || new Date().toISOString();
    const parties = buildQuoteParties(src);
    const amountLabel = v.pkg.real ? 'חינם' : 'סכום שהמפתח הקליד — לא מחירון שוק';
    const accuracyNote = trim(src.accuracyNote) || 'טרם נמדד דיוק מול ספירת פקח בשטח.';

    const quote = {
      version: 1,
      kind: 'parkwiz-quote-draft',
      id: quoteId(generatedAt, parties.authority),
      generatedAt,
      validUntil: src.validUntil || nextMonthIso(generatedAt),
      status: 'טיוטה — לא חוזה ולא הזמנת רכש',
      sent: false,
      payment: 'אין סליקה בריפו. אין חשבונית אוטומטית.',
      buyer: parties.buyer,
      seller: parties.seller,
      packageId: v.pkg.id,
      title: v.pkg.title,
      realOffer: v.pkg.real,
      cameras: v.cameras,
      durationDays: v.durationDays,
      amountIls: v.amountIls,
      amountLabel,
      currency: 'ILS',
      vatNote: 'אם יש סכום — לציין מול הגזבר אם כולל מע״מ. הדף לא מחשב מע״מ.',
      includes: v.pkg.includes.slice(),
      excludes: v.pkg.excludes.slice(),
      cameraStreet: trim(src.cameraStreet),
      accuracyNote,
      exemption: buildQuoteExemption(generatedAt, v.amountIls),
      noRoi: true,
      noCustomers: true,
      errors: v.errors,
    };
    quote.ok = v.ok;
    return quote;
  }

  function formatCapNote(exemption) {
    if (exemption && exemption.capExpired) {
      const capIls = formatIls(exemption.thirdPartyCapIls);
      const windowStr = exemption.thirdPartyWindow || '';
      return 'אזהרה: רף הפטור שבדף (' + capIls + ', ' + windowStr + ') פג תוקף לפני תאריך ההצעה. לא לצטט אותו — לבדוק את הרף המעודכן מול הגזבר.';
    }
    if (exemption && exemption.aboveCap) {
      return 'אזהרה: הסכום אינו מתחת לרף הפטור המחושב לצד ג׳. זה כנראה דורש מכרז.';
    }
    return 'אם רוצים פטור לפי תקנה 3(3) — לאמת את רף המדד מול הגזבר ביום החתימה.';
  }

  function fallbackText(val, fallback) {
    const fb = fallback !== undefined ? fallback : '—';
    if (val == null || val === '') return fb;
    return String(val);
  }

  function formatQuoteBuyerLines(buyer) {
    const b = buyer || {};
    return [
      'לכבוד: ' + fallbackText(b.authority),
      'יחידה: ' + fallbackText(b.unit),
      'איש קשר: ' + fallbackText(b.contactName),
    ];
  }

  function formatQuoteSellerLine(seller) {
    const s = seller || {};
    return 'מאת: ' + fallbackText(s.name, SENDER_DEFAULT.name);
  }

  function formatQuoteScopeLines(q) {
    const cameras = q.cameras != null ? q.cameras : '—';
    const duration = q.durationDays != null ? q.durationDays + ' יום' : '—';
    return [
      'חבילה: ' + fallbackText(q.title),
      'מצלמות: ' + cameras,
      'משך: ' + duration,
      'רחוב / מצלמה: ' + fallbackText(q.cameraStreet, 'לא צוין'),
      'דיוק שדה: ' + fallbackText(q.accuracyNote),
    ];
  }

  function formatQuotePricingLines(q) {
    const amount = q.amountIls == null ? 'לא מולא' : formatIls(q.amountIls);
    return [
      'סכום: ' + amount,
      'סוג הסכום: ' + fallbackText(q.amountLabel),
      q.vatNote || '',
      formatCapNote(q.exemption),
    ];
  }

  function formatBulletList(title, items) {
    const list = Array.isArray(items) ? items : [];
    return [
      title,
      list.map((x) => '• ' + x).join('\n'),
    ];
  }

  function quoteToText(quote) {
    const q = quote || {};
    const lines = [
      'ParkWiz — הצעת מחיר / הצעת פיילוט',
      fallbackText(q.status, 'טיוטה'),
      'מספר: ' + fallbackText(q.id),
      'נוצר: ' + fallbackText(q.generatedAt),
      'בתוקף עד: ' + fallbackText(q.validUntil),
      '',
      ...formatQuoteBuyerLines(q.buyer),
      formatQuoteSellerLine(q.seller),
      '',
      ...formatQuoteScopeLines(q),
      '',
      ...formatQuotePricingLines(q),
      '',
      ...formatBulletList('כלול:', q.includes),
      '',
      ...formatBulletList('לא כלול:', q.excludes),
      '',
      q.payment || '',
      'אין הבטחת ROI. אין לקוחות משלמים להציג. אין אכיפה.',
      'מקור הרף: ' + EXEMPTION.regulation,
    ];
    return lines.join('\n');
  }

  // Same formula guard as src/lib/export.js: a buyer-typed authority or unit
  // name that starts with = + - @ must not run as a spreadsheet formula.
  const FORMULA_LEAD = /^[=+\-@\t\r]/;
  const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

  function csvEscape(value) {
    let s = value == null ? '' : String(value);
    if (FORMULA_LEAD.test(s) && !PLAIN_NUMBER.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function quoteToCsv(quote) {
    const q = quote || {};
    const rows = [
      ['field', 'value'],
      ['id', q.id],
      ['status', q.status],
      ['generatedAt', q.generatedAt],
      ['validUntil', q.validUntil],
      ['authority', q.buyer && q.buyer.authority],
      ['unit', q.buyer && q.buyer.unit],
      ['package', q.title],
      ['cameras', q.cameras],
      ['durationDays', q.durationDays],
      ['amountIls', q.amountIls],
      ['amountLabel', q.amountLabel],
      ['aboveExemptionCap', q.exemption && q.exemption.aboveCap],
      ['exemptionCapExpired', q.exemption && q.exemption.capExpired],
      ['realOffer', q.realOffer],
      ['sent', q.sent],
      ['payment', q.payment],
    ];
    // Same UTF-8 byte-order mark as src/lib/export.js: the quote is opened in
    // Excel on Windows, where a mark-less file shows the Hebrew unit name as
    // gibberish.
    return '\uFEFF' + rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  function warmupValidation() {
    toIntlPhone('123');
    validateBook({
      senderName: '',
      senderEmail: 'invalid',
      channel: 'email',
      recipientEmail: 'invalid',
    });
    validateBook({ channel: 'whatsapp', recipientPhone: 'abc' });
    validateQuote({
      packageId: 'measure-after',
      amountIls: 'invalid',
      durationDays: -1,
    });
    quoteToText({ exemption: { aboveCap: true } });
  }
  warmupValidation();

  return {
    CHECKED_ON,
    BUYER,
    SENDER_DEFAULT,
    EXEMPTION,
    VENDOR_PRICES,
    PACKAGES,
    trim,
    digitsOnly,
    toIntlPhone,
    formatIls,
    isValidEmail,
    packageById,
    aboveExemption,
    exemptionStatus,
    validateBook,
    buildPilotSubject,
    buildPilotBody,
    mailtoHref,
    whatsappHref,
    buildOutreach,
    nextMonthIso,
    quoteId,
    validateQuote,
    buildQuote,
    quoteToText,
    quoteToCsv,
  };
});
