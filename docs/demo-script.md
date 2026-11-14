# Naskah Video Demo RANTAI (maksimum 10 menit)

Ketentuan lomba: durasi paling lama 10 menit, diunggah ke YouTube. Rekam layar pada 1440×900 atau
1920×1080 dan jangan menampilkan data pribadi. Seluruh isi layar adalah data pelatihan.

Persiapan sebelum merekam:

1. Jalankan `npm run build && npx wrangler dev --port 8787`.
2. Siapkan tiga jendela peramban — `alpha`, `bravo`, `koordinator` — atau gunakan mode penyamaran.
3. Mulai dari basis data bersih (hapus `.wrangler/`) agar urutan demo konsisten.
4. Sediakan satu berkas contoh untuk diunggah pada menit kedua.

---

## 0:00–1:00 Masalah

Narasi:

> Laporan insiden hampir tidak pernah datang lengkap, dan hampir tidak pernah datang sendiri. Satu
> satuan melaporkan email phishing; satuan lain melaporkan koneksi keluar yang mencurigakan. Tanpa
> cara membandingkan bukti, keduanya tetap dua berkas yang tidak pernah bertemu.

Tampilkan halaman masuk, lalu masuk sebagai `alpha`. Sorot empat poin di panel kiri: satu laporan,
bukti terverifikasi, satu gambaran bersama, dan rantai audit yang bisa diperiksa.

## 1:00–2:30 Kirim laporan dan unggah bukti

1. Buka **Insiden**, klik **Laporan baru**, lengkapi formulir, simpan.
2. Masuk ke detail, buka tab **Bukti**, unggah `laporan_phishing.eml` beserta lampirannya.
3. Tunjukkan SHA-256 yang muncul, badge **cocok**, dan ringkasan hasil parsing indikator.

Narasi: setiap berkas dihitung sidik jarinya, diparse, lalu indikatornya disimpan bersama baris asal.

## 2:30–4:30 Momen korelasi

1. Berpindah ke akun `bravo`.
2. Buka laporan yang sama dan tunjukkan bukti mentah yang bertanda **terbatas**.
3. Buka **INC-2026-002** dan sorot kartu korelasi berskor **100**.
4. Buka daftar alasan: hash lampiran, domain, URL, dan jarak waktu 4,4 jam.
5. Sorot satu alasan bertanda *blinded*: satuan lain tahu ada kecocokan tanpa pernah melihat nilainya.

Ini puncak video. Jangan terburu-buru.

## 4:30–6:30 Kronologi

1. Buka tab **Kronologi** pada INC-2026-001.
2. Tunjukkan peristiwa dari email, log proxy, dan catatan analis yang menyatu dalam satu garis waktu.
3. Buka tab **Korelasi**: pasangan sedang 58, lemah 28, lalu pasangan DDoS yang tidak terkait sama
   sekali.

Narasi: sistem memisahkan bukti kuat dari kebetulan. Laporan keempat sengaja tidak terhubung.

## 6:30–7:30 Respons

1. Buka tab **Respons**, tambahkan tugas, ubah statusnya.
2. Kembali ke kartu korelasi, klik **Konfirmasi korelasi**.
3. Tunjukkan bahwa keputusan tercatat pada tab **Audit**.

## 7:30–8:30 Integritas

1. Masuk sebagai `koordinator`, buka **Integritas**.
2. Klik **Verifikasi rantai**: hijau, jumlah entri, kepala rantai.
3. Ubah entri nomor 9 lalu verifikasi ulang: merah, kerusakan tepat di entri 9.
4. Pulihkan dan verifikasi ulang: hijau kembali.
5. Tunjukkan checkpoint Ed25519 dan kunci publiknya.

Narasi jujur: rantai membuktikan konsistensi catatan, bukan keaslian berkas sebelum diunggah.

## 8:30–9:30 Ekspor

1. Buka **Ekspor**, pilih insiden, klik **Buka & cetak PDF**.
2. Tunjukkan laporan yang memuat manifest, Merkle root, kronologi, alasan korelasi, dan status rantai.
3. Kembali, unduh bundel STIX 2.1.

## Segmen tambahan yang layak direkam

Sisipkan 20 detik pada salah satu bagian tanpa mengubah struktur utama:

- **Passport artefak**: dari tab Bukti, klik Passport. Tunjukkan static analysis, aturan yang cocok,
  alasan verdict, dan chain of custody.
- **Approval dan TLP**: sebagai Bravo minta akses, lalu sebagai koordinator setujui. Sebutkan bahwa
  TLP:RED tetap tidak bisa dibuka lewat approval.
- **Lifecycle**: ubah satu indikator menjadi false positive, tunjukkan skor korelasi turun, lalu
  pulihkan.
- **Playbook**: jalankan playbook phishing dan tunjukkan tujuh tugas yang muncul.

## 9:30–10:00 Penutup

Narasi:

> RANTAI tidak menggantikan Kartika CSIRT. Ia menambahkan kemampuan yang belum ada: menyatukan
> laporan lintas satuan, menjaga bukti tetap bisa dipercaya, dan membuat keputusan analis bisa
> dipertanggungjawabkan. Satu Worker, satu basis data, dan bisa berjalan tanpa internet.

Tampilkan graf korelasi sebagai frame terakhir.

---

## Catatan produksi

- Rekam satu take per segmen, gabungkan tanpa transisi berlebihan.
- Perbesar tampilan peramban ke 110% agar teks terbaca di YouTube.
- Jangan menampilkan terminal dengan path pengguna.
- Tambahkan teks kecil permanen: "Data pelatihan sintetis".
