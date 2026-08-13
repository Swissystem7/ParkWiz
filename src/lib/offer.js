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
    thirdPartyIls: 169800,
    thirdPartyWindow: '16.7.2026–15.8.2026',
    thirdPartySource: 'https://www.c-on.com/copy-of-%D7%9E%D7%9B%D7%A8%D7%96%D7%99%D7%9D',
    official2026File: null,
    note: '169,800 ₪ הוא חישוב צד ג׳ לחלון יולי–אוגוסט 2026, לא קובץ רשמי של משרד הפנים. פטור עדיין דורש גזבר.',
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

  function toIntlPhone(phone) {
    const d = digitsOnly(phone);
    if (!d) return '';
    if (d.startsWith('972')) return d;
    if (d.startsWith('0') && d.length >= 9) return '972' + d.slice(1);
    return d;
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

  function validateBook(input) {
    const src = input || {};
    const errors = [];
    const senderName = trim(src.senderName) || SENDER_DEFAULT.name;
    const senderPhone = trim(src.senderPhone);
    const senderEmail = trim(src.senderEmail);
    const recipientName = trim(src.recipientName);
    const channel = src.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const recipientEmail = trim(src.recipientEmail);
    const recipientPhone = trim(src.recipientPhone) || BUYER.whatsapp;
    if (!senderName) errors.push('חסר שם השולח.');
    if (!senderPhone && !senderEmail) errors.push('צריך טלפון או מייל של השולח.');
    if (senderEmail && !isValidEmail(senderEmail)) errors.push('מייל השולח לא תקין.');
    if (channel === 'email') {
      if (!recipientEmail) errors.push('חסר מייל נמען.');
      else if (!isValidEmail(recipientEmail)) errors.push('מייל הנמען לא תקין.');
    } else if (!digitsOnly(recipientPhone)) {
      errors.push('חסר מספר WhatsApp.');
    }
    return {
      ok: errors.length === 0,
      errors,
      fields: {
        senderName,
        senderPhone,
        senderEmail,
        senderRole: trim(src.senderRole) || SENDER_DEFAULT.role,
        recipientName: recipientName || 'מוביל/ת עיר חכמה',
        recipientRole: trim(src.recipientRole) || 'מוביל/ת עיר חכמה',
        recipientUnit: trim(src.recipientUnit) || BUYER.unit,
        authority: trim(src.authority) || BUYER.authority,
        channel,
        recipientEmail,
        recipientPhone,
        cameraStreet: trim(src.cameraStreet),
        accuracyNote: trim(src.accuracyNote) || 'טרם נמדד דיוק מול ספירת פקח בשטח.',
      },
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

  function mailtoHref(to, subject, body) {
    const addr = trim(to);
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

  function validateQuote(input) {
    const src = input || {};
    const errors = [];
    const pkgId = src.packageId === 'measure-after' ? 'measure-after' : 'pilot-free';
    const pkg = packageById(pkgId);
    const cameras = src.cameras == null || trim(src.cameras) === ''
      ? pkg.cameras
      : Number(src.cameras);
    const durationDays = src.durationDays == null || trim(src.durationDays) === ''
      ? pkg.durationDays
      : Number(src.durationDays);
    let amountIls;
    if (pkgId === 'pilot-free') {
      amountIls = 0;
    } else if (src.amountIls == null || trim(src.amountIls) === '') {
      amountIls = null;
      errors.push('לחבילה בתשלום צריך למלא סכום — אין מחירון שוק להשלים לבד.');
    } else {
      amountIls = Number(src.amountIls);
      if (!Number.isFinite(amountIls) || amountIls < 0) {
        errors.push('סכום לא תקין.');
        amountIls = null;
      }
    }
    if (!Number.isFinite(cameras) || cameras < 1 || cameras > 5) {
      errors.push('מספר מצלמות: 1 עד 5.');
    }
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 366) {
      errors.push('משך לא תקין.');
    }
    return {
      ok: errors.length === 0,
      errors,
      pkg,
      cameras: Number.isFinite(cameras) && cameras >= 1 ? Math.round(cameras) : pkg.cameras,
      durationDays: Number.isFinite(durationDays) && durationDays >= 1 ? Math.round(durationDays) : pkg.durationDays,
      amountIls,
    };
  }

  function buildQuote(input) {
    const src = input || {};
    const v = validateQuote(src);
    const generatedAt = src.generatedAt || new Date().toISOString();
    const authority = trim(src.authority) || BUYER.authority;
    const unit = trim(src.unit) || BUYER.unit;
    const quote = {
      version: 1,
      kind: 'parkwiz-quote-draft',
      id: quoteId(generatedAt, authority),
      generatedAt,
      validUntil: src.validUntil || nextMonthIso(generatedAt),
      status: 'טיוטה — לא חוזה ולא הזמנת רכש',
      sent: false,
      payment: 'אין סליקה בריפו. אין חשבונית אוטומטית.',
      buyer: {
        authority,
        unit,
        contactName: trim(src.contactName) || '',
      },
      seller: {
        name: trim(src.sellerName) || SENDER_DEFAULT.name,
        note: 'מפתח יחיד. לא חברה רשומה בדף הזה.',
      },
      packageId: v.pkg.id,
      title: v.pkg.title,
      realOffer: v.pkg.real,
      cameras: v.cameras,
      durationDays: v.durationDays,
      amountIls: v.amountIls,
      amountLabel: v.pkg.real ? 'חינם' : 'סכום שהמפתח הקליד — לא מחירון שוק',
      currency: 'ILS',
      vatNote: 'אם יש סכום — לציין מול הגזבר אם כולל מע״מ. הדף לא מחשב מע״מ.',
      includes: v.pkg.includes.slice(),
      excludes: v.pkg.excludes.slice(),
      cameraStreet: trim(src.cameraStreet),
      accuracyNote: trim(src.accuracyNote) || 'טרם נמדד דיוק מול ספירת פקח בשטח.',
      exemption: {
        regulation: EXEMPTION.regulation,
        thirdPartyCapIls: EXEMPTION.thirdPartyIls,
        thirdPartyWindow: EXEMPTION.thirdPartyWindow,
        aboveCap: v.amountIls != null && aboveExemption(v.amountIls),
        note: EXEMPTION.note,
      },
      noRoi: true,
      noCustomers: true,
      errors: v.errors,
    };
    quote.ok = v.ok;
    return quote;
  }

  function quoteToText(quote) {
    const q = quote || {};
    const amount = q.amountIls == null ? 'לא מולא' : formatIls(q.amountIls);
    const cap = q.exemption && q.exemption.aboveCap
      ? 'אזהרה: הסכום אינו מתחת לרף הפטור המחושב לצד ג׳. זה כנראה דורש מכרז.'
      : 'אם רוצים פטור לפי תקנה 3(3) — לאמת את רף המדד מול הגזבר ביום החתימה.';
    return [
      'ParkWiz — הצעת מחיר / הצעת פיילוט',
      q.status || 'טיוטה',
      'מספר: ' + (q.id || '—'),
      'נוצר: ' + (q.generatedAt || '—'),
      'בתוקף עד: ' + (q.validUntil || '—'),
      '',
      'לכבוד: ' + ((q.buyer && q.buyer.authority) || '—'),
      'יחידה: ' + ((q.buyer && q.buyer.unit) || '—'),
      'איש קשר: ' + ((q.buyer && q.buyer.contactName) || '—'),
      'מאת: ' + ((q.seller && q.seller.name) || SENDER_DEFAULT.name),
      '',
      'חבילה: ' + (q.title || '—'),
      'מצלמות: ' + (q.cameras != null ? q.cameras : '—'),
      'משך: ' + (q.durationDays != null ? q.durationDays + ' יום' : '—'),
      'רחוב / מצלמה: ' + (q.cameraStreet || 'לא צוין'),
      'דיוק שדה: ' + (q.accuracyNote || '—'),
      '',
      'סכום: ' + amount,
      'סוג הסכום: ' + (q.amountLabel || '—'),
      q.vatNote || '',
      cap,
      '',
      'כלול:',
      (q.includes || []).map((x) => '• ' + x).join('\n'),
      '',
      'לא כלול:',
      (q.excludes || []).map((x) => '• ' + x).join('\n'),
      '',
      q.payment || '',
      'אין הבטחת ROI. אין לקוחות משלמים להציג. אין אכיפה.',
      'מקור הרף: ' + EXEMPTION.regulation,
    ].join('\n');
  }

  function csvEscape(value) {
    const s = value == null ? '' : String(value);
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
      ['realOffer', q.realOffer],
      ['sent', q.sent],
      ['payment', q.payment],
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }

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
