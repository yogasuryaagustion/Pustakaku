-- ---------------------------------------------------------------------
-- Pengembalian diusulkan anggota, divalidasi petugas.
--
-- Selama ini hanya petugas dengan izin `sirkulasi.kelola` yang bisa menutup
-- pinjaman, padahal tombol "Kembalikan" sudah tampil di panel anggota dan
-- selalu ditolak server. Migrasi ini menambah lapisan pengajuan:
--   1. anggota mengajukan pengembalian untuk pinjamannya sendiri;
--   2. petugas memeriksa buku lalu memilih kondisi "layak" atau "rusak_ringan";
--   3. penutupan pinjaman tetap memakai `kembalikan_buku()` yang sudah ada.
-- Alur petugas lama (Proses Kembali langsung di /sirkulasi) tidak berubah.
-- ---------------------------------------------------------------------

create table if not exists public.pengembalian_ajuan (
  id uuid primary key default gen_random_uuid(),
  peminjaman_id uuid not null references public.peminjaman (id) on delete cascade,
  anggota_id uuid not null references public.anggota (id) on delete cascade,
  diajukan_oleh uuid references auth.users (id) on delete set null,
  catatan text,
  status text not null default 'menunggu'
    check (status in ('menunggu', 'disetujui', 'ditolak')),
  kondisi_divalidasi text
    check (kondisi_divalidasi in ('layak', 'rusak_ringan')),
  diproses_oleh uuid references auth.users (id) on delete set null,
  diproses_pada timestamptz,
  dibuat_pada timestamptz not null default now()
);

-- Satu pinjaman hanya boleh punya satu pengajuan yang menunggu.
create unique index if not exists pengembalian_ajuan_menunggu_uniq
  on public.pengembalian_ajuan (peminjaman_id)
  where status = 'menunggu';

create index if not exists pengembalian_ajuan_status_idx
  on public.pengembalian_ajuan (status, dibuat_pada desc);

alter table public.pengembalian_ajuan enable row level security;

-- Petugas melihat semua pengajuan; anggota hanya pengajuannya sendiri.
drop policy if exists pengembalian_ajuan_lihat on public.pengembalian_ajuan;
create policy pengembalian_ajuan_lihat on public.pengembalian_ajuan
  for select to authenticated
  using (
    public.boleh('sirkulasi.lihat')
    or public.boleh('sirkulasi.kelola')
    or (public.boleh('panel.pinjaman') and anggota_id = public.kartu_saya())
  );

revoke all on public.pengembalian_ajuan from anon;
grant select on public.pengembalian_ajuan to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Anggota mengajukan pengembalian
-- ---------------------------------------------------------------------
create or replace function public.ajukan_kembali(
  p_peminjaman_id uuid,
  p_catatan text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p      public.peminjaman%rowtype;
  v_uid    uuid := auth.uid();
  v_kartu  uuid;
  v_id     uuid;
  v_judul  text;
  v_nama   text;
  v_aktor  text;
  v_peran  text;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if not found then
    raise exception 'Peminjaman tidak ditemukan.';
  end if;
  if v_p.tanggal_kembali_aktual is not null or v_p.status <> 'Dipinjam' then
    raise exception 'Pinjaman % tidak sedang aktif.', v_p.kode_pinjam;
  end if;

  -- Anggota hanya boleh mengajukan pinjamannya sendiri; petugas boleh mewakili.
  v_kartu := public.kartu_saya();
  if not public.boleh('sirkulasi.kelola')
     and (v_kartu is null or v_kartu <> v_p.anggota_id) then
    raise exception 'Anda hanya bisa mengajukan pengembalian untuk pinjaman Anda sendiri.';
  end if;

  if exists (
    select 1 from public.pengembalian_ajuan
     where peminjaman_id = p_peminjaman_id and status = 'menunggu'
  ) then
    raise exception 'Pengembalian % sudah diajukan dan menunggu pemeriksaan petugas.',
      v_p.kode_pinjam;
  end if;

  insert into public.pengembalian_ajuan (peminjaman_id, anggota_id, diajukan_oleh, catatan)
  values (
    p_peminjaman_id,
    v_p.anggota_id,
    v_uid,
    nullif(btrim(coalesce(p_catatan, '')), '')
  )
  returning id into v_id;

  select b.judul into v_judul from public.buku b where b.id = v_p.buku_id;
  select a.nama into v_nama from public.anggota a where a.id = v_p.anggota_id;
  select p.nama, p.peran into v_aktor, v_peran
    from public.profiles p where p.id = v_uid;

  insert into public.log_aktivitas
    (aktor_id, anggota_id, aktor, peran, jenis, aksi, objek, detail)
  values
    (v_uid, v_p.anggota_id, coalesce(v_aktor, 'Anggota'), coalesce(v_peran, 'user'),
     'kembali', 'Pengembalian diajukan', coalesce(v_judul, v_p.kode_pinjam),
     format('%s · menunggu pemeriksaan kondisi oleh petugas', coalesce(v_nama, '')));

  return jsonb_build_object('id', v_id, 'status', 'menunggu');
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Petugas memvalidasi kondisi lalu menutup pinjaman
-- ---------------------------------------------------------------------
create or replace function public.verifikasi_kembali(
  p_peminjaman_id uuid,
  p_kondisi_fisik text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_hasil jsonb;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('sirkulasi.kelola') then
    raise exception 'Anda tidak memiliki izin untuk memvalidasi pengembalian.';
  end if;
  if p_kondisi_fisik is null or p_kondisi_fisik not in ('layak', 'rusak_ringan') then
    raise exception 'Kondisi buku harus "layak" atau "rusak_ringan".';
  end if;
  if not exists (
    select 1 from public.pengembalian_ajuan
     where peminjaman_id = p_peminjaman_id and status = 'menunggu'
  ) then
    raise exception 'Tidak ada pengajuan pengembalian yang menunggu untuk pinjaman ini.';
  end if;

  -- Memakai alur pengembalian yang sudah ada agar aturan denda dan status
  -- eksemplar tetap satu sumber.
  v_hasil := public.kembalikan_buku(p_peminjaman_id, p_kondisi_fisik);

  -- Trigger penutup pengajuan sudah menandai 'disetujui'; lengkapi hasil
  -- pemeriksaannya.
  update public.pengembalian_ajuan
     set kondisi_divalidasi = p_kondisi_fisik,
         diproses_oleh = v_uid,
         diproses_pada = now()
   where peminjaman_id = p_peminjaman_id
     and status = 'disetujui'
     and kondisi_divalidasi is null;

  return v_hasil;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Petugas menolak pengajuan (mis. buku belum diserahkan)
-- ---------------------------------------------------------------------
create or replace function public.tolak_kembali(
  p_peminjaman_id uuid,
  p_alasan text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('sirkulasi.kelola') then
    raise exception 'Anda tidak memiliki izin untuk menolak pengembalian.';
  end if;

  update public.pengembalian_ajuan
     set status = 'ditolak',
         catatan = coalesce(nullif(btrim(coalesce(p_alasan, '')), ''), catatan),
         diproses_oleh = v_uid,
         diproses_pada = now()
   where peminjaman_id = p_peminjaman_id
     and status = 'menunggu';

  if not found then
    raise exception 'Tidak ada pengajuan pengembalian yang menunggu untuk pinjaman ini.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Pengajuan otomatis ditutup saat pinjaman selesai (alur petugas lama)
-- ---------------------------------------------------------------------
create or replace function public.fn_tutup_ajuan_kembali()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tanggal_kembali_aktual is not null
     and old.tanggal_kembali_aktual is null then
    update public.pengembalian_ajuan
       set status = 'disetujui',
           diproses_pada = coalesce(diproses_pada, now())
     where peminjaman_id = new.id
       and status = 'menunggu';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tutup_ajuan_kembali on public.peminjaman;
create trigger trg_tutup_ajuan_kembali
  after update on public.peminjaman
  for each row execute function public.fn_tutup_ajuan_kembali();

-- ---------------------------------------------------------------------
-- 5. Hak eksekusi
-- ---------------------------------------------------------------------
revoke execute on function public.ajukan_kembali(uuid, text) from public;
revoke execute on function public.verifikasi_kembali(uuid, text) from public;
revoke execute on function public.tolak_kembali(uuid, text) from public;

grant execute on function public.ajukan_kembali(uuid, text) to authenticated, service_role;
grant execute on function public.verifikasi_kembali(uuid, text) to authenticated, service_role;
grant execute on function public.tolak_kembali(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
