# Laporan Pengujian Frontend RANTAI

Tanggal: 14 November 2026  
Lingkungan: `npx wrangler dev --port 8787 --local`, Chrome for Testing 157, Firefox 152.0.4, Linux x64.

Pengujian dilakukan lewat browser pada aplikasi yang berjalan, bukan hanya membaca kode. Data demo
dikembalikan ke kondisi awal setelah pengujian selesai.

## Ringkasan

| Area | Hasil |
|---|---|
| Checklist pengujian frontend | 48 butir lulus |
| Bug atau celah yang ditemukan | 12 |
| Bug atau celah yang diperbaiki | 12 |
| Pelanggaran axe-core (WCAG 2 A/AA) setelah perbaikan | 0 |
| Error konsol pada halaman utama | 0 |
| Horizontal scroll tak disengaja | 0 pada 320, 768, 1024, 1440, dan 720 px (setara zoom 200%) |

## Perbaikan yang dibuat saat pengujian

1. **Filter severity tidak pernah cocok** — nilai opsi `critical/high/...` dibandingkan dengan
   `Critical/High/...` dari API. Filter kini membandingkan tanpa membedakan huruf besar-kecil.
2. **Hasil ingest hilang setelah unggah** — pemuatan ulang detail mengosongkan data dan melepas
   komponen, sehingga daftar hasil per berkas (termasuk alasan gagal) tidak pernah tampil. Muat
   ulang sekarang mempertahankan data lama sampai data baru tiba.
3. **Nama berkas hilang pada hasil ingest** — respons `ingestArtifact` tidak menyertakan
   `filename`, sehingga UI menampilkan "berkas". Field tersebut sekarang dikembalikan.
4. **Horizontal scroll pada Kronologi di 320 px** — hash SHA-256 panjang tidak terpotong. Aturan
   `overflow-wrap: anywhere` ditambahkan pada `.tl-title` dan `.tl-detail`.
5. **Kontras label navigasi** — `#8d9aac` di atas `#2c3644` hanya 4.27:1. Warna diubah menjadi
   `#96a4b6` (4.82:1).
6. **Kontras legenda donut untuk nilai nol** — opasitas 0.55 menghasilkan 2.34:1. Nilai nol kini
   memakai `var(--faint)` tanpa opasitas.
7. **Validasi server laporan insiden** — API menerima judul kosong dan `occurred_at` tidak valid.
   Server sekarang menolak dengan 400 untuk keduanya.
8. **Status akses berbahasa Inggris dan approval kedaluwarsa tampil "Approved"** — status kini
   memakai label Indonesia; approval yang melewati `expires_at` ditampilkan sebagai
   "Kedaluwarsa" dan berwarna merah.
9. **Status korelasi berbahasa Inggris** — "Confirmed"/"Dismissed" menjadi
   "Terkonfirmasi"/"Ditolak".
10. **Pesan batas unggah tidak konsisten** — server menulis "1 MB" untuk batas 900 KB. Pesan kini
    memakai satuan yang sesuai (900 KB atau 50 MB).
11. **URL tab pada insiden yang sama tidak berpindah tab** — perubahan hash ke tab lain pada
    insiden yang sedang dibuka tidak mengubah state. Efek pada `sub` ditambahkan.
12. **Toast toggle berbagi indikator terbalik** — handler membaca `e.target.checked` setelah
    `await`, saat React sudah mengembalikan nilai controlled input. Nilai sekarang disimpan
    sebelum permintaan dikirim.

## Hasil per checklist

### Autentikasi dan sesi

| Butir | Hasil | Catatan |
|---|---|---|
| Login benar dan salah | Lulus | Salah menampilkan `HTTP 401` dan pesan server |
| Rate limit 429 | Lulus | Percobaan ke-6 menampilkan `HTTP 429` dan petunjuk tunggu lima menit |
| Logout | Lulus | Sesi dihapus, kembali ke halaman masuk |
| Sesi kedaluwarsa | Lulus | `expires_at` lampau menghasilkan 401 dan halaman masuk |
| Permintaan tanpa CSRF | Lulus | `POST /api/logout` tanpa header ditolak 403, sesi tetap aktif |
| Tiga peran | Lulus | Alpha/Bravo melihat kontrol yang berbeda; koordinator mendapat aksi akses dan integritas |

### Insiden

| Butir | Hasil | Catatan |
|---|---|---|
| Judul kosong | Lulus | Validasi klien dan server (400) |
| Waktu tidak valid | Lulus | Validasi klien dan server (400); input datetime-local sendiri menolak teks bebas |
| Uraian panjang | Lulus | 3.300 karakter tersimpan utuh dan tetap utuh setelah refresh |
| Pencarian dan filter | Lulus | Pencarian teks, filter severity, dan keadaan kosong |
| URL langsung dan refresh | Lulus | Detail dan tab dapat dibuka lewat URL lalu di-refresh |
| Pindah tab lewat hash | Lulus setelah perbaikan | Insiden yang sama ikut berpindah tab |

### Bukti

| Butir | Hasil | Catatan |
|---|---|---|
| Unggah `.eml`, `.csv`, `.txt`, `.zip`, gambar, multi-berkas | Lulus | Enam berkas sekaligus; hash dan integritas "Cocok" muncul |
| Berkas melebihi batas | Lulus | Ditolak; alasan per berkas tampil setelah perbaikan hasil ingest |
| Berkas rusak | Lulus | ZIP rusak diterima dan ditandai `SUSPICIOUS` dengan penjelasan tipe/ekstensi dan entropi |
| Unggahan tanpa berkas | Lulus | Toast "Pilih berkas terlebih dahulu." |
| Duplikat lintas kasus | Lulus | `hash sama dengan INC-2026-001` tampil pada berkas duplikat |
| Passport | Lulus | Hash, ukuran, TLP, verdict, aturan YARA, penjelasan, custody, catatan, transfer, permintaan akses |
| Unduhan sebelum approval | Lulus | 403 `raw evidence is restricted for this unit`; tombol Unduh tidak tampil |
| Unduhan setelah approval | Lulus | 200 dan tautan Unduh muncul hanya untuk artefak yang disetujui |
| Penerimaan custody | Lulus | Bravo menerima transfer; event `received` masuk ke chain of custody |

### Indikator

| Butir | Hasil | Catatan |
|---|---|---|
| Filter jenis | Lulus | Hanya baris email yang tampil saat filter `email` dipilih |
| Pivot ke insiden lain | Lulus | Panel pivot menampilkan insiden lintas satuan dan menautkan ke detail |
| Lifecycle dan skor korelasi | Lulus | `false positive` menurunkan skor dan status dipulihkan mengembalikan skor |
| Toggle berbagi hanya unit pemilik | Lulus | Checkbox aktif untuk Alpha; nonaktif untuk Bravo |

### Korelasi dan kronologi

| Butir | Hasil | Catatan |
|---|---|---|
| Konfirmasi dan tolak | Lulus | Status tersimpan setelah reload dan tercatat di audit |
| Nilai blinded | Lulus | Nilai mentah satuan lain tampil sebagai `•••••• (blinded)` |
| Putar, jeda, kecepatan, tampilkan semua | Lulus | Kontrol berubah antara "Putar ulang", "Jeda", dan "Lanjutkan" |

### Konteks dan respons

| Butir | Hasil | Catatan |
|---|---|---|
| Pemetaan ATT&CK dengan dan tanpa artefak | Lulus | Kedua bentuk tersimpan dan tampil di tabel |
| Tautkan aset | Lulus | Aset bertambah dan muncul pada daftar aset terdampak |
| Jalankan playbook | Lulus | Tujuh langkah menjadi tugas |
| Ubah status tugas | Lulus | Status berubah dan tercatat |

### Akses dan integritas

| Butir | Hasil | Catatan |
|---|---|---|
| Ajukan, setujui, tolak, kedaluwarsa | Lulus | Semua status tampil; approval kedaluwarsa menolak unduhan (403) |
| Verifikasi rantai | Lulus | Rantai utuh dan checkpoint valid |
| Uji manipulasi dan pemulihan | Lulus | Entri #12 terdeteksi rusak, lalu pulih dan terverifikasi kembali |
| Rotasi kunci dengan dan tanpa konfirmasi | Lulus | Dismiss tidak mengubah fingerprint; accept menampilkan secret sekali dan fingerprint baru |
| Ekspor checkpoint hanya koordinator | Lulus | Tombol nonaktif untuk Alpha, aktif untuk koordinator; ekspor tidak memuat private key |

### Ekspor

| Butir | Hasil | Catatan |
|---|---|---|
| Laporan HTML dan PDF | Lulus | Halaman cetak terbuka dan tersimpan sebagai PDF |
| Markdown dan JSON | Lulus | Berkas terunduh; JSON valid dan memuat `merkle_root` |
| STIX 2.1 | Lulus | JSON valid berisi objek identity, indicator, report, dan korelasi RANTAI |
| Bundle ekspor dan impor di instance bersih | Lulus | Instance on-premise bersih membuat `IMP-2026-005`; bundle yang diubah ditolak dengan `bundle signature invalid` |

### Ketahanan dan aksesibilitas

| Butir | Hasil | Catatan |
|---|---|---|
| Jaringan putus | Lulus | Error state "Data gagal dimuat" dan tombol Coba lagi memulihkan |
| 401/403/404/429/500 | Lulus | Semua menampilkan `ErrorState` dengan status dan pesan asli server |
| Keyboard dan fokus | Lulus | Skip link, Tab, Enter, dan outline fokus terlihat |
| Label form | Lulus | Audit axe tidak menemukan input tanpa label |
| Kontras | Lulus setelah perbaikan | axe-core 4.12.1: 0 pelanggaran WCAG 2 A/AA pada semua halaman dan tab |
| 320, 768, 1024, 1440 px | Lulus | Tidak ada horizontal scroll yang tidak disengaja |
| Zoom 200% (viewport 720 px) | Lulus | Tidak ada horizontal scroll; navigasi berubah menjadi tombol menu |
| Chrome dan Firefox | Lulus | Chrome 157 seluruh matriks; Firefox 152 smoke test halaman utama dan lebar sempit |

## Catatan sisa

- Firefox diuji sebagai smoke test karena harness pengujian utama berbasis Chrome DevTools.
  Firefox memiliki lebar jendela minimum di WebDriver, sehingga 320 px tepat tidak dapat dipaksa;
  pengujian 320 px dilakukan di Chrome.
- Satu aturan axe berstatus *incomplete* pada halaman detail: kontras `<select>` tidak dapat
  dihitung otomatis karena latar belakang memakai gambar CSS. Pemeriksaan visual pada 200% tidak
  menemukan masalah.
- Perilaku yang memang dibatasi server tetap terlihat di UI: unduhan lintas satuan 403, artefak
  `restricted`, TLP:RED, dan tombol nonaktif untuk peran tanpa hak.
