-- =====================================================================
-- PustakaKu — 0008 Kebijakan tanpa sub-SELECT `profiles` (lanjutan 0007)
--
-- Latar: kebijakan dieksekusi DENGAN HAK PEMANGGIL (PostgreSQL: "Policy
-- expressions are run as part of the query and with the privileges of the
-- user running the query"). Kebijakan di 0003 yang menyebut tabel
-- `profiles` lewat sub-SELECT bekerja hari ini HANYA karena peran
-- `authenticated` masih memegang GRANT SELECT pada profiles (0005). Pola
-- itu adalah pemicu 42501 yang sama dengan yang membuat tamu gagal di
-- 0007 — jadi ketiga kebijakan ini dialihkan ke helper SECURITY DEFINER
-- `public.kartu_saya()` (migrasi 0007), yang membaca `profiles` sebagai
-- pemilik fungsi: tidak ada GRANT tambahan yang dibutuhkan, dan semantik
-- baris TIDAK berubah sama sekali.
--
-- Sengaja TIDAK disentuh:
--   * `log_hapus`        — hanya `public.is_admin()`, tanpa rujukan profiles.
--   * `jaga_log` (pemicu)— SECURITY DEFINER, dijalankan sebagai pemilik.
--   * `profiles_lihat/tambah/hapus` — memang membaca tabelnya sendiri.
--
-- Jalankan lewat Supabase SQL Editor (urut setelah 0007) atau
-- `supabase db push`. Idempoten: drop policy if exists + create policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. anggota — UPDATE: hanya petugas (anggota.kelola) atau pemilik kartu.
--    (Baris yang boleh DIBACA sudah diatur `anggota_lihat` di 0007.)
-- ---------------------------------------------------------------------
drop policy if exists anggota_ubah on public.anggota;
create policy anggota_ubah on public.anggota
  for update
  using (
    public.boleh('anggota.kelola')
    or public.kartu_saya() = public.anggota.id
  )
  with check (
    public.boleh('anggota.kelola')
    or public.kartu_saya() = public.anggota.id
  );

-- ---------------------------------------------------------------------
-- 2. log_aktivitas — baca: admin semua; anggota hanya jejak miliknya
--    (aktor_id sendiri, atau kartu yang terdampak).
-- ---------------------------------------------------------------------
drop policy if exists log_lihat on public.log_aktivitas;
create policy log_lihat on public.log_aktivitas
  for select using (
    public.is_admin()
    or aktor_id = auth.uid()
    or (anggota_id is not null and anggota_id = public.kartu_saya())
  );

-- ---------------------------------------------------------------------
-- 3. log_aktivitas — tulis: sesi login; identitas penulis tetap dipaksa
--    oleh pemicu jaga_log (migrasi 0003), bukan dari body klien.
-- ---------------------------------------------------------------------
drop policy if exists log_tambah on public.log_aktivitas;
create policy log_tambah on public.log_aktivitas
  for insert with check (
    auth.uid() is not null
    and (aktor_id is null or aktor_id = auth.uid() or public.is_admin())
    and (
      anggota_id is null
      or public.is_admin()
      or anggota_id = public.kartu_saya()
    )
  );

-- =====================================================================
-- VERIFIKASI (jalankan setelah file ini; hasilnya harus seperti keterangan)
-- =====================================================================
-- -- Tidak ada lagi kebijakan tabel publik yang menyebut `profiles` langsung:
-- select schemaname, tablename, policyname
--   from pg_policies
--  where schemaname = 'public'
--    and definition like '%public.profiles%'
--  order by tablename, policyname;          -- hasil: hanya baris milik tabel profiles
--
-- -- Anggota biasa tetap hanya melihat jejaknya sendiri (uji dengan sesi login):
-- -- GET /api/jejak → hanya baris ber-aktor_id sendiri / kartu tertaut.