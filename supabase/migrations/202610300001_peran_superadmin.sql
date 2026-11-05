-- =====================================================================
-- PustakaKu — 0001 Peran Super Admin
--
-- Sistem kini punya TIGA peran aplikasi (kolom profiles.peran = kunci
-- objek izin di kebijakan_akses = nilai PeranAkses di src/lib/izin.ts):
--
--   'superadmin' = Super Admin — operasional plus Kelola Akun, Kelola
--                  Akses, dan Pengaturan.
--   'admin'      = Admin — operasional: Dashboard, Katalog Buku, Sirkulasi,
--                  Data Anggota, Statistik Kunjungan, Laporan.
--   'user'       = Anggota — Beranda, Katalog, Peminjaman & Riwayat,
--                  Profil.
--
-- Yang diubah:
--   1. CHECK kolom profiles.peran menerima 'superadmin'.
--   2. is_admin() = petugas (admin ATAU superadmin) → seluruh kebijakan
--      RLS lama tetap berlaku utuh untuk kedua peran petugas.
--   3. Pemicu penjaga: HANYA Super Admin boleh mengubah kolom peran;
--      Admin & Super Admin boleh mengubah identitas kartu & tautan kartu.
--   4. Baris kebijakan_akses mendapat kunci "superadmin" dan dilengkapi
--      kunci izin yang belum ada (mis. kartu.lihat). Tanpa kunci ini
--      public.boleh() di RLS menolak SEMUA aksi Super Admin (default-deny).
--   5. Akun Admin yang sudah ada dinaikkan menjadi Super Admin supaya
--      haknya tidak berkurang; turunkan kembali lewat Kelola Akun bila
--      memang diinginkan.
--
-- Jalankan sekali: SQL Editor Supabase atau `supabase db push`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.peran — tiga nilai peran
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_peran_check;
alter table public.profiles add constraint profiles_peran_check
  check (peran in ('superadmin', 'admin', 'user'));

-- ---------------------------------------------------------------------
-- 2. is_admin() — petugas perpustakaan (penjaga kebijakan RLS)
--    Admin maupun Super Admin boleh mengelola data operasional; pemisah
--    HALAMAN sistem (akun/akses/pengaturan) dipegang API + matriks izin.
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.jwt_peran() in ('superuser', 'service_role')
      or public.app_peran() in ('superadmin', 'admin');
$$;

comment on function public.is_admin() is
  'Petugas perpustakaan: Super Admin ATAU Admin (atau kunci service role / SQL Editor).';

-- ---------------------------------------------------------------------
-- 3. jaga_profil() — menimpa definisi di 0006
--    * peran        : hanya Super Admin (anti privilege escalation);
--    * anggota_id   : petugas bebas mengaitkan kartu; anggota hanya kartu
--                     ber-email sama dan hanya sekali (aturan lama).
-- ---------------------------------------------------------------------
create or replace function public.jaga_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.jwt_peran() = 'authenticated' then
    -- Peningkatan / penurunan hak hanya lewat Super Admin.
    if new.peran is distinct from old.peran
       and public.app_peran() <> 'superadmin' then
      new.peran := old.peran;
    end if;

    -- Tautan kartu anggota.
    if new.anggota_id is distinct from old.anggota_id
       and public.app_peran() not in ('superadmin', 'admin') then
      if old.anggota_id is not null then
        new.anggota_id := old.anggota_id;                    -- sudah tertaut → kunci
      elsif new.anggota_id is not null then
        if not exists (
          select 1 from public.anggota a
           where a.id = new.anggota_id
             and a.email <> ''
             and lower(a.email) = lower(new.email)
        ) then
          new.anggota_id := old.anggota_id;                  -- email berbeda → tolak
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. jaga_anggota() — menimpa definisi di 0001: identitas kartu
--    (nomor, status, jenis, tanggal bergabung) hanya diubah petugas.
-- ---------------------------------------------------------------------
create or replace function public.jaga_anggota() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.jwt_peran() = 'authenticated'
     and public.app_peran() not in ('superadmin', 'admin') then
    -- Anggota boleh memperbarui data kontak & fotonya sendiri,
    -- tetapi bukan identitas kartu yang dikelola perpustakaan.
    new.nomor_anggota  := old.nomor_anggota;
    new.aktif          := old.aktif;
    new.jenis          := old.jenis;
    new.bergabung_pada := old.bergabung_pada;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. jaga_log() — menimpa definisi di 0003: identitas penulis jejak
--    dipaksa dari sesi HANYA untuk bukan petugas (sama seperti admin
--    sebelumnya, kini berlaku juga untuk Super Admin).
-- ---------------------------------------------------------------------
create or replace function public.jaga_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.jwt_peran() = 'authenticated'
     and public.app_peran() not in ('superadmin', 'admin') then
    select p.nama into new.aktor from public.profiles p where p.id = auth.uid();
    new.aktor_id   := auth.uid();
    new.anggota_id := (
      select p.anggota_id from public.profiles p where p.id = auth.uid()
    );
    new.peran := public.app_peran();
    new.aktor := coalesce(nullif(new.aktor, ''), 'Anggota');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. kebijakan_akses — tambah kunci "superadmin" & lengkapi izin hilang.
--    Bawaan = KEBIJAKAN_BAWAAN di src/lib/izin.ts; nilai yang sudah
--    diubah admin TETAP dipertahankan (bawaan hanya mengisi kekosongan).
-- ---------------------------------------------------------------------
do $$
declare
  d jsonb := '{
    "tamu": {
      "katalog.lihat": true,  "katalog.pinjam": false, "katalog.kelola": false,
      "panel.lihat": false,   "panel.pinjaman": false, "panel.profil": false,
      "panel.bantuan": false, "kartu.lihat": false,
      "dashboard.lihat": false, "sirkulasi.lihat": false, "sirkulasi.kelola": false,
      "anggota.lihat": false, "anggota.kelola": false,
      "laporan.lihat": false, "laporan.ekspor": false,
      "akun.daftar": true,    "akun.kelola": false,
      "pengaturan.kelola": false, "sistem.reset": false
    },
    "user": {
      "katalog.lihat": true,  "katalog.pinjam": true,  "katalog.kelola": false,
      "panel.lihat": true,    "panel.pinjaman": true,  "panel.profil": true,
      "panel.bantuan": true,  "kartu.lihat": true,
      "dashboard.lihat": false, "sirkulasi.lihat": false, "sirkulasi.kelola": false,
      "anggota.lihat": false, "anggota.kelola": false,
      "laporan.lihat": false, "laporan.ekspor": false,
      "akun.daftar": false,   "akun.kelola": false,
      "pengaturan.kelola": false, "sistem.reset": false
    },
    "admin": {
      "katalog.lihat": true,  "katalog.pinjam": false, "katalog.kelola": true,
      "panel.lihat": false,   "panel.pinjaman": false, "panel.profil": true,
      "panel.bantuan": true,  "kartu.lihat": true,
      "dashboard.lihat": true, "sirkulasi.lihat": true, "sirkulasi.kelola": true,
      "anggota.lihat": true,  "anggota.kelola": true,
      "laporan.lihat": true,  "laporan.ekspor": true,
      "akun.daftar": false,   "akun.kelola": false,
      "pengaturan.kelola": false, "sistem.reset": false
    },
    "superadmin": {
      "katalog.lihat": true,  "katalog.pinjam": false, "katalog.kelola": true,
      "panel.lihat": false,   "panel.pinjaman": false, "panel.profil": true,
      "panel.bantuan": true,  "kartu.lihat": true,
      "dashboard.lihat": true, "sirkulasi.lihat": true, "sirkulasi.kelola": true,
      "anggota.lihat": true,  "anggota.kelola": true,
      "laporan.lihat": true,  "laporan.ekspor": true,
      "akun.daftar": false,   "akun.kelola": true,
      "pengaturan.kelola": true, "sistem.reset": true
    }
  }'::jsonb;
  lama jsonb;
  baru jsonb := '{}'::jsonb;
  sistem jsonb := '{
    "tamu":       {"akun.kelola": false, "pengaturan.kelola": false, "sistem.reset": false},
    "user":       {"akun.kelola": false, "pengaturan.kelola": false, "sistem.reset": false},
    "admin":      {"akun.kelola": false, "pengaturan.kelola": false, "sistem.reset": false},
    "superadmin": {"akun.kelola": true,  "pengaturan.kelola": true,  "sistem.reset": true}
  }'::jsonb;
  k text;
begin
  select coalesce(k2.izin, '{}'::jsonb) into lama from public.kebijakan_akses k2 where k2.id;

  foreach k in array array['tamu', 'user', 'admin', 'superadmin'] loop
    -- bawaan lebih dulu, nilai tersimpan menang → kustomisasi tak hilang.
    baru := baru || jsonb_build_object(
      k, coalesce(d->k, '{}'::jsonb) || coalesce(lama->k, '{}'::jsonb)
    );
  end loop;

  -- Pengecualian: kewenangan sistem (kelola akun, pengaturan, reset) mengikuti
  -- kebijakan 3 peran ini — nilai lama "Admin = true" dari rilis sebelumnya
  -- ditimpa, bukan dipertahankan.
  foreach k in array array['tamu', 'user', 'admin', 'superadmin'] loop
    baru := baru || jsonb_build_object(
      k, coalesce(baru->k, '{}'::jsonb) || coalesce(sistem->k, '{}'::jsonb)
    );
  end loop;

  insert into public.kebijakan_akses (id, versi, izin, diubah_pada, diubah_oleh)
  values (true, 1, baru, now(), 'migrasi peran superadmin')
  on conflict (id) do update
    set izin = excluded.izin,
        diubah_pada = now(),
        diubah_oleh = 'migrasi peran superadmin';
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Akun Admin yang sudah ada dinaikkan menjadi Super Admin
--    (haknya persis seperti sebelum migrasi: dulu Admin memegang kelola
--    akun, akses, dan pengaturan). Turunkan ke 'admin' lewat SQL atau
--    buat akun Admin baru dari halaman Kelola Akun bila diperlukan.
-- ---------------------------------------------------------------------
update public.profiles
   set peran = 'superadmin',
       updated_at = now()
 where peran = 'admin';
