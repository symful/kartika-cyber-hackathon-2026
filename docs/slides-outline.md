# Kerangka Slide RANTAI (12 slide)

Format: 16:9. Ekspor PDF dan PPTX. Setiap slide satu pesan.

1. **Judul**
   RANTAI — Incident Evidence & Coordination Platform.
   Kategori Penangkalan. Nama tim dan anggota. Satu kalimat: satu laporan, bukti terverifikasi,
   satu gambaran bersama.

2. **Masalah**
   Laporan insiden tersebar di banyak satuan. Setiap laporan berdiri sendiri. Bukti sulit
   dibuktikan utuh. Koordinasi berjalan lewat pesan dan spreadsheet.

3. **Celah yang belum dijawab**
   Bukan soal mendeteksi serangan baru, tetapi soal menghubungkan temuan yang sudah ada,
   menjaga bukti, dan mencatat keputusan.

4. **RANTAI dalam satu alur**
   Laporan masuk, bukti di-sidik-jari, indikator diekstrak, korelasi dihitung, kronologi disusun,
   respons dicatat, laporan diekspor.

5. **Tangkapan layar**
   Dua atau tiga gambar: detail insiden, kartu korelasi skor 100, graf kampanye.

6. **Arsitektur**
   React + Vite, Cloudflare Worker (Hono), D1, WebCrypto. Satu Worker, satu basis data, tanpa
   layanan eksternal, tanpa koneksi keluar.

7. **Mesin korelasi**
   Tabel bobot indikator. Rumus penalti spesifisitas. Ambang 70/45/25. Contoh nyata: hash 100,
   domain yang muncul di 4 insiden menjadi 0.

8. **Integritas bukti**
   H_i = SHA256(H_{i-1} || E_i). Checkpoint Ed25519. Merkle root manifest. Demo tamper
   terdeteksi di entri yang tepat. Sebutkan batasnya secara jujur.

9. **Privasi lintas satuan**
   Bukti mentah tetap di satuan. Hanya indikator yang disetujui dibagikan. Blinded matching dengan
   HMAC memungkinkan kecocokan tanpa membuka nilai.

10. **Skenario demo**
    Empat insiden, dua satuan, satu kampanye. Skor 100 / 58 / 28 / 0. Tekankan angka 0 sebagai
    bukti presisi.

11. **Kelayakan implementasi**
    Satu perintah deploy. Berjalan offline. Batas 900 KB per berkas pada demo D1; produksi
    memakai object storage. Peta jalan: persetujuan akses, parser EVTX/pcap, integrasi SIEM.

12. **Penutup**
    RANTAI mendukung tanggung jawab Kartika CSIRT, bukan menggantikannya. Ajakan: satu kampanye
    pelatihan bersama untuk menguji alur lintas satuan.

## Catatan desain

- Palet sama dengan aplikasi: latar gelap, aksen amber, teks terang.
- Maksimal 40 kata per slide.
- Setiap klaim teknis harus bisa ditunjukkan di prototipe.
- Cantumkan sumber CISA AA23-341A di slide 10 dan di halaman belakang.
- Jangan memakai lambang atau atribut TNI AD tanpa izin; gunakan kata "satuan" secara generik.
