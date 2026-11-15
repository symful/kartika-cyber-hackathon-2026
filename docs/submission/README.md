# Submission — Kartika Cyber Hackathon 2026

Batas akhir: **15 November 2026, 23:59 WIB**. Semua yang ada di sini sudah siap tempel ke form.

## Isi form

| Kolom form | Nilai |
|---|---|
| **Link Karya / Project** | `https://rantai.careday17.workers.dev` |
| **Link Video Demo di YouTube** | _(unggah `video/out/rantai-demo.mp4` — 6:27, 1080p — lalu tempel URL-nya)_ |
| **Link Slide Penjelasan** | `https://artifacts.commandcode.ai/05jogva6nkovfhb2` |
| **Thumbnail Karya** | `docs/thumbnail.png` — 1200×630, 53 KB |
| **Screenshot Karya** (maks 5) | lihat tabel di bawah |

## Lima screenshot

| # | Berkas | Isi |
|---|---|---|
| 1 | `1-ringkasan-operasi.png` | Ringkasan operasi: metrik, donut severity, tren, matriks severity × status |
| 2 | `2-detail-insiden.png` | Detail INC-2026-001: profil kampanye, ATT&CK, komposisi indikator |
| 3 | `3-bukti-terverifikasi.png` | Tab bukti: unggah, status verifikasi, hash, penanda duplikat |
| 4 | `4-graf-korelasi.png` | Graf kampanye lintas satuan |
| 5 | `5-integritas-bukti.png` | Verifikasi rantai, checkpoint Ed25519, uji manipulasi |

## Akun demo untuk juri

| Username | Kata sandi | Peran |
|---|---|---|
| `alpha` | `kartika2026` | Analis, Satuan Alpha |
| `bravo` | `kartika2026` | Analis, Satuan Bravo |
| `koordinator` | `kartika2026` | Koordinator, Pusat Koordinasi |

Alur yang disarankan untuk juri (10 menit):
1. Masuk sebagai `alpha`, buka **INC-2026-001**, tab **Bukti** — lihat hash dan status verifikasi.
2. Masuk sebagai `bravo`, buka insiden yang sama — bukti mentah bertanda terbatas, indikator tetap terlihat.
3. Buka **Korelasi** — skor 100, 58, 28, dan 0 pada laporan yang tidak terkait.
4. Masuk sebagai `koordinator`, buka **Integritas** — jalankan verifikasi rantai, lalu uji manipulasi.

## Berkas yang disiapkan

```
docs/
  rantai-slides.pptx          13 slide, teks asli & bisa diedit, ada speaker notes
  rantai-slides.html          deck HTML mandiri untuk link publik
  thumbnail.png               1200x630, 53 KB
  submission/                 lima screenshot di atas
video/out/
  rantai-demo.mp4             video 1080p30 (setelah render selesai)
  rantai-demo.srt             subtitle Indonesia
```

## Catatan kejujuran untuk juri

- Seluruh data adalah data pelatihan sintetis; profil kampanye merujuk pada advisory publik CISA AA23-341A.
- Batas yang diketahui: hash berkas yang sama pada kampanye tak terkait masih terhubung (skor 100). Ini dilaporkan sebagai temuan, bukan disembunyikan.
- Batas penyimpanan demo: 900 KB per berkas pada D1; mode on-premise 50 MB.
- Rantai audit membuktikan konsistensi catatan, bukan keaslian berkas sebelum diunggah.
