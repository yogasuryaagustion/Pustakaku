-- =====================================================================
-- PustakaKu — 0005 Hak akses eksplisit (GRANT / REVOKE)
--
-- Masalah yang diperbaiki: pembacaan publik seluruh tabel membalas
--   42501 — permission denied for table …
-- artinya peran `anon` / `authenticated` / `service_role` belum memperoleh
-- GRANT SELECT (default privileges tidak ter-terapkan pada proyek ini).
-- RLS tidak menolak dengan cara itu — RLS hanya menyaring baris — jadi
-- kebijakan RLS di 0003 tetap berlaku setelah GRANT ini diberikan.
--
-- Prinsip: GRANT seminimal mungkin, RLS yang membatasi isi barisnya.
-- Jalankan lewat Supabase SQL Editor (urut setelah 0001–0004).
-- =====================================================================

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- ---------------------------------------------------------------------
-- service_role: kunci khusus SERVER (dipakai route handler untuk operasi
-- admin & impor). Melewati RLS, sehingga wajib mendapat hak penuh.
-- ---------------------------------------------------------------------
grant select, insert, update, delete
  on all tables in schema public
  to service_role;
grant usage, select
  on all sequences in schema public
  to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------
-- anon (tanpa sesi / kunci publishable): HANYA data publik untuk tampilan
-- tamu: katalog, matriks kebijakan (dipakai seluruh UI), dan pengaturan
-- sistem (nama perpustakaan, lama pinjam, denda).
-- ---------------------------------------------------------------------
revoke all on table public.anggota           from anon;
revoke all on table public.profiles          from anon;
revoke all on table public.peminjaman        from anon;
revoke all on table public.log_aktivitas     from anon;
revoke all on table public.buku              from anon;
revoke all on table public.kebijakan_akses   from anon;
revoke all on table public.pengaturan_sistem from anon;
revoke all on all sequences in schema public from anon;

grant select on table public.buku              to anon;
grant select on table public.kebijakan_akses   to anon;
grant select on table public.pengaturan_sistem to anon;

-- ---------------------------------------------------------------------
-- authenticated (sesi login): hak tabel diberikan, batas nyata dijalankan
-- oleh kebijakan RLS di 0003 (peran + kepemilikan + matriks izin).
-- profiles sengaja TANPA insert/delete: baris dibuat oleh pemicu
-- saat_akun_dibuat() dan dihapus lewat Supabase Auth di sisi server.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on table public.buku              to authenticated;
grant select, insert, update, delete on table public.anggota           to authenticated;
grant select, insert, update, delete on table public.peminjaman        to authenticated;
grant select,                                   update on table public.profiles          to authenticated;
grant select, insert, update, delete on table public.kebijakan_akses   to authenticated;
grant select, insert, update, delete on table public.pengaturan_sistem to authenticated;
grant select, insert,               delete on table public.log_aktivitas to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------
-- Fungsi transaksi sirkulasi: HANYA sesi login.
-- CATATAN: PostgreSQL selalu memberi EXECUTE ke PUBLIC secara bawaan,
-- jadi revoke harus menyebut PUBLIC juga — revoke dari `anon` saja tidak
-- cukup (public = grup induk seluruh peran).
-- ---------------------------------------------------------------------
revoke execute on function public.pinjam_buku(uuid, uuid, date)     from public, anon;
revoke execute on function public.kembalikan_buku(uuid)             from public, anon;
revoke execute on function public.perpanjang_buku(uuid, integer)    from public, anon;

grant execute on function public.pinjam_buku(uuid, uuid, date)      to authenticated, service_role;
grant execute on function public.kembalikan_buku(uuid)              to authenticated, service_role;
grant execute on function public.perpanjang_buku(uuid, integer)     to authenticated, service_role;

-- Fungsi pembantu yang DIPAKAI DI DALAM kebijakan RLS (boleh/app_peran/
-- is_admin/jwt_peran) harus tetap bisa dieksekusi oleh peran yang menjalankan
-- query, andai tidak begitu seluruh SELECT akan gagal. Sengaja tidak di-revoke.
-- Fungsi pemicu (waktu_ubah, saat_akun_dibuat, jaga_*) dijalankan sebagai
-- pemilik fungsi (SECURITY DEFINER / owner tabel) sehingga tidak membutuhkan
-- grant untuk peran API.

-- =====================================================================
-- VERIFIKASI (jalankan setelah file ini, hasilnya harus seperti keterangan)
-- =====================================================================
-- select grantee, table_name, privilege_type
--   from information_schema.table_privileges
--  where table_schema = 'public' and grantee in ('anon', 'authenticated')
--  order by table_name, grantee, privilege_type;
--
-- select has_table_privilege('anon', 'public.buku', 'select')        as anon_buku;
-- select has_table_privilege('anon', 'public.anggota', 'select')     as anon_anggota;   -- false
-- select has_function_privilege('anon', 'public.pinjam_buku(uuid,uuid,date)', 'execute') as anon_rpc; -- false
