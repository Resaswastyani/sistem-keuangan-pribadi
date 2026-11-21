# mellow — sistem keuangan pribadi

Aplikasi pribadi untuk mencatat keuangan, target tabungan, jadwal harian, dan pengingat, dengan notifikasi push yang muncul di layar HP (Android & iOS) seperti pesan WhatsApp.

**Stack:** Next.js 16 (App Router) · PostgreSQL di [Neon](https://neon.tech) · Web Push (VAPID) · PWA

## Fitur

- **Keuangan**: pemasukan/pengeluaran per kategori, saldo, grafik 7 hari, anggaran bulanan
- **Target tabungan**: setoran tabungan memotong saldo dan menambah progres target
- **Jadwal harian**: kegiatan per tanggal, opsi "ingatkan X menit sebelum"
- **Pengingat**: sekali, harian, mingguan, atau bulanan
- **Notifikasi**: daftar notifikasi di dalam app, dan push ke HP/laptop walau app sedang ditutup
- **Ibadah**: jadwal sholat resmi Kemenag RI per kabupaten/kota (bawaan: Boyolali), kalender Hijriah, puasa Ramadan & sunnah, rekap dan utang puasa
- **Pesan notifikasi custom**: setiap notifikasi otomatis bisa ditulis sendiri, misalnya `Res jangan lupa sholat {sholat} dulu 🤍`
- **Otomatis via cron**: adzan, sahur, imsak, berbuka, puasa sunnah besok, pengingat jatuh tempo, ringkasan malam, dan peringatan anggaran 80% / 100%

## Jadwal sholat & puasa

- **Sumber data**: [MyQuran API](https://api.myquran.com) (data Kemenag RI). Kalau MyQuran sedang down, otomatis pakai [Aladhan](https://aladhan.com) dengan metode Kemenag (`method=20`).
- Jadwal diambil **sebulan sekali** per kota dan disimpan di tabel `prayer_times`, jadi app dan cron tidak memanggil API luar setiap saat.
- **Kalender Hijriah** dihitung di server (Umm al-Qura). Di menu Ibadah ada **koreksi ±1–2 hari** untuk menyesuaikan dengan hasil sidang isbat.
- **Puasa sunnah** yang dikenali: Senin, Kamis, Ayyamul Bidh (13–15), Arafah, awal Zulhijah, Tasua, Asyura, dan 6 hari Syawal. Hari raya & hari tasyrik otomatis dikecualikan.
- **Pengingat sahur, imsak & berbuka** dikirim saat Ramadan, atau di hari yang kamu tandai "Aku puasa hari ini" / "Rencanakan".

### Placeholder pesan custom

| Notifikasi | Placeholder |
|---|---|
| Sholat | `{nama}` `{sholat}` `{waktu}` `{sisa}` `{kota}` `{tanggal_hijriah}` |
| Sahur / Imsak / Berbuka | `{nama}` `{waktu}` `{sisa}` `{kota}` `{tanggal_hijriah}` |
| Puasa sunnah besok | `{nama}` `{jenis}` `{tanggal_hijriah}` |
| Ringkasan malam | `{nama}` `{ringkasan}` `{jumlah_transaksi}` `{pengeluaran}` `{agenda_besok}` |
| Anggaran | `{nama}` `{persen}` `{terpakai}` `{anggaran}` |
| Agenda | `{nama}` `{judul}` `{waktu}` `{sisa}` `{detail}` |

Untuk pengingat yang kamu buat sendiri di menu **Pengingat**, judul dan detailnya dikirim apa adanya.

## Menjalankan di komputer

```bash
pnpm install
cp .env.example .env.local      # lalu isi nilainya
pnpm db:migrate                 # membuat tabel (aman diulang)
pnpm db:seed                    # membuat/reset akun SEED_USERNAME dengan SEED_PASSWORD
pnpm dev
```

## Deploy ke Vercel

1. Import repo ini di Vercel.
2. Isi **Environment Variables** sesuai `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, dan `APP_TIMEZONE`. Variabel `SEED_*` tidak perlu diisi di Vercel.
3. Deploy. Push notification wajib HTTPS, dan Vercel sudah otomatis HTTPS.

## Cronjob (notifikasi & pengingat)

Endpoint: `GET` atau `POST /api/cron/reminders`, dijalankan **tiap 1 menit** supaya notifikasi adzan tepat waktu. Minimal tiap 5 menit, tapi notifikasi bisa telat sampai 5 menit. Notifikasi yang telat lebih dari 20 menit (misalnya karena cron sempat mati) tidak dikirim.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://DOMAIN-KAMU/api/cron/reminders
```

Contoh dengan **cron-job.org** (gratis):
- URL: `https://DOMAIN-KAMU/api/cron/reminders`
- Schedule: setiap 1 menit
- Advanced → Headers: `Authorization` = `Bearer <CRON_SECRET>`

Kalau layanan cron-mu tidak bisa menambah header, bisa pakai header `x-cron-secret: <CRON_SECRET>`, atau sebagai pilihan terakhir query `?secret=<CRON_SECRET>` (kurang aman karena bisa tercatat di log).

Setiap pengingat di-*claim* secara atomik, jadi tidak akan terkirim dua kali walau cron berjalan bersamaan.

## Notifikasi di HP

| Perangkat | Cara mengaktifkan |
|---|---|
| **Android** (Chrome) | Buka situs → menu ⋮ → **Instal aplikasi** → buka mellow → Pengaturan → nyalakan *Notifikasi di perangkat ini* |
| **iPhone/iPad** (iOS 16.4+) | Buka di **Safari** → tombol **Bagikan** → **Tambah ke Layar Utama** → buka mellow **dari ikon** di layar utama → Pengaturan → nyalakan notifikasi |
| Laptop (Chrome/Edge/Firefox/Safari) | Pengaturan → nyalakan notifikasi |

Di iOS, push **hanya** bisa dipakai setelah app ditambahkan ke Layar Utama; ini aturan dari Apple. Tekan **Kirim notifikasi uji** untuk mengecek.

## Keamanan

- Password di-hash dengan **bcrypt** (cost 12). Sesi berupa JWT HS256 di cookie `httpOnly`, `Secure`, dan `SameSite=Lax`.
- Sesi bisa dicabut: logout atau ganti password menaikkan `token_version`, sehingga semua perangkat lain langsung keluar.
- **Rate limit login**: 10 percobaan gagal per IP setiap 15 menit. Akun dikunci 15 menit setelah 5 kali gagal.
- Waktu respons login dibuat sama walau username tidak ada, untuk mencegah *user enumeration*.
- **Proteksi CSRF**: request yang mengubah data wajib berasal dari origin yang sama.
- Semua input divalidasi dengan **Zod**, dan semua query diparameterisasi (aman dari SQL injection).
- Header keamanan: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- Endpoint cron dilindungi secret dengan perbandingan *timing-safe*.
- Setiap data selalu difilter `user_id` milik sesi, jadi user tidak bisa mengakses data user lain.

## Struktur

```
app/api/…            Route handler (REST API)
app/manifest.ts      PWA manifest
proxy.ts             Penjaga route + CSRF (Next 16 "middleware")
lib/                 db, auth, notify (web push), skema validasi
db/schema.sql        Skema database
scripts/             migrate, seed, generate-icons
public/sw.js         Service worker (push & klik notifikasi)
```
