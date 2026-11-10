# PustakaKu

Aplikasi perpustakaan sekolah: katalog, peminjaman & pengembalian, kartu
anggota digital, inventaris dengan salinan buku dan hitung fisik, statistik
kunjungan, laporan, dan hak akses tiga peran (Anggota, Admin, Super Admin).

Dibangun dengan Next.js 16, React 19, Supabase (Auth + Postgres + RLS).

## Dokumentasi

| Dokumen | Untuk siapa |
|---|---|
| [`PANDUAN-PETUGAS.md`](./PANDUAN-PETUGAS.md) | Petugas perpustakaan — pemakaian harian, tanpa istilah teknis |
| [`SUPABASE.md`](./SUPABASE.md) | Admin teknis — pemasangan, migrasi, staging, backup, rilis |

## Menjalankan di komputer sendiri

```bash
cp .env.example .env.local   # isi URL + anon key Supabase
npm install
npm run dev                  # http://localhost:3000
```

Database perlu disiapkan lebih dulu: jalankan 26 berkas di
`supabase/migrations/` sesuai urutan nama, lalu buat akun Super Admin pertama.
Langkah lengkapnya ada di [`SUPABASE.md`](./SUPABASE.md) bagian 3–5.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Menjalankan hasil build |
| `npm run lint` | ESLint |
| `npm run test` | Uji aturan inventaris (node:test, tanpa dependensi tambahan) |
| `npx tsc --noEmit -p tsconfig.json` | Pemeriksaan tipe |

## Catatan penting

- **Satu instalasi melayani satu perpustakaan.** Aplikasi belum multi-tenant;
  untuk beberapa sekolah gunakan satu proyek Supabase dan satu deployment per
  sekolah.
- Tes otomatis: `npm run test` menjalankan uji unit aturan selisih inventaris
  (rusak dihitung, hilang dikecualikan). Uji fungsi database
  `rekonsiliasi_stok_inventaris()` ada di `supabase/tests/rekonsiliasi_stok.sql`
  dan dijalankan manual dengan `psql "$DATABASE_URL" -f
  supabase/tests/rekonsiliasi_stok.sql` — skrip itu berakhir `ROLLBACK` sehingga
  data tidak berubah. Belum ada CI. Sebelum rilis, jalankan `test`, `tsc`, `lint`,
  `build`, dan daftar periksa staging di `SUPABASE.md` bagian 8.
