"""Render a YouTube thumbnail (1280x720) distinct from the 1200x630 submission one."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "video" / "out" / "rantai-thumbnail-youtube.png"

W, H = 1280, 720
NAVY = (34, 43, 54)
ACCENT = (79, 140, 255)
WHITE = (255, 255, 255)
DIM = (143, 162, 186)

BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
REG = r"C:\Windows\Fonts\segoeui.ttf"
MONO = r"C:\Windows\Fonts\consola.ttf"


def main():
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)

    # gradient wash
    for y in range(H):
        a = y / H
        d.line([(0, y), (W, y)], fill=(int(34 + 18 * a), int(43 + 22 * a), int(54 + 30 * a)))

    shot = Image.open(ROOT / "docs" / "screenshots" / "02-dashboard.png").convert("RGB")
    scale = 520 / shot.width
    shot = shot.resize((520, int(shot.height * scale)), Image.LANCZOS).crop((0, 0, 520, 340))
    img.paste(shot, (700, 250))
    d.rectangle([697, 247, 1223, 593], outline=(90, 105, 125), width=3)

    d.rectangle([60, 56, 108, 104], fill=ACCENT, width=0)
    d.text((72, 68), "R", font=ImageFont.truetype(BOLD, 30), fill=NAVY)

    d.text((124, 58), "RANTAI", font=ImageFont.truetype(BOLD, 34), fill=WHITE)
    d.text((124, 98), "INCIDENT EVIDENCE & COORDINATION", font=ImageFont.truetype(MONO, 12), fill=DIM)

    big = ImageFont.truetype(BOLD, 62)
    d.text((60, 210), "Satu laporan.", font=big, fill=WHITE)
    d.text((60, 282), "Bukti yang", font=big, fill=WHITE)
    d.text((60, 354), "terverifikasi.", font=big, fill=ACCENT)

    d.text((60, 470), "Korelasi insiden lintas satuan", font=ImageFont.truetype(REG, 24), fill=DIM)
    d.text((60, 504), "dengan bukti yang bisa diperiksa", font=ImageFont.truetype(REG, 24), fill=DIM)

    d.rectangle([60, 580, 168, 584], fill=ACCENT)
    d.text((60, 610), "Kartika Cyber Hackathon 2026", font=ImageFont.truetype(MONO, 15), fill=DIM)
    d.text((60, 638), "Kategori Penangkalan", font=ImageFont.truetype(MONO, 15), fill=DIM)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
