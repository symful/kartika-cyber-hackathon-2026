# RANTAI

**Incident Evidence & Coordination Platform**
Kartika Cyber Hackathon 2026 · Kategori Penangkalan

RANTAI menyatukan laporan insiden yang tersebar dari beberapa satuan menjadi satu investigasi
yang bisa diverifikasi. Setiap berkas bukti diberi sidik jari SHA-256, setiap indikator disimpan
bersama asal-usulnya, dan setiap tindakan masuk ke rantai audit hash-linked.

> Data demo adalah data pelatihan sintetis. Profil kampanye dan pemetaan teknik merujuk pada
> advisory publik CISA AA23-341A (Star Blizzard). Bukan insiden TNI AD yang sebenarnya.

---

## 1. Menjalankan secara lokal

Prasyarat: Node.js 20+ dan npm.

```bash
npm install --include=dev
npm run build
npx wrangler dev --port 8787
```

Buka `http://127.0.0.1:8787`. Basis data D1 lokal dibuat otomatis di `.wrangler/` dan langsung
diisi data demo pada permintaan pertama.

Akun demo:

| Username | Kata sandi | Peran | Satuan |
|---|---|---|---|
| `alpha` | `kartika2026` | Analis | Satuan Alpha |
| `bravo` | `kartika2026` | Analis | Satuan Bravo |
| `koordinator` | `kartika2026` | Koordinator | Pusat Koordinasi |

Untuk mengulang demo dari awal, hentikan server lalu hapus folder `.wrangler/`.

> Catatan: jika `NODE_ENV=production` ada di environment, npm melewati devDependencies.
> Gunakan `npm install --include=dev` seperti di atas.

---

## 2. Alur demo

1. Masuk sebagai `alpha`, buka **INC-2026-001**, tab **Bukti**, unggah berkas.
   SHA-256 muncul dan diverifikasi ulang terhadap isi yang tersimpan.
2. Masuk sebagai `bravo`, buka insiden yang sama. Bukti mentah ditandai *terbatas*,
   tetapi indikator yang dibagikan tetap terlihat.
3. Laporan `INC-2026-002` dari Satuan Bravo memakai berkas yang sama. Korelasi langsung
   muncul dengan skor 100 dan daftar alasan yang menunjuk ke baris log asal.
4. Tab **Kronologi** menggabungkan peristiwa dari berkas dan laporan. Tombol **Putar ulang**
   memutar rekonstruksi kejadian langkah demi langkah.
5. Tab **Bukti**, klik **Passport** pada artefak: lihat chain of custody, hasil static analysis,
   dan status hash. Dari sini analis dapat mencatat penanganan atau melakukan transfer.
6. Masuk sebagai `bravo`, buka insiden yang sama, lalu minta akses pada artefak. Sebagai
   `koordinator`, setujui permintaan di tab **Akses**. Unduhan terbuka dan permintaan tercatat
   pada custody.
7. Tab **Indikator**: ubah lifecycle satu indikator menjadi `false positive`. Skor korelasi
   langsung turun (100 menjadi 56 pada demo), lalu pulih saat status dikembalikan.
8. Tab **Konteks**: pemetaan ATT&CK dengan artefak pendukung, serta aset terdampak.
9. Tab **Respons**: jalankan playbook phishing, tujuh langkah menjadi tugas dengan PIC.
10. Masuk sebagai `koordinator`, buka **Integritas**, jalankan **Verifikasi rantai**.
    Ubah satu entri, verifikasi ulang: rantai rusak tepat di nomor entri tersebut. Pulihkan.
11. **Ekspor**: laporan HTML siap cetak PDF, Markdown, JSON, STIX 2.1, dan bundle offline
    bertanda tangan Ed25519.

Skor yang diharapkan pada data demo:

| Pasangan | Skor | Band | Dasar |
|---|---|---|---|
| INC-2026-001 ↔ INC-2026-002 | 100 | strong | hash lampiran sama, domain, URL, kedekatan waktu |
| INC-2026-001 ↔ INC-2026-003 | 58 | moderate | alamat email pengirim, domain, waktu |
| INC-2026-002 ↔ INC-2026-003 | 28 | weak | domain saja |
| INC-2026-004 ↔ semua | 0 | none | tidak ada indikator bersama (bukti presisi) |

---

## 3. Arsitektur

```
Cloudflare mode
React 19 + Vite (dist/)  ──►  Cloudflare Worker (Hono)
                                      │
                                      ├── D1 (SQLite terkelola)
                                      │     incidents, artifacts (BLOB),
                                      │     indicators, correlations, events,
                                      │     tasks, audit, checkpoints, settings
                                      │
                                      └── WebCrypto
                                            SHA-256, HMAC-SHA256, PBKDF2, Ed25519

On-premise mode
React 19 + Vite (dist/)  ──►  Node + Hono  ──►  node:sqlite
                                      │
                                      └── filesystem evidence/
```

Satu Worker, satu basis data, tanpa layanan eksternal dan tanpa panggilan keluar saat runtime.
Ini disengaja agar prototipe bisa berjalan di lingkungan satuan yang terisolasi.

Penyimpanan bukti memakai antarmuka `EvidenceStorage` (`put/get/delete`) dengan dua provider:
D1 BLOB untuk mode Cloudflare, dan filesystem lokal untuk mode on-premise. Batas unggah
menyesuaikan provider: 900 KB pada D1, 50 MB pada filesystem.

| Lapisan | Berkas |
|---|---|
| API | `worker/api.ts`, `worker/index.ts` |
| Skema & akses data | `worker/schema.ts`, `worker/db.ts`, `worker/queries.ts`, `worker/extras.ts` |
| Ingest & parsing | `worker/ingest.ts`, `worker/parse.ts`, `worker/ioc.ts`, `worker/static.ts` |
| Korelasi | `worker/correlate.ts` |
| Integritas & audit | `worker/audit.ts`, `worker/integrity.ts`, `worker/custody.ts` |
| Penyimpanan bukti | `worker/storage.ts` (antarmuka, provider D1) |
| Data demo | `worker/seed.ts`, `config/seed.json` |
| On-premise | `server/onprem.ts` (server Node, shim D1, provider filesystem) |
| UI | `src/` |

Tema antarmuka: Carbon Blue (grafit netral, aksen kobalt), seluruhnya token CSS.

### Model keamanan

- Setiap endpoint mutasi memeriksa unit insiden, bukan hanya UI. Bravo tidak bisa mengubah status, mengunggah bukti, mencatat custody, atau mengubah lifecycle milik Alpha lewat API langsung.
- Sesi disimpan di D1 dengan masa berlaku 8 jam. Logout menghapus sesi aktif; `POST /api/logout-all` mencabut seluruh sesi pengguna.
- Cookie sesi memakai `HttpOnly`, `SameSite=Lax`, dan `Secure` saat berjalan di HTTPS.
- Mutasi memakai CSRF double-submit: cookie `rantai_csrf` harus sama dengan header `X-CSRF-Token`.
- Login dibatasi 5 percobaan per pengguna dan 20 per alamat IP dalam 5 menit.
- `TLP:RED` menolak akses lintas satuan bahkan untuk metadata. Artefak dan laporan juga memeriksa kepemilikan dan approval sebelum mengembalikan isi.
- Limiter bersifat per-isolat. Untuk produksi, pindahkan ke Durable Object atau KV agar konsisten lintas replika.

### Model kepercayaan bukti

- Kunci tanda tangan Ed25519 dibaca dari secret `RANTAI_SIGNING_KEY` bila tersedia, sehingga tidak berada di basis data insiden. Fallback ke D1 hanya untuk demo lokal dan ditandai di riwayat kunci.
- Bila `RANTAI_ENV=production` dan secret tidak ada, operasi tanda tangan ditolak. Checkpoint tidak dibuat dengan kunci yang tersimpan di basis data.
- Rotasi memerlukan body `{"confirm":"ROTATE"}`, dibatasi tiga kali per jam, mengembalikan secret sekali dengan `Cache-Control: no-store`, dan tidak mencatat private key ke audit.
- Riwayat kunci disimpan di `signing_keys`; rotasi tersedia lewat `POST /api/checkpoints/rotate`.
- `GET /api/checkpoints/export` mengeluarkan checkpoint, kunci publik, dan status rantai. Ekspor ini harus disalin berkala ke penyimpanan terpisah, karena checkpoint di basis data yang sama tidak melindungi dari penghapusan basis data.
- Verifikasi membandingkan kepala audit dengan checkpoint terakhir, sehingga penghapusan atau pemotongan entri terdeteksi, bukan hanya perubahan isi.
- Transfer custody mencatat pengirim dan penerima; penerima menjalankan `POST /api/artifacts/:id/accept` untuk menandatangani penerimaan.
- Rantai hash tetap bukan penyimpanan immutable. Ia membuktikan konsistensi, bukan keaslian berkas sebelum diunggah.

### Presedensi kebijakan akses

Satu fungsi `canDownload` dipakai oleh unduhan, passport, laporan, dan ekspor. Urutan evaluasinya:

1. Unit pemilik atau koordinator: boleh, tanpa mengurangi kewajiban audit.
2. `share_scope=restricted`: selalu ditolak lintas satuan, meskipun TLP lebih terbuka dan meskipun ada approval.
3. TLP: `RED` dan `AMBER+STRICT` selalu ditolak lintas satuan, approval tidak mengalahkan larangan.
4. TLP `AMBER`: perlu approval aktif dan belum kedaluwarsa.
5. TLP `GREEN` dan `CLEAR`: boleh lintas satuan, tetapi tetap tunduk pada langkah 2.

Laporan dan ekspor memakai aturan yang sama: artefak restricted tidak ikut, indikator yang tidak dibagikan tidak ikut, dan insiden `RED` menolak ekspor lintas satuan.

### Batas penyimpanan pada demo

Berkas bukti disimpan sebagai BLOB di D1 agar tetap gratis dan tanpa R2. D1 membatasi satu baris
sekitar 1 MB, sehingga unggahan dibatasi 900 KB. Untuk produksi, ganti BLOB dengan object storage
(R2/S3) dan simpan hanya hash serta pointer di basis data.

---

## 4. Mesin korelasi

Ekstraksi indikator dari `.eml`, `.csv`, `.log`, `.txt`, `.zip`, dan nama berkas. Normalisasi
menangani defang (`hxxp`, `[.]`, `[at]`), homoglyph Kiril, label IDN, dan TLD yang tidak masuk akal
agar kolom seperti `staf.keuangan` tidak dianggap domain.

Bobot dasar per jenis indikator:

| Jenis | Bobot |
|---|---|
| SHA-256 berkas | 100 |
| Alamat email | 45 |
| Domain | 40 |
| Alamat IP | 35 |
| URL | 30 |
| MD5 | 25 |
| Domain lookalike/typosquat | 20 |
| Nama berkas | 15 |

Penyesuaian:

```
weight = base / (1 + 0.5 * (df - 1))        df = jumlah insiden berbeda yang memuat indikator
```

Untuk indikator generik (domain, IP, URL, email, nama berkas, lookalike), `df` adalah jumlah
insiden berbeda yang memuat nilai tersebut. Bobotnya:

```
w            = base / (1 + 0.5 * (df - 1))
w_common     = min(w, 2)                       jika df >= 4
total_spesifik = jumlah bobot indikator dengan df < 4
total_umum     = min(jumlah w_common, 8)
total          = total_spesifik + total_umum
total          = min(total, 24)                jika total_spesifik == 0
total          = min(total + bonus_waktu, 100)
```

Indikator umum tetap dihitung, tetapi kontribusinya dibatasi 2 poin per indikator dan 8 poin
per pasangan. Pasangan yang hanya berbagi infrastruktur umum ditahan di 24 poin, di bawah ambang
lemah 25, sehingga tidak pernah dilaporkan sebagai temuan. Bonus waktu 8 poin bila selisih
≤ 72 jam atau 4 poin bila ≤ 7 hari, dan hanya berlaku jika ada indikator spesifik. Pencocokan
buta memakai pengali 0.8.

Band: **≥ 70 strong**, **45–69 moderate**, **25–44 weak**, di bawah 25 tidak tersimpan.

Indikator dengan lifecycle `false_positive`, `benign`, atau `expired` dikeluarkan dari
perhitungan. Perubahan status memicu hitung ulang dan pemangkasan korelasi yang turun
di bawah ambang.

Ambang, bonus waktu, penalti, dan batas infrastruktur umum dibaca dari `config/correlation.json`.
Skor adalah ukuran kekuatan bukti pada skala 0 sampai 100, bukan probabilitas statistik.

Dua koreksi penting pada perhitungan:

- Satu entitas dihitung sekali. URL dan domain dengan host yang sama tidak lagi dijumlahkan
  sebagai dua indikator terpisah.
- Infrastruktur yang muncul di banyak insiden tidak lagi diberi bobot nol. Bobotnya turun
  secara kontinu, lalu kontribusinya dibatasi. Tanpa indikator spesifik lain, totalnya juga
  dibatasi di bawah ambang lemah. Ini menghindari dua kesalahan sekaligus: mengabaikan
  infrastruktur kampanye luas, dan membiarkan domain umum menghasilkan temuan palsu.

Output selalu berupa daftar alasan yang bisa dibaca manusia plus rujukan berkas asal. Korelasi
adalah petunjuk penyelidikan, bukan bukti atribusi.

### Pencocokan buta (blinded matching)

Untuk pasangan lintas satuan, indikator yang tidak dibagikan tetap bisa dicocokkan melalui
HMAC-SHA256 dengan kunci rahasia, bukan salt publik:

```
blind = "v<version>:<hex>"  dari  HMAC-SHA256(secret, "v<version>:" + kind + ":" + norm)
```

Nilai mentah tidak pernah dikirim ke satuan lain. Kunci aktif dibaca dari secret
`RANTAI_BLIND_KEY`. Di production, `RANTAI_ENV=production` tanpa kunci tersebut menolak
pencocokan buta.

Rotasi kunci tersedia lewat `POST /api/blind/rotate` dengan konfirmasi eksplisit. Rotasi
menaikkan versi, menghitung ulang seluruh hash, dan menyimpan hash generasi sebelumnya di
`blind_hash_prev`. Pencocokan memeriksa hash aktif dan hash sebelumnya, sehingga perbandingan
lintas satuan dari generasi lama tidak langsung putus. Satuan lain harus menerima `salt_once`
melalui saluran aman dan merotasi dengan nilai yang sama agar generasi baru dapat dicocokkan.
`blind_hash_prev` hanya menyimpan satu generasi.

Batas yang harus dipahami: pencocokan buta mengungkap kesamaan antara dua indikator tersembunyi.
Ia tidak melindungi dari tebakan kamus bila nilai indikator mudah ditebak dan penyerang memiliki
kunci. Kunci harus diperlakukan sebagai rahasia organisasi, bukan sebagai salt yang boleh
dipublikasikan.

---

## 5. Integritas bukti

Rantai audit:

```
H_i = SHA256(H_{i-1} || canonical_json(E_i))
```

`canonical_json` adalah JSON dengan kunci terurut, tanpa spasi, dan tanpa angka desimal.
Entri pertama memakai 64 digit nol sebagai `H_0`.

Endpoint `GET /api/audit/verify` menghitung ulang seluruh rantai dan melaporkan nomor entri
pertama yang rusak. Checkpoint Ed25519 menandatangani `rantai-checkpoint:v1:<seq>:<hash>`,
sehingga perubahan yang disertai penulisan ulang seluruh rantai tetap terdeteksi.

Manifest laporan menyertakan SHA-256 tiap berkas dan Merkle root, sehingga keaslian bisa
diverifikasi di luar sistem. Rantai tidak membuktikan keaslian berkas sebelum diunggah;
itu tugas prosedur penerimaan bukti dan manifest yang diekspor.

### Chain of custody

Selain rantai audit sistem, setiap artefak punya rantai custody sendiri:

```
H_i = SHA256(H_{i-1} || canonical_json(event_i))
```

Event mencakup `collected`, `hashed`, `flagged`, `transfer`, `received`, `verified`,
`access_granted`, `access_denied`, dan `note`. Rantai ini diurutkan per `rowid` sehingga
urutan peristiwa tidak bergantung pada presisi timestamp. Passport artefak menampilkan
chain tersebut, status hash, hasil static analysis, dan permintaan akses terkait.

### Static file analysis

Setiap unggahan dianalisis tanpa dieksekusi. Lapisan yang berjalan:

- Tipe sebenarnya dari magic bytes, mismatch ekstensi, dan metadata PE (machine, jumlah seksi,
  timestamp kompilasi).
- Entropi Shannon dengan penjelasan kontekstual: entropi tinggi wajar pada PDF atau arsip,
  tetapi mencurigakan pada dokumen teks.
- Aturan bergaya YARA dalam subset deterministik: teks, teks wide UTF-16, hex, dan regex dengan
  kondisi `any` atau `all`. Aturan disimpan di `config/yara.json` dan dijalankan pada isi berkas
  serta entri arsip.
- Batas keamanan arsip: maksimum 200 entri, 10 MB per entri, 50 MB total, dan deteksi rasio
  dekompresi ekstrem. Isi yang melewati batas tidak diekstrak.
- Deteksi arsip rusak, makro OOXML, entri executable di dalam dokumen, dan URL tersemat.
- Verdict `clean`, `low-risk`, `suspicious`, atau `malicious` beserta daftar alasan yang bisa
  dibaca analis.

Tidak ada sandbox dinamis dan tidak ada impor aturan YARA eksternal. Eksekusi berkas sengaja
tidak dilakukan.

### Approval dan TLP

Berkas mentah lintas satuan memerlukan persetujuan koordinator dengan masa berlaku tiga hari.
Permintaan menyimpan pemohon, satuan, cakupan (`metadata`, `indicators`, `raw`), alasan, dan
keputusan. Setiap keputusan masuk ke rantai audit dan custody.

Label TLP mengikuti definisi FIRST TLP 2.0: `RED` hanya untuk penerima langsung, `AMBER`
berbagi berdasarkan need-to-know di organisasi penerima, `AMBER+STRICT` hanya di organisasi
penerima, `GREEN` untuk komunitas terkait, `CLEAR` boleh publik. Implementasi RANTAI
menerjemahkannya menjadi: `RED` dan `AMBER+STRICT` tidak dapat dibuka lintas satuan meski ada
approval; `AMBER` memerlukan approval; `GREEN` dan `CLEAR` mengizinkan unduhan lintas satuan.

Itu kebijakan TLP. Aturan unit internal tetap terpisah: `share_scope` pada artefak
(`full`, `indicators`, `restricted`) dan kepemilikan insiden tetap menentukan siapa yang boleh
menulis, bukan label TLP.

---

## 6. API

| Metode | Path | Keterangan |
|---|---|---|
| POST | `/api/login` | Sesi cookie HttpOnly |
| GET | `/api/dashboard` | Ringkasan operasi |
| GET/POST | `/api/incidents` | Daftar dan buat laporan |
| GET | `/api/incidents/:id` | Detail, bukti, indikator, kronologi, korelasi, audit |
| PATCH | `/api/incidents/:id/status` | Ubah status |
| POST | `/api/incidents/:id/artifacts` | Unggah bukti multipart |
| GET | `/api/artifacts/:id/download` | Unduh bukti (dibatasi izin) |
| POST | `/api/artifacts/:id/share` | Ubah cakupan berbagi |
| POST | `/api/indicators/:id/share` | Bagikan/sembunyikan indikator |
| GET | `/api/correlations` | Semua temuan |
| POST | `/api/correlations/:id/decide` | Konfirmasi/tolak |
| GET | `/api/graph` | Graf kampanye |
| GET | `/api/timeline` | Kronologi gabungan |
| GET | `/api/audit` `/api/audit/verify` | Catatan dan verifikasi rantai |
| POST | `/api/checkpoints` | Buat checkpoint Ed25519 |
| GET | `/api/pubkey` | Kunci publik perangkat |
| GET | `/api/report/:id?format=html\|md\|json` | Laporan forensik |
| GET | `/api/export/stix` | Bundel STIX 2.1 |
| POST | `/api/export/bundle` `/api/import/bundle` | Pertukaran offline bertanda tangan |
| GET | `/api/artifacts/:id/passport` | Passport, custody, analysis, akses |
| POST | `/api/artifacts/:id/custody` | Catat penanganan atau transfer |
| POST/GET | `/api/access-requests` | Ajukan dan lihat permintaan akses |
| POST | `/api/access-requests/:id/decide` | Setujui atau tolak (koordinator) |
| PATCH | `/api/indicators/:id/lifecycle` | Status dan confidence indikator |
| GET/POST | `/api/assets` | Registry aset |
| POST | `/api/incidents/:id/assets` | Tautkan aset ke insiden |
| GET | `/api/playbooks` | Template playbook |
| POST | `/api/incidents/:id/playbook` | Instansiasi playbook menjadi tugas |
| POST | `/api/incidents/:id/techniques` | Pemetaan ATT&CK dengan bukti |
| PATCH | `/api/incidents/:id/tlp` | Ubah label TLP (koordinator) |
| POST | `/api/artifacts/:id/accept` | Penerimaan custody oleh satuan tujuan |
| GET | `/api/checkpoints/export` | Ekspor checkpoint dan riwayat kunci |
| POST | `/api/checkpoints/rotate` | Rotasi kunci Ed25519 |
| POST | `/api/logout-all` | Cabut semua sesi pengguna |
| POST | `/api/blind/rotate` | Rotasi kunci blinded matching |
| POST | `/api/dev/benchmark` | Benchmark korelasi, hanya localhost |

---

## 7. Deploy ke Cloudflare (gratis)

```bash
npx wrangler login
npx wrangler d1 create rantai
```

Salin `database_id` hasil perintah di atas ke `wrangler.jsonc`, lalu:

```bash
npm run build
npx wrangler deploy
```

Secret yang disarankan untuk production:

```bash
npx wrangler secret put RANTAI_SIGNING_KEY   # PKCS8 base64 dari /api/checkpoints/rotate
npx wrangler secret put RANTAI_BLIND_KEY     # kunci HMAC bersama antar satuan
npx wrangler secret put RANTAI_ENV           # isi dengan "production"
```

Skema dibuat otomatis pada permintaan pertama, dan data demo di-seed bila tabel `users` kosong.
Hapus seed otomatis sebelum dipakai sungguhan dengan mengosongkan fungsi `seed()` di
`worker/seed.ts`.

---

## 7B. Mode on-premise / offline

```bash
npm run onprem
# atau
PORT=8080 DATA_DIR=./data npx tsx server/onprem.ts
```

Mode ini menjalankan aplikasi yang sama tanpa Cloudflare:

- HTTP server Node melalui `@hono/node-server`.
- SQLite lokal melalui `node:sqlite`, dengan shim yang memenuhi antarmuka D1.
- Bukti disimpan di filesystem, bukan BLOB basis data.
- Frontend statis dilayani dari `dist/`.

Struktur data:

```
data/
  rantai.db
  evidence/<artifactId>
```

Variabel yang dikenali: `PORT`, `DATA_DIR`, `RANTAI_ENV`, `RANTAI_SIGNING_KEY`,
`RANTAI_BLIND_KEY`, `RANTAI_SALT`.

Perbedaan perilaku yang disengaja: batas unggah 50 MB dan tidak ada batas baris D1. Analisis
statis, rantai audit, custody, korelasi, dan approval tetap sama. Mode ini belum mengemas
service manager, backup otomatis, atau TLS. Untuk produksi, jalankan di belakang reverse proxy
internal dan salin `data/` secara berkala.

Catatan keamanan: `DATA_DIR` berisi basis data dan bukti mentah. Batasi izin filesystem dan
jangan menaruhnya di direktori yang dibagikan.

Catatan keamanan: `/api/dev/login` hanya menerima hostname localhost, sehingga otomatis ditolak
pada domain `workers.dev`. Jangan menambahkan pengecualian untuk host lain.

---

## 8. Keterbatasan yang diakui

- Korelasi memakai aturan deterministik, bukan model probabilistik. Skor 0 sampai 100 adalah
  kekuatan bukti, bukan probabilitas.
- Parser menangani format teks umum, bukan PST, EVTX, atau pcap.
- BLOB di D1 membatasi ukuran berkas pada demo.
- Approval akses sudah ada, tetapi belum ada notifikasi atau eskalasi otomatis.
- Static analysis bersifat indikatif. Aturan YARA eksternal belum dapat diimpor, dan tidak ada
  sandbox dinamis.
- Rate limiter berjalan per-isolat, belum terdistribusi.
- Belum ada STIX import, post-incident metrics, atau hypothesis board.
- Indikator demo sintetis. Kemiripan dengan domain nyata tidak disengaja.

---

## 9. Verifikasi

```bash
npx wrangler dev --port 8787
powershell -File scripts/verify.ps1
```

Skrip menguji isolasi unit, IDOR artefak, approval dan kedaluwarsanya, TLP:RED pada detail dan
ekspor laporan, redaksi laporan, CSRF, pencabutan sesi, rate limit login, rotasi kunci, tanda
tangan checkpoint yang rusak, artefak yang diubah, ZIP bomb, korelasi terkait dan tidak terkait,
custody, serta ekspor checkpoint. Hasil terakhir: 24 lulus, 0 gagal.

### Benchmark korelasi

```bash
powershell -File scripts/benchmark.ps1
```

Endpoint dev lokal membuat 400 insiden sintetis, menjalankan engine, lalu menghapus seluruh
baris benchmark. Komposisinya: 60 klaster berisi 6 insiden yang berbagi domain, hash berkas,
dan URL; 40 insiden noise tanpa hubungan; satu domain CDN yang muncul di 400 insiden; dan
satu domain hosting yang dipakai dua klaster berbeda sehingga 12 insiden yang tidak terkait
berbagi domain. Setiap insiden juga memuat dua URL dengan host sama untuk menguji deduplikasi.

Evaluasi memakai semua 900 pasangan benar di dalam klaster, ditambah 600 sampel negatif
bertingkat: 200 pasangan lintas klaster yang berbagi domain hosting, 200 pasangan yang hanya
berbagi CDN, dan 200 pasangan acak.

Hasil pada mesin lokal:

| Metrik | Nilai |
|---|---|
| Insiden | 400 |
| Pasangan benar | 900 |
| Sampel negatif | 600 |
| Precision | 1.000 |
| Recall | 1.000 |
| False positive rate | 0.000 |
| Cross-link domain hosting | 0 |
| Cross-link CDN | 0 |
| Waktu hitung | 15,5 detik |

Benchmark ini deterministik dan memakai sampling untuk negatif, jadi FPR adalah estimasi pada
sampel, bukan sensus seluruh 79.800 pasangan. Untuk memperbesar corpus, ubah `clusters`,
`perCluster`, dan `noise` di `worker/benchmark.ts`.

### Held-out dan adversarial

Endpoint yang sama juga menjalankan dataset held-out dengan seed berbeda, 200 insiden
(30 klaster × 6 anggota, 20 noise), 450 pasangan benar, dan 300 sampel negatif. Hasilnya
precision 1.000, recall 1.000, FPR 0.000.

Empat skenario adversarial dijalankan terpisah:

| Skenario | Ekspektasi | Hasil | Skor |
|---|---|---|---|
| Partial overlap, hanya domain dan email | link | link | 64.7 |
| Homoglyph Latin vs Kiril | no link | no link | 0 |
| Clock skew 10 hari dengan hash sama | link | link | 100 |
| Hash sama pada kampanye tak terkait | no link | **link** | 100 |

Baris terakhir adalah keterbatasan yang diketahui, bukan kelulusan. Hash berkas yang sama bisa
berarti keluarga malware yang sama tanpa aktor yang sama. Engine saat ini tetap memberi skor 100.
Ini sengaja dilaporkan sebagai temuan, bukan disembunyikan.

---

## 10. Berkas submission

- `docs/screenshots/` — sepuluh tangkapan layar: login, dashboard, daftar insiden, detail,
  evidence vault, evidence passport, ATT&CK dan aset, approval akses, graf korelasi, dan
  integritas. Pilih lima terbaik untuk submission.
- `docs/thumbnail.html` dan `docs/thumbnail.png` — thumbnail 1200×630.
- `docs/demo-script.md` — naskah video 10 menit.
- `docs/slides-outline.md` — kerangka 12 slide.

---

## 11. TODO Tim

Tiga pekerjaan berikut diserahkan ke anggota tim. Tidak ada perubahan API yang diperlukan
untuk semuanya.

### 11.1 Redesign frontend (prioritas 1)

Batasan yang tidak boleh dilanggar:

- Jangan mengubah kontrak API. Semua endpoint di bagian 6 tetap sama.
- Jangan menyembunyikan pembatasan yang ditegakkan server. UI boleh menyederhanakan, tetapi
  larangan 403, redaksi TLP, dan artefak restricted harus tetap terlihat sebagai restricted.
- Pertahankan CSRF. Semua mutasi harus lewat `src/api.ts` agar header `X-CSRF-Token` terkirim.
- Jangan menaruh secret, token, atau kunci di bundle frontend.
- Untuk lingkungan air-gap, ganti Google Fonts dengan font yang di-host sendiri atau system font.
- Uji pada 320, 768, 1024, dan 1440 piksel, plus zoom 200 persen.

Daftar layar dan fungsinya:

| Layar | Fungsi yang harus tetap ada |
|---|---|
| Login | Autentikasi, tombol akun demo, pesan error, status loading, peringatan data sintetis |
| Dashboard | Empat metrik utama, distribusi severity, status penanganan, laporan terbaru, temuan teratas, status rantai |
| Daftar insiden | Pencarian teks, filter severity, tombol laporan baru, tabel dengan skor maksimum, navigasi ke detail |
| Modal laporan baru | Validasi judul, kategori, severity, satuan, waktu, pelapor, uraian; error dari server |
| Shell detail insiden | Kode, judul, severity, status, label TLP, pemilih status, tombol laporan |
| Tab Ringkasan | Uraian, profil kampanye dan ATT&CK, ringkasan metadata, indikator akses bukti, temuan terkuat |
| Tab Bukti | Dropzone multi-berkas, pilihan share scope, catatan, unggah, manifest, status verifikasi, hash, penanda duplikat lintas kasus, tombol Passport |
| Panel Passport | Hash dan ukuran, TLP, integritas, static analysis dan verdict, aturan yang cocok, penjelasan, chain of custody, permintaan akses, catatan custody, transfer, penerimaan |
| Tab Indikator | Filter jenis, pivot ke insiden lain, lifecycle, confidence, toggle berbagi (hanya unit pemilik) |
| Tab Kronologi | Pemutaran bertahap, jeda, kecepatan, tampilkan semua, asal peristiwa |
| Tab Korelasi | Skor dan band, daftar alasan, penanda blinded, konfirmasi atau tolak, dampak ke audit |
| Tab Konteks | Pemetaan ATT&CK dengan artefak pendukung, form pemetaan, daftar aset terdampak, tautkan aset |
| Tab Respons | Daftar tugas, tambah tugas, ubah status, pilih dan jalankan playbook |
| Tab Akses | Permintaan akses, alasan, status, kedaluwarsa, setujui atau tolak untuk koordinator |
| Tab Audit | Catatan audit insiden |
| Graf korelasi | Simpul insiden dan indikator, hover, klik ke detail, penanda simpul terisolasi |
| Integritas | Verifikasi rantai, checkpoint, rotasi kunci tanda tangan, ekspor checkpoint, uji manipulasi |
| Ekspor | Laporan HTML, Markdown, JSON, STIX 2.1, bundle offline, impor bundle, kunci publik |

Status yang wajib dirancang untuk setiap layar: loading, kosong, error, sukses, terlarang,
dan data panjang atau terpotong. Jangan hanya mendesain kondisi normal.

### 11.2 Tes semua fungsi frontend

Checklist minimum, dijalankan manual sebelum submission:

**Autentikasi dan sesi**

- Login benar dan salah, pesan rate limit 429, logout, sesi kedaluwarsa, permintaan tanpa CSRF.
- Tiga peran: alpha, bravo, koordinator. Pastikan tombol yang tidak berhak tidak menyesatkan.

**Insiden**

- Buat laporan dengan judul kosong, waktu tidak valid, dan uraian panjang.
- Filter dan pencarian, termasuk hasil kosong.
- Buka detail lewat URL langsung dan refresh halaman.

**Bukti**

- Unggah `.eml`, `.csv`, `.txt`, `.zip`, gambar, beberapa berkas sekaligus.
- Berkas melebihi batas, berkas rusak, dan unggahan tanpa berkas.
- Hash muncul, status verifikasi benar, duplikat lintas kasus terdeteksi.
- Passport: verdict, aturan, penjelasan, custody, catatan, transfer, permintaan akses.
- Unduhan ditolak untuk unit lain sebelum approval, dan berhasil setelah approval.

**Indikator**

- Filter jenis, pivot ke insiden lain, lifecycle berubah dan skor korelasi ikut berubah.
- Toggle berbagi hanya aktif untuk unit pemilik.

**Korelasi dan kronologi**

- Konfirmasi dan tolak temuan, pastikan status tidak kembali menjadi open setelah reload.
- Nilai blinded tampil tersamar untuk unit lain.
- Putar, jeda, ubah kecepatan, dan tampilkan semua pada kronologi.

**Konteks dan respons**

- Tambah pemetaan ATT&CK dengan dan tanpa artefak.
- Tautkan aset, jalankan playbook, ubah status tugas.

**Akses dan audit**

- Ajukan akses, setujui, tolak, dan biarkan kedaluwarsa.
- Verifikasi rantai, uji manipulasi, pulihkan, rotasi kunci dengan dan tanpa konfirmasi.
- Ekspor checkpoint hanya untuk koordinator.

**Ekspor**

- Buka laporan HTML dan cetak ke PDF.
- Unduh Markdown dan JSON, pastikan isinya sesuai.
- Unduh STIX dan validasi sebagai JSON.
- Ekspor bundle, lalu impor kembali di instance bersih.

**Ketahanan dan aksesibilitas**

- Jaringan putus, 401, 403, 404, 429, 500.
- Keyboard-only, fokus terlihat, label form, kontras, zoom 200 persen.
- 320, 768, 1024, 1440 piksel. Tidak ada horizontal scroll yang tidak disengaja.
- Chrome dan Firefox terbaru.

### 11.3 Parafrase dokumen (opsional)

Jika waktu tersisa, parafrase ulang tanpa mengubah fakta, angka, atau klaim keamanan:

- `README.md`
- `docs/demo-script.md`
- `docs/slides-outline.md`
- `docs/screenshots/README.md`

Aturan: pertahankan angka benchmark, batas 900 KB versus 50 MB, status 24 uji, dan
keterbatasan hash-only. Jangan menaikkan klaim di atas implementasi. Setelah parafrase,
perbarui screenshot bila teks di layar berubah.

---

## 12. Sumber data

- CISA AA23-341A, *Russian FSB Cyber Actor Star Blizzard Continues Worldwide Spearphishing Campaigns*, 7 Desember 2023.
  https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-341a
- MITRE ATT&CK technique IDs yang dipakai: T1566.001, T1566.002, T1583.001, T1539, T1550.004,
  T1078, T1114.002, T1114.003.

Advisory memuat profil dan taktik, bukan daftar IOC yang bisa dipakai langsung. Karena itu nilai
indikator pada dataset demo dibuat sintetis dan ditandai, sementara profil kampanye serta teknik
diambil dari sumber publik tersebut.
