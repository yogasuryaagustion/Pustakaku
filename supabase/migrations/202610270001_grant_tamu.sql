-- =====================================================================
-- PustakaKu — 0007 Hak akses TAMU (perbaikan GRANT setelah 0005)
--
-- Gejala yang diperbaiki (tercatat di log dev, terakhir masih terjadi):
--   GET /api/anggota    → 403  permission denied for table anggota
--   GET /api/peminjaman → 403  permission denied for table peminjaman
-- src/lib/library-context.tsx memanggil kedua endpoint itu untuk SETIAP
-- pengunjung (Promise.all saat mount), termasuk tamu, sehingga katalog
-- selalu memunculkan toast "Anda tidak memiliki izin untuk melakukan aksi ini."
--
-- Prinsipnya TIDAK berubah dari 0005: GRANT seminimal mungkin, RLS yang
-- membatasi isi barisnya. Kebijakan di 0003 tetap menolak SELURUH baris bagi
-- tamu, jadi balasan yang diterima kini 200 + daftar KOSONG — bukan data.
--
-- Catatan teknis (mengapa sekadar GRANT tidak cukup):
--   PostgreSQL: "Policy expressions are run as part of the query and with
--   the privileges of the user running the query" — kebijakan BUKAN
--   SECURITY DEFINER. Kebijakan anggota_lihat / peminjaman_lihat di 0003
--   menyebut tabel `profiles` lewat sub-SELECT, sedangkan `anon` sengaja
--   TIDAK diberi SELECT pada profiles (lihat 0005). Tanpa perubahan ini,
--   sesudah GRANT pun tamu masih kena 42501 "permission denied for table
--   profiles". Solusinya: helper SECURITY DEFINER (kartu_saya/email_saya)
--   yang membaca profiles sebagai PEMILIK FUNGSI.
--
-- Jalankan lewat Supabase SQL Editor (urut setelah 0001–0006) atau
-- `supabase db push`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper SECURITY DEFINER: identitas sesi berjalan tanpa perlu GRANT
--    SELECT pada `profiles` untuk pemanggil.
-- ---------------------------------------------------------------------
create or replace function public.kartu_saya() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.anggota_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.email_saya() returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.email from public.profiles p where p.id = auth.uid();
$$;

comment on function public.kartu_saya() is
  'Kartu anggota milik sesi berjalan (NULL bila tamu). SECURITY DEFINER agar kebijakan RLS tidak membutuhkan GRANT SELECT pada profiles.';
comment on function public.email_saya() is
  'Email akun sesi berjalan (NULL bila tamu). Dipakai kebijakan anggota_lihat untuk kartu ber-email sama.';

-- Hak eksekusi: hanya peran API (kunci `anon` dipakai oleh tamu).
revoke execute on function public.kartu_saya() from public;
revoke execute on function public.email_saya()  from public;
grant  execute on function public.kartu_saya()  to anon, authenticated, service_role;
grant  execute on function public.email_saya()  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Tamu: cukup HAK BACA tabel agar endpoint katalog bersama tidak 403.
--    Barisnya tetap kosong karena kebijakan RLS di 0003 menolak semua
--    baris bagi peran tanpa izin (`anggota.lihat` / `sirkulasi.lihat`
--    semuanya false untuk `tamu`).
-- ---------------------------------------------------------------------
grant select on table public.anggota    to anon;
grant select on table public.peminjaman to anon;

-- ---------------------------------------------------------------------
-- 3. Kebijakan pilihan: sub-SELECT ke `profiles` diganti helper di atas.
--    (PostgreSQL tidak punya CREATE POLICY OR REPLACE → drop + create.)
-- ---------------------------------------------------------------------
drop policy if exists anggota_lihat on public.anggota;
create policy anggota_lihat on public.anggota
  for select using (
    public.boleh('anggota.lihat')
    -- kartu yang sudah tertaut ke akun ini
    or public.kartu_saya() = public.anggota.id
    -- kartu ber-email sama dengan akun yang masuk: hanya inilah baris yang
    -- boleh dilihat/ditautkan sendiri (persis syarat pemicu jaga_profil di
    -- migrasi 0006, sehingga tautan kartu milik orang lain tetap mustahil).
    or (
      public.anggota.email <> ''
      and lower(public.anggota.email) = lower(public.email_saya())
    )
  );

drop policy if exists peminjaman_lihat on public.peminjaman;
create policy peminjaman_lihat on public.peminjaman
  for select using (
    public.boleh('sirkulasi.lihat')
    or public.boleh('laporan.lihat')
    or (
      public.boleh('panel.pinjaman')
      and public.kartu_saya() = public.peminjaman.anggota_id
    )
  );

-- =====================================================================
-- VERIFIKASI (jalankan setelah file ini; hasilnya harus seperti keterangan)
-- =====================================================================
-- Tamu kini boleh membaca dua tabel di atas, tetapi TIDAK profiles:
-- select has_table_privilege('anon', 'public.anggota',     'select') as anon_anggota;   -- true
-- select has_table_privilege('anon', 'public.peminjaman',  'select') as anon_pinjam;    -- true
-- select has_table_privilege('anon', 'public.profiles',    'select') as anon_profil;    -- false
-- select has_table_privilege('anon', 'public.buku',        'select') as anon_buku;      -- true
-- select has_function_privilege('anon', 'public.kartu_saya()', 'execute') as anon_kartu; -- true
--
-- Tamu tetap tidak melihat satu baris pun (RLS default-deny yang berlaku):
-- set request.jwt.claims to '{"role":"anon"}';
-- set role anon;
-- select count(*) from public.anggota;    -- 0
-- select count(*) from public.peminjaman; -- 0
-- reset role;