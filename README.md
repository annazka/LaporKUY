# LaporKUY!

LaporKUY! adalah website untuk melaporkan kerusakan infrastruktur di Jakarta melalui foto dan lokasi, lalu memantau status serta progres penanganannya sampai selesai. AI membantu menganalisis foto dan mengenali laporan kerusakan yang sama, sementara pelapor dapat mengumpulkan poin untuk ditukar dengan voucher simulasi.

**Website:** [laporkuy.online](https://laporkuy.online)

**Tahap:** First Draft Submission — MIA 2026

## Tech stack

| Bagian | Teknologi |
| --- | --- |
| Frontend dan API | Next.js 16 (App Router), React 19, TypeScript |
| Tampilan | CSS, Tailwind CSS 4, Lucide |
| Autentikasi | Supabase Auth |
| Database dan penyimpanan foto | Supabase PostgreSQL dan Storage |
| Analisis dan perbandingan foto | Google Gemini API |
| Peta | Leaflet dan OpenStreetMap |
| Pengolahan gambar | Sharp |
| Hosting | Vercel |

## Cara menjalankan project

### 1. Clone dan instal dependensi

Siapkan **Node.js 22.13 atau lebih baru**, npm, proyek Supabase, dan API key Google Gemini untuk fitur AI.

```bash
git clone https://github.com/annazka/LaporinKUY.git
cd LaporinKUY
npm install
```

### 2. Atur environment

Buat file `.env.local` di direktori utama project:

```dotenv
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=ISI_PUBLISHABLE_KEY_SUPABASE
GEMINI_API_KEY=ISI_API_KEY_GEMINI
GEMINI_MODEL=ISI_NAMA_MODEL_GEMINI
```

Ganti nilai contoh dengan konfigurasi proyek sendiri. Pilih model Gemini yang mendukung input gambar dan tersedia untuk API key tersebut. Semua variabel digunakan di server; jangan menambahkan API key atau file `.env.local` ke GitHub.

### 3. Siapkan Supabase

- Untuk database baru, jalankan file SQL di [`supabase/migrations`](supabase/migrations) sesuai urutan nama file. Jangan menjalankan ulang migrasi awal pada database yang sudah terpasang.
- Pada **Authentication → URL Configuration**, tambahkan `http://localhost:3000/auth/confirm` dan `http://localhost:3000/auth/reset` ke Redirect URLs untuk pengujian lokal.
- Template email tersedia di [`supabase/templates`](supabase/templates) dan perlu dipasang melalui pengaturan email Supabase. Sesuaikan domain pada template dengan lingkungan pengujian.
- Pendaftaran umum membuat akun warga. Untuk menguji dashboard operator, tetapkan role `operator` melalui pengelola Supabase; lihat [`docs/setup-admin-account.sql`](docs/setup-admin-account.sql). Tidak ada password admin bawaan dalam kode.

### 4. Jalankan

```bash
npm run dev
```

Buka **http://localhost:3000**. Analisis foto dan pengiriman laporan memerlukan konfigurasi Supabase serta Gemini yang valid.

Untuk build produksi lokal:

```bash
npm run build
npm start
```

## Progres saat ini

Versi awal sudah memiliki alur pelaporan warga dan penanganan operator:

- **Landing page:** tentang LaporKUY!, cara kerja interaktif, foto laporan, peta Jakarta, ringkasan laporan, voucher, FAQ, dan footer. Latar video berganti mengikuti waktu Jakarta.
- **Akun warga:** daftar, konfirmasi email, masuk, lupa/reset kata sandi, dashboard, laporan saya, dan saldo poin.
- **Pembuatan laporan:** unggah foto, kategori dan deskripsi otomatis dari AI, serta pemilihan lokasi melalui pin peta yang bisa digeser atau GPS.
- **Penggabungan laporan:** kategori sama, jarak maksimal 25 meter, dan perbandingan AI yang menunjukkan kerusakan fisik yang sama. Kontribusi akun berbeda dihitung sebagai upvote; akun yang sama dihitung satu kali per kasus.
- **Pemantauan:** status laporan, jadwal, progres, riwayat perubahan target, dan foto hasil perbaikan terbaru. Pelapor dapat mengonfirmasi hasil atau meminta pemeriksaan ulang.
- **Dashboard operator:** ringkasan, antrean penanganan, verifikasi laporan, peta kendali, pembaruan progres dengan bukti foto, pengelolaan voucher, dan audit aktivitas.
- **Poin dan voucher:** saldo, katalog dengan filter, dan alur penukaran untuk pengujian.

Project masih berupa **prototipe**. Hasil AI tetap diverifikasi operator; penanganan dalam aplikasi belum merupakan integrasi resmi dengan pemerintah. Poin dan voucher masih **simulasi**, belum berlaku sebagai tiket atau manfaat nyata.

## Pemeriksaan kode

```bash
npm run typecheck
npm test
npm run build
```

Pengujian SQL dalam direktori [`tests`](tests) dijalankan terpisah dan hanya pada database pengembangan yang diizinkan untuk pengujian.

## Alur pengembangan

Perubahan dikembangkan di branch **`uji-coba`** dan ditinjau melalui preview sebelum digabung ke **`main`** untuk produksi. Panduan tampilan dan interaksi dicatat di [`DESIGN.md`](DESIGN.md).
