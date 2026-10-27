-- =====================================================================
-- PustakaKu — 0010 Kebijakan konsisten `kartu_saya()` (penegasan 0008)
--
-- CATATAN HUBUNGAN: isi perubahan ini SAMA dengan 0008
-- (202610270002_kebijakan_kartu_saya.sql). Berkas ini dibuat sebagai
-- PENEGASAN idempoten karena penerapan migrasi dilakukan manual per
-- environment — bila 0008 belum sempat dijalankan di suatu proyek, 0010
-- menutup celah yang sama; bila 0008 sudah jalan, 0010 hanya menulis ulang
-- definisi yang identik (drop + create), tanpa efek samping.
--
-- Masalah yang diselesaikan: kebijakan dijalankan DENGAN HAK PEMANGGIL
-- (PostgreSQL: "Policy expressions are run as part of the query and with
-- the privileges of the user running the query"). Ketiga kebijakan di bawah
-- menyebut tabel `profiles` lewat sub-SELECT, yang bekerja hanya karena
-- `authenticated` masih memegang GRANT SELECT pada profiles (0005) — pola
-- yang sama dengan pemicu 42501 pada tamu (diperbaiki di 0007). Semantik
-- baris TIDAK berubah: hanya sumber id kartu diganti ke fungsi SECURITY
-- DEFINER `public.kartu_saya()` (0007).
--
-- Tidak disentuh: `log_hapus` (hanya is_admin), pemicu `jaga_log`
-- (SECURITY DEFINER), kebijakan `profiles_*` (tabelnya sendiri),
-- `anggota_lihat` & `peminjaman_lihat` (sudah kartu_saya sejak 0007),
-- `kunjungan_lihat` (0009, is_admin).
--
-- Jalankan lewat Supabase SQL Editor (urut setelah 0009) atau
-- `supabase db push`. Idempoten.
-- =====================================================================

-- 1) anggota — UPDATE: petugas (anggota.kelola) atau pemilik kartu.
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

-- 2) log_aktivitas — baca: admin semua; anggota hanya jejak miliknya.
drop policy if exists log_lihat on public.log_aktivitas;
create policy log_lihat on public.log_aktivitas
  for select using (
    public.is_admin()
    or aktor_id = auth.uid()
    or (anggota_id is not null and anggota_id = public.kartu_saya())
  );

-- 3) log_aktivitas — tulis: sesi login; identitas penulis tetap dipaksa
--    oleh pemicu jaga_log, bukan dari body klien.
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
-- -- Tidak ada lagi kebijakan tabel publik (di luar profiles) yang menyebut
-- -- `profiles` lewat sub-SELECT:
-- select schemaname, tablename, policyname
--   from pg_policies
--  where schemaname = 'public'
--    and definition like '%public.profiles%'
--    and tablename <> 'profiles'
--  order by tablename, policyname;      -- hasil: 0 baris
--
-- -- Ketiga kebijakan memanggil helper:
-- select policyname from pg_policies
--  where schemaname = 'public'
--    and policyname in ('anggota_ubah', 'log_lihat', 'log_tambah');  -- 3 baris