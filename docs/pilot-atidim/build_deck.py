# Builds docs/pilot-atidim/parkwiz-pilot-atidim.pptx (Hebrew, RTL) for the Atidim park meeting.
# Standalone generator: nothing imports it. Content follows the Gemini "כלים" brief (16.11.2026)
# and the honesty lines in docs/pilot-atidim.md (simulation, accuracy not yet measured in the field).
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Pt

W, H = Emu(12192000), Emu(6858000)  # 16:9
INK = RGBColor(0x10, 0x1A, 0x24)
MUTED = RGBColor(0x4A, 0x57, 0x66)
ACCENT = RGBColor(0x0B, 0x6B, 0xCB)
LINE = RGBColor(0xC9, 0xD2, 0xDC)
SOFT = RGBColor(0xEE, 0xF3, 0xF8)
WARN = RGBColor(0x8A, 0x4B, 0x00)
WARN_BG = RGBColor(0xFF, 0xF1, 0xDC)
FONT = "Arial"

prs = Presentation()
prs.slide_width, prs.slide_height = W, H
BLANK = prs.slide_layouts[6]


def rtl(par):
    par.alignment = PP_ALIGN.RIGHT
    par._p.get_or_add_pPr().set("rtl", "1")


def text(slide, x, y, w, h, lines, size=18, color=INK, bold=False, anchor=MSO_ANCHOR.TOP, gap=6):
    box = slide.shapes.add_textbox(Emu(x), Emu(y), Emu(w), Emu(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    if isinstance(lines, str):
        lines = [lines]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        rtl(p)
        p.space_after = Pt(gap)
        r = p.add_run()
        r.text = ln
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.name = FONT
        r.font.color.rgb = color
    return box


def rect(slide, x, y, w, h, fill=SOFT, line=None):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(x), Emu(y), Emu(w), Emu(h))
    s.adjustments[0] = 0.06
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(1)
    s.shadow.inherit = False
    return s


M = 610000  # side margin
CW = 12192000 - 2 * M


def header(slide, title, n):
    text(slide, M, 420000, CW, 700000, title, size=32, bold=True)
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(12192000 - M - 900000), Emu(1130000), Emu(900000), Emu(50000))
    bar.fill.solid(); bar.fill.fore_color.rgb = ACCENT; bar.line.fill.background(); bar.shadow.inherit = False
    foot = slide.shapes.add_textbox(Emu(M), Emu(6380000), Emu(CW), Emu(300000))
    p = foot.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = f"ParkWiz · פיילוט פארק עתידים · {n}/7"
    r.font.size = Pt(11); r.font.name = FONT; r.font.color.rgb = MUTED


def cards(slide, items, y=1500000, h=3700000, cols=None):
    cols = cols or len(items)
    gap = 250000
    cw = (CW - gap * (cols - 1)) // cols
    for i, (head, body) in enumerate(items):
        # RTL order: first card on the right
        x = 12192000 - M - cw - i * (cw + gap)
        rect(slide, x, y, cw, h)
        text(slide, x + 200000, y + 180000, cw - 400000, 700000, head, size=20, bold=True, color=ACCENT)
        text(slide, x + 200000, y + 900000, cw - 400000, h - 1050000, body, size=18, color=INK, gap=8)


# 1. Title
s = prs.slides.add_slide(BLANK)
text(s, M, 1900000, CW, 1100000, "ParkWiz — פיילוט בפארק עתידים", size=44, bold=True)
text(s, M, 3050000, CW, 700000, "כמה חניות פנויות יש עכשיו, בלי לזהות אף רכב ואף אדם", size=24, color=MUTED)
text(s, M, 4300000, CW, 900000, ["12–20 חניות · בניין 6 · 4 שבועות", "פגישה עם רוני נדלר, מנהל חניוני פארק עתידים"], size=18, color=INK)
bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(12192000 - M - 1400000), Emu(3880000), Emu(1400000), Emu(60000))
bar.fill.solid(); bar.fill.fore_color.rgb = ACCENT; bar.line.fill.background(); bar.shadow.inherit = False

# 2. Problem
s = prs.slides.add_slide(BLANK)
header(s, "הבעיה: מחפשים חניה בלי לדעת איפה יש", 2)
cards(s, [
    ("סבבים בשעת שיא", ["בבוקר העובדים מגיעים בחלון צר ומסתובבים בין המפלסים.", "לפי עקומת התפוסה האופיינית, החלון הצפוף הוא 09:00–14:00."]),
    ("אין נתון חי", ["אין מספר פנויים בזמן אמת.", "הנהג מגלה שהמפלס מלא רק אחרי שירד אליו."]),
    ("אין תמונת עומס", ["ההחלטה לפתוח מפלס נוסף מתקבלת מתחושה של השומר בשער, לא מנתון של אתמול באותה שעה."]),
])
text(s, M, 5400000, CW, 500000, "העקומה היא דפוס אופייני של פארק עסקי ולא מדידה של עתידים. הפיילוט הוא מה שיהפוך אותה למדידה.", size=14, color=MUTED)

# 3. What we propose
s = prs.slides.add_slide(BLANK)
header(s, "ההצעה: פיילוט קטן ומדיד בבניין 6", 3)
cards(s, [
    ("היקף", ["12–20 חניות בבניין 6.", "אזור אחד, מוגדר מראש יחד איתכם."]),
    ("מה מקבלים", ["תפוס / פנוי לכל חניה, בזמן אמת.", "עקומת עומס שעתית ויומית.", "דוח בוקר של עמוד אחד."]),
    ("מה לא נוגעים", ["בלי קידוח ובלי חציבה באספלט.", "בלי חיבור למערכות אחרות של הפארק.", "בלי אכיפה ובלי דוחות על נהגים."]),
])

# 4. Privacy
s = prs.slides.add_slide(BLANK)
header(s, "פרטיות: מהחניון יוצאים רק שלושה שדות", 4)
rect(s, M, 1500000, CW, 1250000, fill=RGBColor(0x10, 0x1A, 0x24))
box = s.shapes.add_textbox(Emu(M), Emu(1700000), Emu(CW), Emu(850000))
p = box.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
r = p.add_run(); r.text = '{ "id": "B6-07", "status": "free", "ts": "2026-11-16T09:12" }'
r.font.size = Pt(20); r.font.name = "Consolas"; r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
cards(s, [
    ("טשטוש מקומי", ["פנים ולוחיות רישוי מטושטשים על המכשיר עצמו, לפני כל עיבוד אחר."]),
    ("וידאו לא יוצא", ["התמונה מעובדת במקום ונזרקת. לא נשמרת ולא נשלחת."]),
    ("רק מצב חניה", ["id: מספר החניה.", "status: תפוס / פנוי.", "ts: זמן."]),
], y=3000000, h=2500000)

# 5. Installation
s = prs.slides.add_slide(BLANK)
header(s, "ההתקנה: בלי קידוח, עם חשמל רציף", 5)
cards(s, [
    ("מתקן מודפס בתלת־ממד", ["המכשיר יושב על מתקן שמתחבר בלי קידוח.", "אפשר להסיר אותו בסוף הפיילוט בלי להשאיר סימן."]),
    ("ספק כוח 24/7", ["המכשיר צריך חשמל רציף.", "זה הדבר היחיד שאנחנו מבקשים מהתשתית של הבניין."]),
    ("מה צריך מעתידים", ["אישור לנקודת התקנה אחת בבניין 6.", "נקודת חשמל.", "איש קשר אחד לתיאום ולספירות הבקרה."]),
])

# 6. Timeline + success
s = prs.slides.add_slide(BLANK)
header(s, "4 שבועות, ושני מדדים שנקבעים מראש", 6)
cards(s, [
    ("שבוע 1", ["התקנה וסימון החניות.", "תמונת מצב ראשונה."]),
    ("שבועות 2–3", ["מדידה רציפה בשעות הפעילות.", "ספירה ידנית מול המערכת בשעת שיא."]),
    ("שבוע 4", ["דוח: דיוק ועקומת עומס.", "פגישת החלטה משותפת."]),
], y=1500000, h=2300000)
rect(s, M, 4050000, CW, 1900000, fill=SOFT)
text(s, M + 250000, 4200000, CW - 500000, 1650000, [
    "מדדי הצלחה",
    "1. דיוק מול ספירה ידנית: פער של עד חניה אחת ברוב התצפיות בשעות היום.",
    "2. דקות שנחסכות בשעת שיא: זמן חיפוש לפני ואחרי, על מדגם הגעות בבוקר.",
], size=16, gap=8)

# 7. After the pilot + ask
s = prs.slides.add_slide(BLANK)
header(s, "אחרי הפיילוט, ומה מבקשים היום", 7)
cards(s, [
    ("מודל להמשך — לדיון", ["אם המדדים עומדים ביעד: מנוי חודשי לפי מספר חניות מנוטרות.", "אפשרות לבדוק חיבור לאפליקציית תשלום קיימת (למשל פנגו).", "מחירים ותנאים לא נקבעו. הם נושא לפגישת ההחלטה."]),
    ("מה מבקשים היום", ["אישור עקרוני לפיילוט של 4 שבועות.", "בחירת 12–20 החניות בבניין 6.", "נקודת חשמל ואיש קשר."]),
], y=1500000, h=3000000, cols=2)
rect(s, M, 4750000, CW, 1200000, fill=WARN_BG)
text(s, M + 250000, 4880000, CW - 500000, 1000000, [
    "גילוי נאות: הדמו שתראו הוא הדמיה בדפדפן, לא שידור ממצלמה בפארק. הדיוק עוד לא נמדד בשטח.",
    "הפיילוט הזה הוא בדיוק מה שיהפוך את ההדמיה למדידה.",
], size=15, color=WARN, gap=6)

prs.save("parkwiz-pilot-atidim.pptx")
print("saved", len(prs.slides), "slides")
