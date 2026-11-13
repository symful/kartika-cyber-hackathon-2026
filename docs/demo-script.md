# Naskah Video Demo RANTAI (maksimum 10 menit)

Aturan lomba: video maksimal 10 menit, diunggah ke YouTube. Rekam layar dalam 1440×900 atau 1920×1080,
tanpa memperlihatkan data pribadi. Semua data di layar adalah data pelatihan.

Persiapan sebelum merekam:

1. `npm run build && npx wrangler dev --port 8787`
2. Buka tiga jendela peramban (alpha, bravo, koordinator) atau gunakan mode penyamaran.
3. Pastikan basis data baru (hapus `.wrangler/`) agar urutan demo bersih.
4. Siapkan satu berkas contoh untuk diunggah di menit ke-2.

---

## 0:00–1:00 Masalah

Narasi:

> Laporan insiden jarang datang lengkap dan jarang datang sendirian. Satu satuan melaporkan email
> phishing, satuan lain melaporkan koneksi keluar yang mencurigakan. Tanpa cara membandingkan bukti,
> dua laporan itu tetap dua berkas terpisah.

Tampilkan halaman login, lalu masuk sebagai `alpha`. Sorot kalimat di panel kiri: satu laporan,
bukti terverifikasi, satu gambaran bersama.

## 1:00–2:30 Kirim laporan dan unggah bukti

1. Buka **Insiden**, klik **Laporan baru**, isi formulir, simpan.
2. Masuk ke detail, tab **Bukti**, unggah `laporan_phishing.eml` dan lampiran.
3. Perlihatkan SHA-256 yang muncul, badge **cocok**, dan ringkasan hasil parsing indikator.

Narasi: setiap berkas dihitung sidik jarinya, diparse, dan indikatornya disimpan bersama asal baris.

## 2:30–4:30 Momen korelasi

1. Ganti akun ke `bravo`.
2. Buka laporan yang sama. Tunjukkan bukti mentah bertanda **terbatas**.
3. Buka **INC-2026-002** dan tunjukkan kartu korelasi skor **100**.
4. Buka daftar alasan: hash lampiran, domain, URL, jarak waktu 4,4 jam.
5. Sorot satu alasan yang bertanda *blinded*: satuan lain tetap tahu ada kecocokan tanpa melihat nilai.

Ini klimaks video. Jangan terburu-buru.

## 4:30–6:30 Kronologi

1. Tab **Kronologi** pada INC-2026-001.
2. Tunjukkan peristiwa dari email, log proxy, dan catatan analis bersatu dalam satu garis waktu.
3. Buka tab **Korelasi**, tunjukkan pasangan moderat 58 dan lemah 28, lalu pasangan DDoS yang
   tidak memiliki korelasi sama sekali.

Narasi: sistem memisahkan bukti kuat dari kebetulan. Laporan keempat sengaja tidak terhubung.

## 6:30–7:30 Respons

1. Tab **Respons**, tambahkan tugas, ubah status.
2. Kembali ke kartu korelasi, klik **Konfirmasi korelasi**.
3. Tunjukkan bahwa keputusan tercatat pada tab **Audit**.

## 7:30–8:30 Integritas

1. Masuk sebagai `koordinator`, buka **Integritas**.
2. Klik **Verifikasi rantai**: hijau, jumlah entri, kepala rantai.
3. Ubah entri nomor 9, verifikasi ulang: merah, kerusakan tepat di entri 9.
4. Pulihkan, verifikasi ulang: hijau.
5. Tunjukkan checkpoint Ed25519 dan kunci publik.

Narasi jujur: rantai membuktikan konsistensi catatan, bukan keaslian berkas sebelum diunggah.

## 8:30–9:30 Ekspor

1. Buka **Ekspor**, pilih insiden, klik **Buka & cetak PDF**.
2. Tunjukkan laporan berisi manifest, Merkle root, kronologi, alasan korelasi, dan status rantai.
3. Kembali, unduh bundel STIX 2.1.

## Segmen tambahan yang layak direkam

Sisipkan 20 detik di salah satu bagian tanpa mengubah struktur utama:

- **Evidence passport**: dari tab Bukti, klik Passport. Tunjukkan static analysis, aturan yang
  cocok, alasan verdict, dan chain of custody.
- **Approval dan TLP**: sebagai Bravo minta akses, sebagai koordinator setujui. Sebutkan bahwa
  TLP:RED tidak bisa dibuka lewat approval.
- **Lifecycle**: ubah satu indikator menjadi false positive dan tunjukkan skor korelasi turun,
  lalu pulih.
- **Playbook**: jalankan playbook phishing dan tunjukkan tujuh tugas muncul.

## 9:30–10:00 Penutup

Narasi:

> RANTAI tidak menggantikan Kartika CSIRT. Ia menambah kemampuan yang belum ada: menyatukan
> laporan lintas satuan, menjaga bukti tetap bisa dipercaya, dan membuat keputusan analis
> bisa dipertanggungjawabkan. Satu Worker, satu basis data, bisa berjalan tanpa internet.

Tampilkan graf korelasi sebagai frame terakhir.

---

## Catatan produksi

- Rekam dalam satu take per segmen, gabungkan tanpa transisi berlebihan.
- Perbesar tampilan peramban ke 110% agar teks terbaca di YouTube.
- Jangan menampilkan terminal dengan path pengguna.
- Tambahkan teks kecil permanen: "Data pelatihan sintetis".
