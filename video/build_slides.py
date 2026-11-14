import json, os, subprocess, sys, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "video"
FRAMES = OUT / "frames"
AUDIO = OUT / "audio"
FRAMES.mkdir(parents=True, exist_ok=True)
AUDIO.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1080
PAPER = (255, 255, 255)
INK = (32, 42, 54)
INK2 = (53, 65, 82)
MUTED = (85, 100, 122)
NAVY = (44, 54, 68)
ACCENT = (24, 102, 219)
RULE = (225, 229, 234)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\calibrib.ttf",
]
REG_CANDIDATES = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
]
MONO_CANDIDATES = [
    r"C:\Windows\Fonts\consola.ttf",
    r"C:\Windows\Fonts\cour.ttf",
]


def pick(cands):
    for c in cands:
        if os.path.exists(c):
            return c
    raise SystemExit("no font found among: " + repr(cands))


BOLD = pick(FONT_CANDIDATES)
REG = pick(REG_CANDIDATES)
MONO = pick(MONO_CANDIDATES)


def f_bold(size):
    return ImageFont.truetype(BOLD, size)


def f_reg(size):
    return ImageFont.truetype(REG, size)


def f_mono(size):
    return ImageFont.truetype(MONO, size)


def draw_wrapped(draw, text, font, fill, x, y, width, line_gap=1.35):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    lh = int(font.size * line_gap)
    for i, ln in enumerate(lines):
        draw.text((x, y + i * lh), ln, font=font, fill=fill)
    return y + len(lines) * lh


def brand(draw, dark=False):
    bg = NAVY if dark else PAPER
    draw.rectangle([0, 0, W, H], fill=bg)
    draw.rectangle([0, 0, W, 92], fill=NAVY)
    # mark
    draw.rounded_rectangle([60, 24, 104, 68], radius=10, fill=ACCENT)
    draw.polygon([(82, 34), (96, 40), (96, 52), (82, 62), (68, 52), (68, 40)], outline=(255, 255, 255), width=3)
    draw.text((122, 26), "RANTAI", font=f_bold(30), fill=(255, 255, 255))
    draw.text((122, 60), "BERKAS BUKTI & KOORDINASI INSIDEN", font=f_mono(11), fill=(170, 182, 197))
    draw.text((W - 470, 36), "Kartika Cyber Hackathon 2026", font=f_reg(15), fill=(170, 182, 197))
    draw.text((W - 470, 58), "Kategori Penangkalan", font=f_reg(15), fill=(140, 152, 168))


def slide_title(title, subtitle, dark=False):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    brand(d, dark)
    y = 300
    draw_wrapped(d, title, f_bold(82), INK, 120, y, W - 300, 1.18)
    if subtitle:
        draw_wrapped(d, subtitle, f_reg(30), MUTED, 120, 620, W - 420, 1.5)
    d.rectangle([120, 880, 220, 886], fill=ACCENT)
    return img


def slide_screenshot(path, title, caption):
    shot = Image.open(path).convert("RGB")
    img = Image.new("RGB", (W, H), (247, 249, 252))
    d = ImageDraw.Draw(img)
    brand(d)
    d.text((120, 130), title, font=f_bold(40), fill=INK)
    # fit into content area
    top = 200
    max_w, max_h = W - 240, H - top - 190
    sw, sh = shot.size
    scale = min(max_w / sw, max_h / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    px, py = (W - nw) // 2, top
    d.rectangle([px - 3, py - 3, px + nw + 3, py + nh + 3], fill=(207, 214, 223))
    img.paste(shot.resize((nw, nh), Image.LANCZOS), (px, py))
    draw_wrapped(d, caption, f_reg(22), MUTED, 120, H - 138, W - 300, 1.5)
    d.text((W - 320, H - 76), "Data pelatihan sintetis", font=f_mono(15), fill=(99, 114, 134))
    return img


def slide_diagram(path, title, caption):
    art = Image.open(path).convert("RGB")
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    brand(d)
    d.text((120, 128), title, font=f_bold(38), fill=INK)
    top = 196
    max_w, max_h = W - 240, H - top - 170
    sw, sh = art.size
    scale = min(max_w / sw, max_h / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img.paste(art.resize((nw, nh), Image.LANCZOS), ((W - nw) // 2, top))
    draw_wrapped(d, caption, f_reg(22), MUTED, 120, H - 128, W - 300, 1.5)
    return img


def slide_bullets(title, bullets, kicker=None):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    brand(d)
    if kicker:
        d.text((120, 150), kicker.upper(), font=f_mono(16), fill=ACCENT)
    d.text((120, 196), title, font=f_bold(56), fill=INK)
    y = 340
    for b in bullets:
        d.ellipse([122, y + 12, 134, y + 24], fill=ACCENT)
        y = draw_wrapped(d, b, f_reg(31), INK2, 160, y, W - 360, 1.45) + 34
    return img


def slide_closing(title, lines):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    brand(d)
    y = draw_wrapped(d, title, f_bold(66), INK, 120, 280, W - 300, 1.2)
    y += 50
    for ln in lines:
        y = draw_wrapped(d, ln, f_reg(30), MUTED, 120, y, W - 360, 1.5) + 24
    d.text((120, H - 150), "rantai.careday17.workers.dev", font=f_mono(24), fill=ACCENT)
    d.text((120, H - 112), "github.com/symful/kartika-cyber-hackathon-2026", font=f_mono(24), fill=MUTED)
    return img


S = ROOT / "docs" / "screenshots"
D = ROOT / "video" / "diagram-png"

SCENES = [
    dict(
        img=slide_title(
            "Satu laporan.\nBukti yang terverifikasi.\nSatu gambaran bersama.",
            "RANTAI menyatukan laporan insiden lintas satuan tanpa memindahkan bukti mentah.",
        ),
        vo="Laporan insiden hampir tidak pernah datang lengkap, dan hampir tidak pernah datang sendiri. "
           "Satu satuan melaporkan email phishing. Satuan lain melaporkan koneksi keluar yang mencurigakan. "
           "Tanpa cara membandingkan bukti, keduanya tetap dua berkas yang tidak pernah bertemu. "
           "RANTAI menghubungkan keduanya, tanpa memindahkan bukti mentah antar satuan.",
    ),
    dict(
        img=slide_bullets(
            "Yang RANTAI jaga",
            [
                "Setiap berkas bukti diberi sidik jari SHA-256 dan manifest Merkle.",
                "Indikator disimpan bersama asal barisnya, bukan sebagai nilai lepas.",
                "Pencocokan lintas satuan memakai HMAC tanpa membuka nilai mentah.",
                "Setiap tindakan masuk rantai audit hash-linked dengan checkpoint Ed25519.",
                "Kebijakan TLP, cakupan berbagi, dan approval ditegakkan di server, bukan hanya UI.",
            ],
            kicker="Ringkasan",
        ),
        vo="Ada lima hal yang dijaga RANTAI. Setiap berkas bukti diberi sidik jari SHA-256 dan manifest Merkle. "
           "Indikator disimpan bersama asal barisnya. Pencocokan lintas satuan memakai HMAC, sehingga nilai mentah "
           "tidak pernah dikirim. Setiap tindakan tercatat pada rantai audit hash-linked dengan checkpoint Ed25519. "
           "Dan semua kebijakan akses ditegakkan di server, bukan hanya disembunyikan di antarmuka.",
    ),
    dict(
        img=slide_screenshot(S / "01-login.png", "Masuk ke ruang kerja",
                             "Tiga akun satuan: Alpha, Bravo, dan koordinator. Data pada layar adalah data pelatihan sintetis."),
        vo="Setiap satuan masuk dengan akunnya sendiri. Alpha, Bravo, dan koordinator. "
           "Sesi disimpan di basis data dengan masa berlaku delapan jam, dan setiap tindakan tercatat pada rantai audit.",
    ),
    dict(
        img=slide_screenshot(S / "02-dashboard.png", "Ringkasan operasi",
                             "Metrik utama, donut severity, tren laporan, matriks severity kali status, dan sebaran band korelasi."),
        vo="Halaman ringkasan memberi gambaran satu kampanye: jumlah insiden, indikator, temuan terbuka, dan prioritas. "
           "Severity dibagi per tingkat, tren laporan mengikuti waktu kejadian, dan matriks severity kali status "
           "memperlihatkan mana yang masih terbuka dan mana yang sudah ditangani.",
    ),
    dict(
        img=slide_screenshot(S / "04-incident-detail.png", "Detail insiden",
                             "Profil kampanye, pemetaan ATT&CK, metadata laporan, dan komposisi indikator menurut jenis."),
        vo="Setiap insiden punya satu berkas kasus. Di dalamnya ada profil kampanye beserta teknik ATT&CK yang dipetakan, "
           "metadata laporan, dan komposisi indikator. Semua angka diambil dari berkas yang benar-benar diunggah.",
    ),
    dict(
        img=slide_screenshot(S / "05-evidence-vault.png", "Bukti dan integritasnya",
                             "Unggah multi-berkas, status verifikasi, hash, dan penanda duplikat lintas kasus."),
        vo="Ini bagian inti. Setiap berkas yang diunggah dihitung hash-nya, diparse, lalu dianalisis tanpa dieksekusi. "
           "Magic bytes, entropi, aturan bergaya YARA, dan batas keamanan arsip berjalan di sini. "
           "Jika berkas yang sama muncul di kasus lain, sistem menandainya.",
    ),
    dict(
        img=slide_screenshot(S / "06-evidence-passport.png", "Passport artefak",
                             "Static analysis, aturan yang cocok, verdict, dan chain of custody per artefak."),
        vo="Passport artefak merangkum semuanya: hasil analisis statis, aturan yang cocok, alasan verdict, "
           "dan chain of custody. Setiap penanganan, transfer, dan penerimaan menambah satu mata rantai "
           "yang bisa diperiksa ulang.",
    ),
    dict(
        img=slide_diagram(D / "correlation-pipeline.png", "Mesin korelasi",
                          "Ingest, normalisasi, bobot spesifisitas, lalu band keputusan: kuat, sedang, lemah, atau dibuang."),
        vo="Korelasi bekerja deterministik. Berkas diparse, indikator diekstrak, lalu dinormalisasi terhadap defang, "
           "homoglyph Kiril, dan label IDN. Setiap indikator diberi bobot yang menurun jika muncul di banyak insiden. "
           "Hasilnya dipetakan ke band: kuat, sedang, lemah, atau dibuang di bawah dua puluh lima.",
    ),
    dict(
        img=slide_diagram(D / "score-bands.png", "Skor pada data demo",
                          "100 untuk pasangan dengan hash lampiran sama, 58 dan 28 untuk kecocokan yang lebih lemah, dan 0 untuk laporan yang tidak terkait."),
        vo="Pada data demo, laporan satu dan dua berskor seratus karena berbagi hash lampiran, domain, URL, "
           "dan berdekatan dalam waktu. Dua pasangan lain berskor lima puluh delapan dan dua puluh delapan. "
           "Laporan keempat sengaja tidak terhubung sama sekali. Angka nol itu sama pentingnya dengan angka seratus.",
    ),
    dict(
        img=slide_screenshot(S / "09-correlation-graph.png", "Graf kampanye",
                             "Simpul insiden dan indikator bersama. Laporan yang tidak terkait tetap terpisah."),
        vo="Graf memperlihatkan kampanye sebagai satu jaringan. Simpul insiden terhubung lewat indikator bersama, "
           "dan laporan yang tidak punya kaitan tetap berdiri sendiri. Korelasi adalah petunjuk penyelidikan, "
           "bukan bukti atribusi.",
    ),
    dict(
        img=slide_screenshot(S / "08-access-approvals.png", "Akses dan TLP",
                             "Permintaan lintas satuan, alasan, status, dan masa berlaku. TLP:RED tetap tidak bisa dibuka lewat approval."),
        vo="Bukti mentah lintas satuan memerlukan persetujuan koordinator dengan masa berlaku tiga hari. "
           "Tetapi approval tidak mengalahkan larangan. TLP merah dan artefak restricted tetap tertutup, "
           "dan laporan serta ekspor mengikuti aturan yang sama.",
    ),
    dict(
        img=slide_diagram(D / "integrity-chain.png", "Integritas bukti",
                          "Rantai audit hash-linked, checkpoint Ed25519, custody artefak, dan manifest Merkle."),
        vo="Rantai audit memakai pola yang sederhana: setiap entri adalah hash dari entri sebelumnya "
           "ditambah isi entri itu sendiri. Checkpoint Ed25519 menandatangani kepala rantai, sehingga penyuntingan ulang "
           "seluruh rantai tetap terdeteksi. Jujur soal batasnya: rantai membuktikan konsistensi catatan, "
           "bukan keaslian berkas sebelum diunggah.",
    ),
    dict(
        img=slide_screenshot(S / "10-audit-integrity.png", "Verifikasi dan uji manipulasi",
                             "Verifikasi rantai, checkpoint tersimpan, uji manipulasi satu entri, dan catatan audit terbaru."),
        vo="Di halaman integritas, koordinator bisa memverifikasi rantai, membuat checkpoint, dan menguji manipulasi. "
           "Ubah satu entri, dan verifikasi akan menunjuk tepat entri yang rusak. Pulihkan, dan rantai kembali hijau.",
    ),
    dict(
        img=slide_diagram(D / "architecture.png", "Arsitektur",
                          "Satu UI React, dua jalur deploy: Cloudflare Worker dengan D1, atau Node dengan SQLite untuk lingkungan offline."),
        vo="Semuanya berjalan pada satu Worker dan satu basis data. Tidak ada layanan eksternal dan tidak ada "
           "panggilan keluar saat runtime. Untuk lingkungan terisolasi, aplikasi yang sama bisa dijalankan di Node "
           "dengan SQLite lokal dan penyimpanan bukti di filesystem.",
    ),
    dict(
        img=slide_closing(
            "RANTAI mendukung Kartika CSIRT, bukan menggantikannya.",
            [
                "Menyatukan laporan lintas satuan, menjaga bukti tetap bisa dipercaya, dan membuat keputusan analis bisa dipertanggungjawabkan.",
                "Seluruh data pada demo adalah data pelatihan sintetis. Profil kampanye merujuk pada advisory publik CISA AA23-341A.",
            ],
        ),
        vo="RANTAI tidak menggantikan Kartika CSIRT. Ia menambahkan kemampuan yang belum ada: menyatukan laporan lintas satuan, "
           "menjaga bukti tetap bisa dipercaya, dan membuat keputusan analis bisa dipertanggungjawabkan. "
           "Terima kasih.",
    ),
]

VOICE = "id-ID-ArdiNeural"
RATE = "+8%"

print(f"rendering {len(SCENES)} scenes")
for i, sc in enumerate(SCENES, 1):
    png = FRAMES / f"scene-{i:02d}.png"
    sc["img"].save(png)
    mp3 = AUDIO / f"scene-{i:02d}.mp3"
    text_path = OUT / f"vo-{i:02d}.txt"
    text_path.write_text(sc["vo"], encoding="utf-8")
    subprocess.run(
        [sys.executable, "-m", "edge_tts", "--voice", VOICE, "--rate", RATE,
         "--file", str(text_path), "--write-media", str(mp3)],
        check=True,
    )
    print(f"  scene {i:02d} ok")

print("done")
