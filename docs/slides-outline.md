# Kerangka Slide RANTAI (12 slide)

Format 16:9, diekspor ke PDF dan PPTX. Satu pesan per slide.

1. **Judul**
   RANTAI — Incident Evidence & Coordination Platform.
   Kategori Penangkalan. Nama tim dan anggotanya. Satu kalimat: satu laporan, bukti terverifikasi,
   satu gambaran bersama.

2. **Masalah**
   Laporan insiden tersebar di banyak satuan dan setiap laporan berdiri sendiri. Bukti sulit
   dibuktikan utuh, dan koordinasi berjalan lewat pesan serta spreadsheet.

3. **Celah yang belum dijawab**
   Persoalannya bukan mendeteksi serangan baru, melainkan menghubungkan temuan yang sudah ada,
   menjaga bukti, dan mencatat keputusan.

4. **RANTAI dalam satu alur**
   Laporan masuk → bukti diberi sidik jari → indikator diekstrak → korelasi dihitung → kronologi
   disusun → respons dicatat → laporan diekspor.

5. **Tangkapan layar**
   Pilih dua atau tiga gambar dari `docs/screenshots/`: detail insiden, kartu korelasi skor 100, dan
   graf kampanye.

6. **Arsitektur**
   Gunakan `docs/diagrams/architecture.svg`. React + Vite, Cloudflare Worker (Hono), D1, WebCrypto.
   Satu Worker, satu basis data, tanpa layanan eksternal, tanpa koneksi keluar.

7. **Mesin korelasi**
   Gunakan `docs/diagrams/indicator-weights.svg` dan `docs/diagrams/correlation-pipeline.svg`. Tabel
   bobot indikator, rumus penalti spesifisitas, ambang 70/45/25. Contoh nyata: hash 100, indikator
   umum dibatasi 2 poin per indikator dan 8 poin per pasangan.

8. **Integritas bukti**
   Gunakan `docs/diagrams/integrity-chain.svg`. `H_i = SHA256(H_{i-1} || E_i)`, checkpoint Ed25519,
   Merkle root manifest, dan demo manipulasi yang terdeteksi tepat di entri yang diubah. Sebutkan
   batasnya secara jujur.

9. **Privasi lintas satuan**
   Bukti mentah tetap di satuannya. Hanya indikator yang disetujui yang dibagikan. Blinded matching
   dengan HMAC memungkinkan kecocokan tanpa membuka nilai.

10. **Skenario demo**
    Gunakan `docs/diagrams/score-bands.svg`. Empat insiden, dua satuan, satu kampanye. Skor
    100 / 58 / 28 / 0. Tekankan angka 0 sebagai bukti presisi.

11. **Kelayakan implementasi**
    Satu perintah deploy dan bisa berjalan offline. Batas 900 KB per berkas pada demo D1; produksi
    memakai object storage. Peta jalan: persetujuan akses, parser EVTX/pcap, integrasi SIEM.

12. **Penutup**
    RANTAI mendukung tanggung jawab Kartika CSIRT, bukan menggantikannya. Ajakan: satu kampanye
    pelatihan bersama untuk menguji alur lintas satuan.

## Catatan desain

- Palet mengikuti aplikasi: kanvas putih, panel berbingkai tipis, navigasi navy, dan aksen kobalt
  (sistem visual "Berkas Operasi"). Severity memakai skala merah–oranye–kuning–biru.
- Tipografi Archivo untuk teks dan IBM Plex Mono untuk angka serta kode.
- Maksimal 40 kata per slide.
- Setiap klaim teknis harus bisa ditunjukkan pada prototipe.
- Cantumkan sumber CISA AA23-341A di slide 10 dan di halaman belakang.
- Jangan memakai lambang atau atribut TNI AD tanpa izin; gunakan kata "satuan" secara generik.
