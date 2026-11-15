"""Build the RANTAI slide deck as a native, editable PPTX.

Why python-pptx rather than an image-per-slide workflow: every word stays real
text the jury can select, search, copy and restyle, and every diagram is vector
shapes rather than a bitmap. That reads sharper on a projector and on a final
round where someone may want to open the file.

Layouts are driven from video/deck.json so numbers cannot drift from the README,
the video, or the running app.
"""
from __future__ import annotations

import json
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
DECK = json.loads((ROOT / "video" / "deck.json").read_text(encoding="utf-8"))

OUT = ROOT / "docs" / "rantai-slides.pptx"

# --- palette (mirrors src/styles.css tokens) -------------------------------
NAVY = RGBColor(0x2C, 0x36, 0x44)
NAVY_DEEP = RGBColor(0x22, 0x2B, 0x36)
INK = RGBColor(0x20, 0x2A, 0x36)
INK2 = RGBColor(0x35, 0x41, 0x52)
MUTED = RGBColor(0x55, 0x64, 0x7A)
FAINT = RGBColor(0x63, 0x72, 0x86)
RULE = RGBColor(0xE1, 0xE5, 0xEA)
RULE2 = RGBColor(0xCF, 0xD6, 0xDF)
PAPER = RGBColor(0xFF, 0xFF, 0xFF)
SUNK = RGBColor(0xF7, 0xF9, 0xFC)
ACCENT = RGBColor(0x18, 0x66, 0xDB)
ACCENT_WASH = RGBColor(0xE8, 0xF0, 0xFE)
SIGNAL = RGBColor(0xB8, 0x32, 0x32)
SIGNAL_WASH = RGBColor(0xFD, 0xEC, 0xEB)
VERIFY = RGBColor(0x2C, 0x6F, 0x52)
VERIFY_WASH = RGBColor(0xE6, 0xF4, 0xEE)
CAUTION = RGBColor(0x8A, 0x58, 0x10)
CAUTION_WASH = RGBColor(0xFD, 0xF3, 0xE2)
ORANGE = RGBColor(0xA9, 0x54, 0x1F)
GOLD = RGBColor(0x7D, 0x5C, 0x0F)
GOLD_WASH = RGBColor(0xFB, 0xF4, 0xDC)

SANS = "Archivo"
MONO = "IBM Plex Mono"

TONE = {
    "ok": (VERIFY, VERIFY_WASH),
    "no": (SIGNAL, SIGNAL_WASH),
    "warn": (CAUTION, CAUTION_WASH),
}

W = Inches(13.333)
H = Inches(7.5)

prs = Presentation()
prs.slide_width = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]


# --- helpers ---------------------------------------------------------------
def slide():
    return prs.slides.add_slide(BLANK)


def rect(s, x, y, w, h, fill=None, line=None, lw=1.25, radius=None):
    shape = s.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)),
    )
    if radius:
        try:
            shape.adjustments[0] = radius
        except Exception:
            pass
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(lw)
    shape.shadow.inherit = False
    return shape


def text(s, x, y, w, h, runs, size=18, color=INK, bold=False, font=SANS,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, space=0, line_spacing=1.28):
    tb = s.shapes.add_textbox(Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    if isinstance(runs, str):
        runs = [runs]
    for i, line in enumerate(runs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        if space and i:
            p.space_before = Pt(space)
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.name = font
        r.font.color.rgb = color
    return tb


def chrome(s, eyebrow=None, dark=False):
    """Top brand bar + eyebrow, consistent on every slide."""
    rect(s, 0, 0, W, Inches(0.62), fill=NAVY)
    rect(s, Inches(0.42), Inches(0.13), Inches(0.34), Inches(0.34), fill=ACCENT, radius=0.22)
    text(s, Inches(0.86), Inches(0.13), Inches(3.0), Inches(0.24), "RANTAI", size=15,
         color=RGBColor(0xFF, 0xFF, 0xFF), bold=True)
    text(s, Inches(0.86), Inches(0.35), Inches(5.0), Inches(0.18),
         "BERKAS BUKTI & KOORDINASI INSIDEN", size=7, color=RGBColor(0xAA, 0xB6, 0xC5), font=MONO)
    text(s, Inches(9.6), Inches(0.16), Inches(3.3), Inches(0.34),
         ["Kartika Cyber Hackathon 2026", "Kategori Penangkalan"], size=8.5,
         color=RGBColor(0xAA, 0xB6, 0xC5), align=PP_ALIGN.RIGHT, line_spacing=1.3)
    if eyebrow:
        text(s, Inches(0.62), Inches(0.92), Inches(11.0), Inches(0.24), eyebrow.upper(),
             size=9.5, color=ACCENT, font=MONO, bold=True)


def footer(s, page, total):
    rect(s, Inches(0.62), H - Inches(0.52), W - Inches(1.24), Emu(9525), fill=RULE)
    text(s, Inches(0.62), H - Inches(0.42), Inches(6.0), Inches(0.24),
         "rantai.careday17.workers.dev  ·  data pelatihan sintetis", size=8, color=FAINT, font=MONO)
    text(s, Inches(11.4), H - Inches(0.42), Inches(1.32), Inches(0.24),
         f"{page} / {total}", size=8.5, color=FAINT, font=MONO, align=PP_ALIGN.RIGHT)


def notes(s, body):
    if body:
        s.notes_slide.notes_text_frame.text = body


def picture_fit(s, path: Path, x, y, w, h, frame=True):
    """Insert an image scaled to fit a box, centred, optionally framed."""
    from PIL import Image
    iw, ih = Image.open(path).size
    scale = min(w / iw, h / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    px, py = int(x + (w - nw) / 2), int(y + (h - nh) / 2)
    if frame:
        rect(s, px - Emu(19050), py - Emu(19050), nw + Emu(38100), nh + Emu(38100),
             fill=PAPER, line=RULE2)
    s.shapes.add_picture(str(path), Emu(px), Emu(py), Emu(nw), Emu(nh))


# --- layouts ---------------------------------------------------------------
def layout_title(s, d):
    rect(s, 0, 0, W, H, fill=NAVY_DEEP)
    chrome(s, None, dark=True)
    text(s, Inches(0.9), Inches(1.55), Inches(11.5), Inches(0.3), d["eyebrow"],
         size=10, color=RGBColor(0x6F, 0xA4, 0xF0), font=MONO, bold=True)
    y = Inches(2.0)
    for i, line in enumerate(d["headline"]):
        text(s, Inches(0.9), y, Inches(11.4), Inches(0.95), line, size=42,
             color=RGBColor(0xFF, 0xFF, 0xFF) if i < 2 else RGBColor(0x8F, 0xA2, 0xBA), bold=True,
             line_spacing=1.16)
        y += Inches(0.86)
    text(s, Inches(0.9), Inches(4.72), Inches(10.2), Inches(0.8), d["lede"], size=17,
         color=RGBColor(0x9F, 0xB0, 0xCA), line_spacing=1.5)
    rect(s, Inches(0.9), Inches(5.62), Inches(1.1), Inches(0.045), fill=ACCENT)
    text(s, Inches(0.9), Inches(5.95), Inches(6.0), Inches(0.3), DECK["live"], size=14,
         color=RGBColor(0x6F, 0xA4, 0xF0), font=MONO)
    text(s, Inches(0.9), Inches(6.3), Inches(7.0), Inches(0.3), DECK["repo"], size=11,
         color=RGBColor(0x8F, 0xA2, 0xBA), font=MONO)


def layout_statement(s, d):
    chrome(s, d["eyebrow"])
    y = Inches(1.42)
    for line in d["headline"]:
        text(s, Inches(0.62), y, Inches(11.9), Inches(0.9), line, size=36, color=INK, bold=True,
             line_spacing=1.18)
        y += Inches(0.78)
    y += Inches(0.28)
    for b in d.get("body", []):
        rect(s, Inches(0.62), y + Inches(0.09), Inches(0.07), Inches(0.2), fill=ACCENT)
        text(s, Inches(0.88), y, Inches(11.4), Inches(0.7), b, size=16, color=INK2, line_spacing=1.45)
        y += Inches(0.66)
    if d.get("formula"):
        y += Inches(0.1)
        rect(s, Inches(0.62), y, Inches(8.4), Inches(0.62), fill=SUNK, line=RULE)
        text(s, Inches(0.85), y + Inches(0.14), Inches(8.0), Inches(0.34), d["formula"],
             size=13, color=INK, font=MONO)


def layout_flow(s, d):
    chrome(s, d["eyebrow"])
    text(s, Inches(0.62), Inches(1.32), Inches(11.9), Inches(0.7), d["headline"][0], size=34,
         color=INK, bold=True)
    steps = d["steps"]
    n = len(steps)
    gap = Inches(0.18)
    total_w = W - Inches(1.24)
    bw = int((total_w - gap * (n - 1)) / n)
    y = Inches(2.9)
    for i, step in enumerate(steps):
        x = Inches(0.62) + i * (bw + gap)
        fill = ACCENT_WASH if i in (1, 3) else PAPER
        edge = ACCENT if i in (1, 3) else RULE2
        rect(s, x, y, bw, Inches(1.42), fill=fill, line=edge)
        text(s, x + Inches(0.18), y + Inches(0.16), bw - Inches(0.36), Inches(0.3),
             f"0{i+1}", size=9.5, color=ACCENT, font=MONO, bold=True)
        text(s, x + Inches(0.18), y + Inches(0.5), bw - Inches(0.36), Inches(0.8), step, size=13,
             color=INK, bold=True, line_spacing=1.25)
        if i < n - 1:
            text(s, x + bw + Emu(2000), y + Inches(0.56), Inches(0.2), Inches(0.3), "›",
                 size=17, color=ACCENT, bold=True)
    text(s, Inches(0.62), Inches(4.75), Inches(11.6), Inches(0.8),
         "Tidak ada langkah yang melewati pencatatan audit. Setiap mutasi tercatat pada rantai hash-linked.",
         size=14, color=MUTED, line_spacing=1.5)


def layout_shots(s, d):
    chrome(s, d["eyebrow"])
    text(s, Inches(0.62), Inches(1.3), Inches(11.9), Inches(0.6), d["headline"][0], size=32,
         color=INK, bold=True)
    imgs = d["images"]
    n = len(imgs)
    gap = Inches(0.22)
    total = W - Inches(1.24)
    cw = int((total - gap * (n - 1)) / n)
    ch = Inches(2.7)
    y = Inches(2.28)
    for i, im in enumerate(imgs):
        x = Inches(0.62) + i * (cw + gap)
        p = ROOT / im["path"]
        picture_fit(s, p, x, y, cw, ch)
        text(s, x, y + ch + Inches(0.16), cw, Inches(0.3), im["caption"], size=12, color=INK2,
             bold=True)
    text(s, Inches(0.62), Inches(5.72), Inches(11.6), Inches(0.6),
         "Semua tangkapan layar diambil dari prototipe yang berjalan. Data pelatihan sintetis.",
         size=13, color=MUTED)


def svg_to_png(svg_path: Path) -> Path:
    """Rasterise an SVG with headless Chrome, cached beside the source.

    python-pptx cannot embed SVG, and keeping a separate cache directory meant a
    cleaned build tree broke the deck. Caching next to the source keeps the
    dependency self-contained.
    """
    cache = svg_path.parent / ".png-cache"
    cache.mkdir(exist_ok=True)
    out = cache / (svg_path.stem + ".png")
    if out.exists() and out.stat().st_mtime >= svg_path.stat().st_mtime:
        return out

    import re
    import subprocess

    chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    text = svg_path.read_text(encoding="utf-8")
    m = re.search(r'viewBox="0 0 (\d+) (\d+)"', text)
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1040, 520)

    subprocess.run(
        [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         "--force-device-scale-factor=2", f"--window-size={w},{h}",
         f"--screenshot={out}", svg_path.as_uri()],
        check=True, capture_output=True,
    )
    return out


def layout_diagram(s, d):
    chrome(s, d["eyebrow"])
    text(s, Inches(0.62), Inches(1.28), Inches(11.9), Inches(0.6), d["headline"][0], size=30,
         color=INK, bold=True)
    img_path = ROOT / d["image"]
    if img_path.suffix.lower() == ".svg":
        img_path = svg_to_png(img_path)
    picture_fit(s, img_path, Inches(0.62), Inches(2.0), Inches(7.6), Inches(3.5))
    text(s, Inches(0.62), Inches(5.62), Inches(7.6), Inches(0.5), d["caption"], size=11,
         color=MUTED, line_spacing=1.4)
    bx = Inches(8.5)
    by = Inches(2.0)
    for b in d.get("bullets", []):
        rect(s, bx, by + Inches(0.08), Inches(0.06), Inches(0.16), fill=ACCENT)
        text(s, bx + Inches(0.2), by, Inches(4.0), Inches(0.9), b, size=12.5, color=INK2,
             line_spacing=1.4)
        by += Inches(0.78)


def layout_scores(s, d):
    chrome(s, d["eyebrow"])
    text(s, Inches(0.62), Inches(1.24), Inches(11.9), Inches(0.55), d["headline"][0], size=30,
         color=INK, bold=True)
    rect(s, Inches(0.62), Inches(1.86), Inches(5.6), Inches(0.42), fill=SUNK, line=RULE)
    text(s, Inches(0.82), Inches(1.94), Inches(5.2), Inches(0.3), d["formula"], size=11.5,
         color=INK, font=MONO)

    y = Inches(2.52)
    maxbar = Inches(6.5)
    for r in d["rows"]:
        color = {"accent": ACCENT, "orange": ORANGE, "gold": GOLD, "faint": FAINT}[r["color"]]
        text(s, Inches(0.62), y, Inches(4.0), Inches(0.28), r["pair"], size=12, color=INK, bold=True)
        bar_w = int(maxbar * (r["score"] / 100))
        rect(s, Inches(4.7), y + Inches(0.05), maxbar, Inches(0.16), fill=SUNK)
        if bar_w > 0:
            rect(s, Inches(4.7), y + Inches(0.05), bar_w, Inches(0.16), fill=color)
        text(s, Inches(11.4), y - Inches(0.03), Inches(0.9), Inches(0.3), str(r["score"]),
             size=15, color=color, bold=True, font=MONO, align=PP_ALIGN.RIGHT)
        text(s, Inches(0.62), y + Inches(0.24), Inches(11.6), Inches(0.24),
             f"{r['band']} · {r['basis']}", size=9.5, color=MUTED)
        y += Inches(0.72)

    by = y + Inches(0.12)
    for b in d.get("bullets", []):
        rect(s, Inches(0.62), by + Inches(0.07), Inches(0.06), Inches(0.15), fill=ACCENT)
        text(s, Inches(0.85), by, Inches(11.4), Inches(0.4), b, size=11.5, color=INK2)
        by += Inches(0.36)


def layout_ladder(s, d):
    chrome(s, d["eyebrow"])
    text(s, Inches(0.62), Inches(1.24), Inches(11.9), Inches(0.55), d["headline"][0], size=30,
         color=INK, bold=True)
    y = Inches(2.0)
    for st in d["steps"]:
        fg, bg = TONE[st["tone"]]
        rect(s, Inches(0.62), y, Inches(7.7), Inches(0.66), fill=bg, line=fg, lw=1.0)
        rect(s, Inches(0.62), y, Inches(0.46), Inches(0.66), fill=fg)
        text(s, Inches(0.62), y + Inches(0.2), Inches(0.46), Inches(0.3), st["n"], size=13,
             color=RGBColor(0xFF, 0xFF, 0xFF), bold=True, font=MONO, align=PP_ALIGN.CENTER)
        text(s, Inches(1.24), y + Inches(0.2), Inches(6.9), Inches(0.4), st["text"], size=11.5,
             color=INK)
        y += Inches(0.76)
    by = Inches(2.0)
    for b in d.get("bullets", []):
        rect(s, Inches(8.62), by + Inches(0.08), Inches(0.06), Inches(0.16), fill=ACCENT)
        text(s, Inches(8.86), by, Inches(3.9), Inches(1.0), b, size=12, color=INK2, line_spacing=1.4)
        by += Inches(1.1)


def layout_proof(s, d):
    chrome(s, d["eyebrow"])
    text(s, Inches(0.62), Inches(1.24), Inches(11.9), Inches(0.55), d["headline"][0], size=32,
         color=INK, bold=True)
    mets = d["metrics"]
    gap = Inches(0.2)
    total = W - Inches(1.24)
    cw = int((total - gap * (len(mets) - 1)) / len(mets))
    y = Inches(2.0)
    for i, m in enumerate(mets):
        x = Inches(0.62) + i * (cw + gap)
        rect(s, x, y, cw, Inches(1.62), fill=ACCENT_WASH if i == 0 else PAPER,
             line=ACCENT if i == 0 else RULE2)
        text(s, x + Inches(0.2), y + Inches(0.18), cw - Inches(0.4), Inches(0.2),
             m["label"].upper(), size=8, color=MUTED, font=MONO)
        text(s, x + Inches(0.2), y + Inches(0.46), cw - Inches(0.4), Inches(0.6), m["value"],
             size=30, color=INK, bold=True)
        text(s, x + Inches(0.2), y + Inches(1.14), cw - Inches(0.4), Inches(0.4), m["note"],
             size=8.5, color=MUTED, line_spacing=1.3)
    by = Inches(3.95)
    for b in d.get("bullets", []):
        rect(s, Inches(0.62), by + Inches(0.08), Inches(0.06), Inches(0.16), fill=ACCENT)
        text(s, Inches(0.88), by, Inches(11.4), Inches(0.5), b, size=13, color=INK2,
             line_spacing=1.45)
        by += Inches(0.62)


def layout_close(s, d):
    rect(s, 0, 0, W, H, fill=NAVY_DEEP)
    chrome(s, None, dark=True)
    text(s, Inches(0.9), Inches(1.5), Inches(11.4), Inches(0.3), d["eyebrow"], size=10,
         color=RGBColor(0x6F, 0xA4, 0xF0), font=MONO, bold=True)
    y = Inches(1.95)
    for i, line in enumerate(d["headline"]):
        text(s, Inches(0.9), y, Inches(11.4), Inches(0.8), line, size=34,
             color=RGBColor(0xFF, 0xFF, 0xFF) if i == 0 else RGBColor(0x8F, 0xA2, 0xBA), bold=True,
             line_spacing=1.2)
        y += Inches(0.72)
    text(s, Inches(0.9), Inches(3.72), Inches(9.6), Inches(1.0), d["body"][0], size=15,
         color=RGBColor(0x9F, 0xB0, 0xCA), line_spacing=1.55)
    text(s, Inches(0.9), Inches(5.0), Inches(6.4), Inches(0.3), DECK["live"], size=15,
         color=RGBColor(0x6F, 0xA4, 0xF0), font=MONO)
    text(s, Inches(0.9), Inches(5.36), Inches(7.6), Inches(0.3), DECK["repo"], size=11,
         color=RGBColor(0x8F, 0xA2, 0xBA), font=MONO)
    rect(s, Inches(0.9), Inches(6.02), Inches(10.0), Emu(9525), fill=RGBColor(0x3C, 0x4A, 0x5D))
    text(s, Inches(0.9), Inches(6.18), Inches(10.6), Inches(0.6), d["attribution"], size=9.5,
         color=RGBColor(0x7D, 0x90, 0xAD), line_spacing=1.5)


LAYOUTS = {
    "title": layout_title,
    "statement": layout_statement,
    "flow": layout_flow,
    "shots": layout_shots,
    "diagram": layout_diagram,
    "scores": layout_scores,
    "ladder": layout_ladder,
    "proof": layout_proof,
    "close": layout_close,
}


def main():
    total = len(DECK["slides"])
    for i, d in enumerate(DECK["slides"], 1):
        s = slide()
        LAYOUTS[d["layout"]](s, d)
        if d["layout"] not in ("title", "close"):
            footer(s, i, total)
        notes(s, d.get("notes", ""))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(f"wrote {OUT}  ({total} slides)")


if __name__ == "__main__":
    main()
