-- =====================================================================
-- PustakaKu — 0001 Skema
-- Jalankan lewat Supabase SQL Editor (urut: 0001 → 0004) atau
-- `supabase db push`. Berkas ini TIDAK menyentuh data lama mana pun.
--
-- Catatan audit (Tahap 1) yang membentuk skema ini:
--   * 1 baris peminjaman = 1 buku (model aplikasi saat ini), sehingga
--     TIDAK dibuat tabel detail_peminjaman (tidak ada transaksi multi-buku).
--   * Data pengembalian (tanggal aktual, status, denda) pada aplikasi tersimpan
--     sebagai kolom di `peminjaman`, sehingga TIDAK dibuat tabel terpisah
--     `pengembalian` agar tidak ada struktur ganda.
--   * `buku.stok` = jumlah eksemplar; ketersediaan = stok − peminjaman aktif
--     (aturan yang berlaku di UI sekarang), divalidasi atomik di fungsi RPC.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. anggota — kartu anggota perpustakaan
-- ---------------------------------------------------------------------
create table public.anggota (
  id             uuid primary key default gen_random_uuid(),
  nomor_anggota  text        not null,
  nama           text        not null check (char_length(trim(nama)) between 3 and 120),
  email          text        not null default '',
  telepon        text        not null default '',
  alamat         text        not null default '',
  jenis          text        not null default 'Umum'
                             check (jenis in ('Pelajar', 'Umum', 'Staf')),
  bergabung_pada date        not null default current_date,
  aktif          boolean     not null default true,
  -- foto profil berupa data URL thumbnail 256px (lihat src/lib/foto.ts)
  foto           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index anggota_nomor_unik on public.anggota (nomor_anggota);
create unique index anggota_email_unik on public.anggota (lower(email)) where email <> '';
create        index anggota_nama_idx    on public.anggota (lower(nama));
create        index anggota_aktif_idx   on public.anggota (aktif);

-- Nomor anggota otomatis AGT-0001 (sekuens dipakai fungsi & impor).
create sequence public.nomor_anggota_seq start 1;

-- ---------------------------------------------------------------------
-- 2. profiles — profil akun login, terhubung ke auth.users (Supabase Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nama        text    not null check (char_length(trim(nama)) between 3 and 120),
  email       text    not null,
  peran       text    not null default 'user' check (peran in ('admin', 'user')),
  anggota_id  uuid    references public.anggota (id) on delete set null,
  dibuat_pada date    not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index profiles_email_unik on public.profiles (lower(email));
create        index profiles_anggota_idx on public.profiles (anggota_id);
create        index profiles_peran_idx   on public.profiles (peran);

-- ---------------------------------------------------------------------
-- 3. buku — katalog
-- ---------------------------------------------------------------------
create table public.buku (
  id               uuid primary key default gen_random_uuid(),
  judul            text    not null check (char_length(trim(judul)) between 1 and 300),
  penulis          text    not null default '',
  penerbit         text    not null default '',
  tahun            integer not null default 2020 check (tahun between 1000 and 2100),
  isbn             text    not null default '',
  kategori         text    not null default 'Lainnya'
                           check (kategori in ('Fiksi', 'Non-Fiksi', 'Sains', 'Sejarah',
                                               'Teknologi', 'Anak', 'Agama', 'Lainnya')),
  rak              text    not null default '',
  -- jumlah eksemplar milik perpustakaan; TIDAK pernah turun saat dipinjam
  -- (ketersediaan = stok − peminjaman berstatus 'Dipinjam').
  stok             integer not null default 0 check (stok >= 0),
  deskripsi        text    not null default '',
  gambar           text,
  ditambahkan_pada date    not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index buku_judul_idx    on public.buku (lower(judul));
create index buku_kategori_idx on public.buku (kategori);
create index buku_rak_idx      on public.buku (rak);
create unique index buku_isbn_unik on public.buku (lower(isbn)) where isbn <> '';

-- ---------------------------------------------------------------------
-- 4. peminjaman — transaksi pinjam + hasil pengembalian
--    status 'Dipinjam'  ↔ tanggal_kembali_aktual IS NULL
--    status 'Dikembalikan'/'Terlambat' ↔ tanggal_kembali_aktual IS NOT NULL
-- ---------------------------------------------------------------------
create table public.peminjaman (
  id                    uuid primary key default gen_random_uuid(),
  kode_pinjam           text    not null,
  buku_id               uuid    not null references public.buku (id)    on delete restrict,
  anggota_id            uuid    not null references public.anggota (id) on delete restrict,
  tanggal_pinjam        date    not null default current_date,
  tanggal_kembali       date    not null,           -- jatuh tempo
  tanggal_kembali_aktual date,
  status                text    not null default 'Dipinjam'
                                check (status in ('Dipinjam', 'Dikembalikan', 'Terlambat')),
  denda                 integer not null default 0 check (denda >= 0),
  catatan               text    not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint peminjaman_status_kembali check (
    (status = 'Dipinjam') = (tanggal_kembali_aktual is null)
  ),
  constraint peminjaman_tempo_wajar check (tanggal_kembali >= tanggal_pinjam)
);

create unique index peminjaman_kode_unik    on public.peminjaman (kode_pinjam);
create        index peminjaman_buku_idx      on public.peminjaman (buku_id);
create        index peminjaman_anggota_idx   on public.peminjaman (anggota_id);
create        index peminjaman_status_idx    on public.peminjaman (status);
create        index peminjaman_telat_idx     on public.peminjaman (tanggal_kembali)
                                              where status = 'Dipinjam';
create        index peminjaman_pinjam_idx    on public.peminjaman (tanggal_pinjam desc);

create sequence public.kode_pinjam_seq start 1;

-- ---------------------------------------------------------------------
-- 5. kebijakan_akses — matriks RBAC (baris tunggal)
--    Isi kolom `izin` identik dengan Kebijakan.izin di src/lib/izin.ts.
-- ---------------------------------------------------------------------
create table public.kebijakan_akses (
  id          boolean primary key default true check (id),
  versi       integer     not null default 1,
  izin        jsonb       not null default '{}'::jsonb,
  diubah_pada timestamptz,
  diubah_oleh text
);

-- ---------------------------------------------------------------------
-- 6. pengaturan_sistem — konfigurasi sistem (baris tunggal)
-- ---------------------------------------------------------------------
create table public.pengaturan_sistem (
  id            boolean primary key default true check (id),
  nama          text    not null default 'PustakaKu',
  tagline       text    not null default 'Sistem Perpustakaan',
  lama_pinjam   integer not null default 14 check (lama_pinjam between 1 and 90),
  denda_per_hari integer not null default 2000 check (denda_per_hari between 0 and 1000000),
  maks_pinjaman integer not null default 5   check (maks_pinjaman between 1 and 50),
  diubah_pada   timestamptz,
  diubah_oleh   text
);

-- ---------------------------------------------------------------------
-- 7. log_aktivitas — jejak audit
--    aktor_id  : akun yang melakukan aksi (dibaca dari sesi di server)
--    anggota_id: kartu anggota yang terdampak (untuk feed panel anggota)
-- ---------------------------------------------------------------------
create table public.log_aktivitas (
  id          uuid primary key default gen_random_uuid(),
  waktu       timestamptz not null default now(),
  aktor_id    uuid    references auth.users (id)  on delete set null,
  anggota_id  uuid    references public.anggota (id) on delete set null,
  aktor       text    not null default 'Sistem',
  peran       text    not null default '-',
  jenis       text    not null
                      check (jenis in ('masuk', 'pinjam', 'kembali', 'perpanjang',
                                       'buku', 'anggota', 'akun', 'sistem')),
  aksi        text    not null check (char_length(aksi) between 1 and 200),
  objek       text    not null default '',
  detail      text
);

create index log_waktu_idx   on public.log_aktivitas (waktu desc);
create index log_jenis_idx   on public.log_aktivitas (jenis, waktu desc);
create index log_aktor_idx   on public.log_aktivitas (aktor_id, waktu desc);
create index log_anggota_idx on public.log_aktivitas (anggota_id, waktu desc);

-- ---------------------------------------------------------------------
-- Fungsi pembantu peran (dipakai pemicu, kebijakan RLS, dan fungsi RPC)
-- ---------------------------------------------------------------------
-- Peran pada token JWT permintaan berjalan:
--   'superuser'   = bukan lewat API (SQL Editor / migrasi) → boleh apa pun
--   'service_role'= kunci server (hanya dipakai di route handler)
--   'authenticated'/'anon' = klien API
create or replace function public.jwt_peran() returns text
language sql stable as $$
  select case
    when current_setting('request.jwt.claims', true) is null then 'superuser'
    else coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      'anon'
    )
  end;
$$;

-- Peran aplikasi akun yang sedang masuk ('tamu' bila tanpa sesi).
create or replace function public.app_peran() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.peran from public.profiles p where p.id = auth.uid()),
    'tamu'
  );
$$;

-- Admin = peran 'admin' pada profil ATAU kunci service role / SQL Editor.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.jwt_peran() in ('superuser', 'service_role')
      or public.app_peran() = 'admin';
$$;

-- ---------------------------------------------------------------------
-- Pemicu: updated_at + pembuatan profil otomatis saat akun dibuat
-- ---------------------------------------------------------------------
create or replace function public.waktu_ubah() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_anggota_ubah before update on public.anggota
  for each row execute function public.waktu_ubah();
create trigger trg_buku_ubah before update on public.buku
  for each row execute function public.waktu_ubah();
create trigger trg_peminjaman_ubah before update on public.peminjaman
  for each row execute function public.waktu_ubah();
create trigger trg_profiles_ubah before update on public.profiles
  for each row execute function public.waktu_ubah();

-- Profil dibuat otomatis oleh Supabase Auth.
-- PERAN SELALU 'user' di sini: peran tidak pernah diambil dari metadata
-- yang dikirim klien (mencegah peningkatan hak lewat panggilan signUp langsung).
-- Admin ditetapkan lewat service role dari server (/api/akun).
create or replace function public.saat_akun_dibuat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nama text := trim(coalesce(new.raw_user_meta_data ->> 'nama', ''));
begin
  insert into public.profiles (id, nama, email, peran)
  values (
    new.id,
    nullif(v_nama, ''),
    new.email,
    'user'
  )
  on conflict (id) do nothing;

  if new.email is not null then
    update public.profiles
       set email = new.email
     where id = new.id and lower(email) <> lower(new.email);
  end if;
  return new;
end;
$$;

create trigger trg_auth_daftar after insert on auth.users
  for each row execute function public.saat_akun_dibuat();

-- Peran & tautan kartu anggota hanya boleh diubah admin (ditegakkan di DB,
-- bukan hanya di route handler).
create or replace function public.jaga_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Hanya sesi login lewat API yang dibatasi; SQL Editor & service role lewat.
  if tg_op = 'UPDATE' and public.jwt_peran() = 'authenticated'
     and public.app_peran() <> 'admin' then
    -- Peningkatan hak diri sendiri dicegah di tingkat database.
    new.peran      := old.peran;
    new.anggota_id := old.anggota_id;
  end if;
  return new;
end;
$$;

create trigger trg_jaga_profil before insert or update on public.profiles
  for each row execute function public.jaga_profil();

-- Anggota non-admin tidak boleh mengubah nomor kartu, status, jenis, atau
-- tanggal bergabung miliknya sendiri (hanya data kontak & foto).
create or replace function public.jaga_anggota() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.jwt_peran() = 'authenticated'
     and public.app_peran() <> 'admin' then
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

create trigger trg_jaga_anggota before insert or update on public.anggota
  for each row execute function public.jaga_anggota();
