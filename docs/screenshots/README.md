# Tangkapan Layar RANTAI

Sepuluh tangkapan layar prototipe, diambil dengan peramban headless pada viewport 1440 piksel.
Data pada layar adalah kampanye pelatihan sintetis SINYAL-01, dan seluruh nilai indikator bersifat
sintetis.

Tema yang tampil adalah sistem visual **Berkas Operasi**: kanvas putih, panel berbingkai tipis,
navigasi navy, dan aksen kobalt.

| Berkas | Peran | Isi |
|---|---|---|
| `01-login.png` | Publik | Halaman masuk, tombol akun demo, peringatan data sintetis |
| `02-dashboard.png` | Analis | Ringkasan operasi: metrik, donut severity, tren, matriks severity × status, band korelasi |
| `03-incident-list.png` | Analis | Daftar laporan dengan pencarian, filter severity, dan skor maksimum |
| `04-incident-detail.png` | Analis | Detail INC-2026-001: ringkasan, profil kampanye, metadata, komposisi indikator |
| `05-evidence-vault.png` | Analis | Tab bukti: dropzone, status verifikasi, hash, penanda duplikat |
| `06-evidence-passport.png` | Analis | Passport artefak: static analysis, aturan, chain of custody |
| `07-attack-and-assets.png` | Analis | Pemetaan ATT&CK dengan artefak pendukung dan aset terdampak |
| `08-access-approvals.png` | Koordinator | Permintaan akses lintas satuan, alasan, status, kedaluwarsa |
| `09-correlation-graph.png` | Analis | Graf korelasi: simpul insiden dan indikator bersama |
| `10-audit-integrity.png` | Koordinator | Status rantai, checkpoint Ed25519, uji manipulasi |

Thumbnail submission 1200×630 ada di `docs/thumbnail.png`; sumber HTML-nya `docs/thumbnail.html`.
