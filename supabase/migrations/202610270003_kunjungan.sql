-- =====================================================================
-- PustakaKu — 0009 Check-in Kunjungan (tabel kunjungan + RPC catat_kunjungan)
--
-- Fitur: kios check-in di komputer perpustakaan (POST /api/kunjungan) dan
-- rekap kunjungan di /laporan (GET /api/kunjungan, izin laporan.lihat).
--
-- Keputusan desain (disepakati saat perencanaan):
--   * KIOS PUBLIK: check-in tidak menuntut sesi login — siapa pun yang
--     membuka komputer perpustakaan bisa mencatat kunjungan dengan nomor
--     anggota. Fungsi karena itu dieksekusi oleh `anon`.
--   * REKAP TERBATAS: hanya pihak berwenang (admin, `is_admin()`) yang boleh
--     MEMBACA tabel. `anon` TIDAK mendapat GRANT apa pun, dan tidak ada
--     kebijakan INSERT/UPDATE/DELETE — tulis hanya lewat fungsi di bawah.
--
-- Kebijakan tabel `anggota`/`peminjaman` (permissive, TO PUBLIC, migrasi 0003)
-- TIDAK disalin ke sini: tabel kunjungan dirancang default-deny dari nol.
--
-- Jalankan lewat Supabase SQL Editor (urut setelah 0008) atau
-- `supabase db push`. Idempoten: create table if not exists + create or
-- replace function + create policy (drop if exists).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabel kunjungan — satu baris per anggota per hari.
--    `tanggal_kunjungan` dihitung di zona Asia/Jakarta sehingga pergantian
--    hari mengikuti waktu perpustakaan, bukan UTC.
-- ---------------------------------------------------------------------
create table if not exists public.kunjungan (
  id               uuid primary key default gen_random_uuid(),
  anggota_id       uuid not null references public.anggota (id) on delete cascade,
  tanggal_kunjungan date not null default ((now() at time zone 'asia/jakarta')::date),
  waktu_masuk      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- Satu anggota hanya sekali per hari. Unique index INI juga yang menjadi
-- target `ON CONFLICT` pada fungsi check-in.
create unique index if not exists kunjungan_anggota_hari_unik
  on public.kunjungan (anggota_id, tanggal_kunjungan);

create index if not exists kunjungan_tanggal_idx
  on public.kunjungan (tanggal_kunjungan desc, waktu_masuk desc);

-- ---------------------------------------------------------------------
-- 2. RLS: default-deny.
--    * SELECT hanya untuk admin (rekap di /laporan).
--    * Tanpa kebijakan INSERT/UPDATE/DELETE → DML langsung selalu ditolak,
--      termasuk untuk `authenticated`. Satu-satunya jalur tulis adalah
--      fungsi SECURITY DEFINER di bawah (pola yang sama dengan 0004).
-- ---------------------------------------------------------------------
alter table public.kunjungan enable row level security;

drop policy if exists kunjungan_lihat on public.kunjungan;
create policy kunjungan_lihat on public.kunjungan
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. GRANT — seminimal mungkin; `anon` sengaja TIDAK mendapat apa pun.
--    (service_role perlu disebut eksplisit: GRANT "on all tables" di 0005
--    hanya menjangkau tabel yang sudah ada saat itu.)
-- ---------------------------------------------------------------------
grant select                       on table public.kunjungan to authenticated;
grant select, insert, update, delete on table public.kunjungan to service_role;

-- ---------------------------------------------------------------------
-- 4. Fungsi check-in: validasi anggota → tolak nomor tak dikenal/nonaktif →
--    catat kunjungan hari ini (Asia/Jakarta) → tangani check-in ganda.
--    Mengembalikan hanya data minimum (status, nama, nomor, tanggal, waktu).
-- ---------------------------------------------------------------------
create or replace function public.catat_kunjungan(p_nomor text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_nomor   text := trim(coalesce(p_nomor, ''));
  v_anggota public.anggota%rowtype;
  v_tgl     date := (now() at time zone 'asia/jakarta')::date;
  v_kunj    public.kunjungan%rowtype;
begin
  if v_nomor = '' then
    raise exception 'Nomor anggota wajib diisi.';
  end if;
  if char_length(v_nomor) > 30 or v_nomor !~ '^[A-Za-z0-9 ./_-]+$' then
    raise exception 'Format nomor anggota tidak valid.';
  end if;

  -- Pencocokan tidak peka huruf besar/kecil (kartu cetak sering huruf kecil).
  select * into v_anggota from public.anggota
   where upper(nomor_anggota) = upper(v_nomor);
  if not found then
    raise exception 'Nomor anggota tidak terdaftar. Periksa kartu Anda atau hubungi petugas.';
  end if;
  if not v_anggota.aktif then
    raise exception 'Kartu anggota % berstatus tidak aktif. Silakan hubungi petugas.',
      v_anggota.nomor_anggota;
  end if;

  -- Check-in ganda pada hari yang sama: ditolak oleh unique index, lalu
  -- dikembalikan sebagai status "sudah-tercatat" (bukan galat).
  insert into public.kunjungan (anggota_id, tanggal_kunjungan, waktu_masuk)
  values (v_anggota.id, v_tgl, now())
  on conflict (anggota_id, tanggal_kunjungan) do nothing
  returning * into v_kunj;

  if v_kunj.id is null then
    select * into v_kunj from public.kunjungan
     where anggota_id = v_anggota.id and tanggal_kunjungan = v_tgl;

    return jsonb_build_object(
      'status',        'sudah-tercatat',
      'nama',          v_anggota.nama,
      'nomor_anggota', v_anggota.nomor_anggota,
      'tanggal',       to_char(v_tgl, 'YYYY-MM-DD'),
      'waktu_masuk',   v_kunj.waktu_masuk
    );
  end if;

  return jsonb_build_object(
    'status',        'baru',
    'nama',          v_anggota.nama,
    'nomor_anggota', v_anggota.nomor_anggota,
    'tanggal',       to_char(v_tgl, 'YYYY-MM-DD'),
    'waktu_masuk',   v_kunj.waktu_masuk
  );
end;
$$;

comment on function public.catat_kunjungan(text) is
  'Check-in kunjungan kios publik: validasi nomor anggota, tolak yang tidak terdaftar/nonaktif, catat sekali per hari (Asia/Jakarta).';

-- Hak eksekusi: kios publik memanggil sebagai `anon`; tanpa GRANT ini
-- PostgREST menolak (42501) — bukan RLS yang menolak.
revoke execute on function public.catat_kunjungan(text) from public;
grant  execute on function public.catat_kunjungan(text) to anon, authenticated, service_role;

-- =====================================================================
-- VERIFIKASI (jalankan setelah file ini; hasilnya harus seperti keterangan)
-- =====================================================================
-- -- anon TIDAK bisa membaca tabel, TETAPI bisa menjalankan fungsi check-in:
-- select has_table_privilege('anon', 'public.kunjungan', 'select')      as anon_baca;    -- false
-- select has_function_privilege('anon', 'public.catat_kunjungan(text)', 'execute') as anon_cek; -- true
--
-- -- Tidak ada kebijakan DML selain SELECT admin:
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'kunjungan';   -- kunjungan_lihat | select
--
-- -- Uji fungsional (peran anon, contoh nomor anggota yang valid):
-- set request.jwt.claims to '{"role":"anon"}';
-- set role anon;
-- select public.catat_kunjungan('AGT-0001');  -- {status: baru}
-- select public.catat_kunjungan('AGT-0001');  -- {status: sudah-tercatat}
-- select public.catat_kunjungan('TIDAK-ADA'); -- galat: tidak terdaftar
-- select count(*) from public.kunjungan;      -- tetap 0 baris terlihat (RLS)
-- reset role;
-- -- hapus baris uji bila diperlukan:
-- delete from public.kunjungan where anggota_id = (select id from public.anggota where nomor_anggota = 'AGT-0001');