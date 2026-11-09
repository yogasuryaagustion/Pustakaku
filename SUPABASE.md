# PustakaKu — Panduan Database, Staging, dan Rilis

Dokumen ini untuk **admin teknis** (guru TIK / operator sekolah / pengembang).
Petugas perpustakaan cukup membaca [`PANDUAN-PETUGAS.md`](./PANDUAN-PETUGAS.md).

> **Satu instalasi = satu perpustakaan.** Kode ini belum multi-tenant: tidak
> ada kolom sekolah pada tabel mana pun, `pengaturan_sistem` hanya punya satu
> baris, dan seluruh kebijakan RLS memeriksa peran (bukan institusi). Untuk
> dua sekolah, buat **dua proyek Supabase + dua deployment** — lihat bagian 9.

---

## 1. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Node.js | 20 atau lebih baru (proyek memakai Next.js 16) |
| Akun Supabase | Satu proyek untuk produksi, satu untuk staging |
| Akun hosting | Vercel / Railway / server sendiri yang bisa menjalankan `next start` |
| Domain + HTTPS | Wajib untuk cookie sesi dan pendaftaran mandiri |

Salin variabel lingkungan terlebih dahulu:

```bash
cp .env.example .env.local
```

## 2. Variabel lingkungan

| Nama | Rahasia | Diambil dari |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | tidak | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tidak | Project Settings → API → anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **ya** | Project Settings → API → service_role |

Aturan yang tidak boleh dilanggar:

- Hanya variabel berawalan `NEXT_PUBLIC_` yang boleh sampai ke browser.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dibaca route handler di server. Tanpa kunci
  ini aplikasi tetap berjalan; hanya fitur **reset/hapus akun** di Kelola Akun
  yang menampilkan pesan galat.
- Jangan pernah menaruh kunci di dalam kode, commit, tangkapan layar, atau chat.

## 3. Membuat proyek Supabase

1. Buat proyek baru, simpan **database password** di tempat aman.
2. Catat Project URL dan anon key → isi `.env.local`.
3. Project Settings → Authentication → URL Configuration:
   - **Site URL**: `https://perpustakaan.sekolah.sch.id`
   - **Redirect URLs**: tambahkan `https://perpustakaan.sekolah.sch.id/**`
     dan, untuk pengembangan, `http://localhost:3000/**`.
4. Authentication → Providers → Email:
   - **Matikan "Confirm email"** bila sekolah tidak punya SMTP. Dengan
     konfirmasi aktif, pendaftaran mandiri tetap tersimpan tetapi anggota baru
     harus mengklik tautan email sebelum bisa masuk (aplikasi sudah menampilkan
     pesan yang sesuai).

## 4. Menjalankan migrasi (22 berkas, urut)

Migrasi ada di `supabase/migrations/` dan **harus dijalankan berurutan menurut
nama berkas** (tanggal di depan nama). Semua migrasi bersifat menambah, tidak
menghapus data lama — tetapi tetap **backup dulu** (bagian 7).

**Cara A — SQL Editor (paling mudah, tanpa CLI).**
Buka Supabase → SQL Editor → tempel isi berkas → Run, satu berkas per satu kali,
urut dari `202610260001_skema.sql` sampai `202611090001_jumlah_tersedia.sql`.

Urutan lengkapnya:

```
202610260001_skema.sql
202610260002_izin_bawaan.sql
202610260003_rls.sql
202610260004_rpc.sql
202610260005_grant.sql
202610260006_fungsi.sql
202610270001_grant_tamu.sql
202610270002_kebijakan_kartu_saya.sql
202610270003_kunjungan.sql
202610270004_kebijakan_konsisten_kartu.sql
202610280001_registrasi_kartu.sql
202610300001_peran_superadmin.sql
202610300002_kewenangan_sistem_superadmin.sql
20261102000100_keamanan_rbac_tahap_1.sql
20261102000200_cegah_superadmin_terakhir.sql
202611050001_eksemplar_buku.sql
202611060001_opname.sql
202611060002_perbaikan_sinkronisasi_stok.sql
202611060003_peminjaman_eksemplar.sql
202611060004_kondisi_pengembalian.sql
202611060005_format_nomor_inventaris.sql
202611090001_jumlah_tersedia.sql
```

**Cara B — Supabase CLI.** Repo ini belum punya `supabase/config.toml`, jadi
lakukan `supabase init` sekali, lalu:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### Verifikasi setelah migrasi

Jalankan di SQL Editor — hasil yang diharapkan:

```sql
-- 1 baris pengaturan, nama bawaan PustakaKu
select id, nama, lama_pinjam, denda_per_hari, maks_pinjaman from public.pengaturan_sistem;

-- tiga peran pada matriks izin: admin, superadmin, user
select id from public.kebijakan_akses order by id;

-- RLS harus aktif pada 7 tabel inti
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' and tablename in
   ('anggota','profiles','buku','peminjaman','kebijakan_akses','pengaturan_sistem','log_aktivitas');
```

## 5. Akun Super Admin pertama

Proyek baru belum punya admin. Urutannya:

1. Buka `/register`, daftarkan diri sebagai anggota (peran otomatis `user`).
2. Naikkan peran lewat SQL Editor:

```sql
update public.profiles
   set peran = 'superadmin', updated_at = now()
 where lower(email) = lower('admin@sekolah.sch.id');
```

3. Masuk ulang. Menu **Hak Akses Pengguna**, **Pengaturan**, dan **Kelola Akun**
   akan muncul. Akun petugas lain cukup dibuat dari Kelola Akun dengan peran
   `admin`.

Catatan: migrasi `202610300001_peran_superadmin.sql` hanya menaikkan akun yang
**sudah** berperan `admin` saat migrasi dijalankan; pada proyek baru tidak ada
baris seperti itu, jadi langkah manual di atas tetap perlu.

## 6. Nama dan identitas perpustakaan

`pengaturan_sistem.nama` dan `tagline` **belum bisa diubah dari halaman
Pengaturan** (halaman itu mengatur durasi pinjam, batas judul, denda, dan format
nomor inventaris). Untuk mengganti nama sekolah:

```sql
update public.pengaturan_sistem
   set nama = 'Perpustakaan SMP Negeri 1 Contoh',
       tagline = 'Literasi untuk semua',
       diubah_pada = now(), diubah_oleh = 'setup'
 where id;
```

Nama ini muncul di header, halaman publik, dan judul tab.

## 7. Backup dan pemulihan

**Backup otomatis.** Supabase menyediakan backup harian pada paket berbayar
(Project Settings → Database → Backups). Aktifkan dan cek tanggal backup
terakhir sebelum setiap rilis. Pada paket gratis, jadwalkan dump manual.

**Dump manual (sebelum migrasi/rilis).**

```bash
pg_dump "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges -Fc -f backup-$(date +%F).dump
```

**Uji restore** minimal sekali sebelum go-live, ke proyek staging:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://postgres.<ref-staging>:<password>@...:5432/postgres" \
  backup-2026-11-08.dump
```

Backup yang belum pernah diuji restore bukan backup — anggap belum ada.

## 8. Staging (wajib sebelum produksi)

Tujuan: memastikan migrasi dan alur kerja berjalan di database kosong, tanpa
menyentuh data sekolah.

### 8.1 Proyek staging yang sudah tersedia

| | |
|---|---|
| Nama | `sistem-perpustakaan-staging` |
| Reference ID | `xbgvkcoktvhkiwkerqai` |
| URL | `https://xbgvkcoktvhkiwkerqai.supabase.co` |
| Region | ap-south-1 (sama dengan produksi) |
| Paket | free |
| Super Admin | `admin@staging.perpus.id` (sandinya ada di `.env.staging.local`) |
| Akun anggota uji | `anggota.uji@staging.perpus.id` — sudah terkonfirmasi, kartu `AGT-0002` |

Sudah dikerjakan: 22 migrasi diterapkan berurutan tanpa galat, 11 tabel publik
dengan RLS aktif (40 kebijakan), baris `pengaturan_sistem` bawaan ada, akun Super
Admin terkonfirmasi bisa login, dan data tiruan awal terisi — 3 buku, 9 salinan,
5 anggota (4 tiruan + 1 kartu otomatis milik akun admin), 2 peminjaman (1 sudah
dikembalikan dengan kondisi `layak`, 1 masih aktif).

Auth staging sudah disiapkan untuk uji lokal: Site URL `http://localhost:3000`,
Redirect URLs `http://localhost:3000` dan `http://localhost:3000/**`, dan
"Confirm email" dimatikan (auto-konfirmasi) supaya `/register` bisa langsung masuk
tanpa SMTP. Pendaftaran uji sudah dibuktikan: akun baru langsung mendapat sesi,
profil `user`, dan kartu anggota dari trigger.

Kredensial staging (URL, anon/publishable key, sandi super admin, sandi database)
ada di `.env.staging.local` — berkas ini di-ignore git, jangan di-commit dan jangan
bagikan. Sandi database juga tidak bisa dilihat lagi di dasbor Supabase, jadi
simpan berkas itu.

### 8.2 Yang masih perlu dilakukan di dasbor staging

1. **Project Settings → Database → Backups**: aktifkan backup otomatis (paket
   berbayar) sebelum proyek ini dipakai untuk uji yang berarti.
2. Sebelum rilis, kembalikan "Confirm email" ke aktif dan isi Site URL staging
   dengan domain staging sungguhan (bukan `localhost`).

### 8.3 Menjalankan aplikasi terhadap staging

```bash
# simpan kunci sekolah dulu, jangan sampai tertimpa
mv .env.local .env.local.sekolah
grep -E '^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=' .env.staging.local > .env.local
npm run build && npm run start

# setelah uji selesai, kembalikan ke kunci sekolah
rm .env.local && mv .env.local.sekolah .env.local
```

Jangan biarkan `.env.local` menunjuk ke staging saat sedang mengerjakan data
sekolah: berkas itu yang dipakai `npm run dev` sehari-hari.

### 8.4 Daftar periksa uji

Isi dulu sisa data tiruan **lewat antarmuka**, bukan SQL, agar fungsi bisnis ikut
teruji: ubah Pengaturan (durasi 7 hari, denda 1000, maks 2 judul), cetak label QR
salinan, buat 1 pengembalian terlambat agar denda muncul, 1 perpanjangan, dan 1
hitung fisik dengan 1 selisih. Lalu uji:

- [ ] Daftar akun baru dari `/register`, lalu masuk.
- [ ] Pinjam buku → stok tersedia turun; kembalikan → stok kembali.
- [ ] Kembalikan dengan kondisi "Rusak ringan" → salinan tidak ditawarkan lagi.
- [ ] Anggota nonaktif tidak bisa meminjam (pesan ramah, bukan galat DB).
- [ ] Anggota biasa tidak bisa membuka `/sirkulasi`, `/anggota`, `/admin/*`.
- [ ] Admin tidak bisa menaikkan peran siapa pun; hanya Super Admin.
- [ ] Hitung fisik → perbaiki selisih → riwayat tercatat.
- [ ] Laporan tercetak/terunduh PDF.
- [ ] Hapus/Reset akun di Kelola Akun (butuh service role key).
- [ ] Tampilan 390 px (ponsel), 768 px (tablet), 1440 px (desktop).

Catat hasil tiap butir; butir yang gagal adalah blocker rilis. Setelah semua
lulus, ulangi bagian 4–6 pada proyek produksi (bagian 9).

## 9. Rilis produksi

1. `npm run build` harus sukses, `npx tsc --noEmit` bersih, `npm run lint` tanpa error.
2. Deploy ke hosting (Vercel: import repo, tambahkan ketiga variabel lingkungan;
   `SUPABASE_SERVICE_ROLE_KEY` sebagai *secret*, bukan variabel publik).
3. Isi Site URL dan Redirect URLs Supabase dengan domain produksi (bagian 3).
4. Buka domain produksi, masuk sebagai Super Admin, cek:
   - katalog publik menampilkan judul yang benar;
   - nama perpustakaan sesuai (bagian 6);
   - satu peminjaman uji berhasil dan dikembalikan;
   - `/admin/pengaturan` menyimpan perubahan.
5. Catat tanggal rilis dan backup terakhir di buku catatan operator.

**Banyak sekolah:** karena satu instalasi hanya untuk satu perpustakaan, buat
satu proyek Supabase + satu deployment per sekolah. Checklist per sekolah:
variabel lingkungan sendiri, 22 migrasi, akun Super Admin, nama perpustakaan,
domain, backup. Jangan pernah menaruh dua sekolah dalam satu database — RLS
memeriksa peran, bukan institusi, sehingga petugas sekolah A akan melihat data
sekolah B.

## 10. Pemecahan masalah

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| "Konfigurasi Supabase belum lengkap" | `.env.local` kosong/salah | Isi URL + anon key, restart server |
| Login berhasil lalu langsung keluar | Site URL/Redirect salah, cookie ditolak | Perbaiki URL Supabase, pastikan HTTPS |
| "Profil akun tidak ditemukan" | Trigger `saat_akun_dibuat` belum ada (migrasi terlewat) | Jalankan ulang migrasi 0001 dan 0005 |
| "Pendaftaran sedang ditutup" | Kebijakan akses `akun.daftar` dimatikan | Super Admin → Hak Akses Pengguna |
| Stok tidak sesuai rak | Salinan belum lengkap / hitung fisik belum dijalankan | Inventaris → Hitung Fisik → Perbaiki Selisih |
| Reset/hapus akun gagal | `SUPABASE_SERVICE_ROLE_KEY` kosong | Isi kunci, deploy ulang |
| Data hilang/rusak | Kesalahan operasi | Hentikan pemakaian, restore backup terakhir (bagian 7) |

## 11. Batasan yang diketahui

- Belum ada tes otomatis maupun CI; verifikasi bersandar pada tsc, lint, build,
  dan daftar periksa manual bagian 8.
- Tidak ada alur "lupa sandi" mandiri; reset dilakukan Super Admin.
- Denda hanya **dihitung dan dilaporkan**, tidak ada pencatatan pembayaran.
- Belum ada uji beban pada volume besar (ribuan anggota/peminjaman).
- Beberapa tabel lebar (Laporan, kunjungan) masih digeser ke samping di ponsel.
