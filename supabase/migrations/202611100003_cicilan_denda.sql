-- Pembayaran denda bertahap (cicilan) dengan riwayat per pinjaman.
--
-- Sebelumnya pelunasan hanya satu angka di `peminjaman.denda_dibayar`,
-- sehingga tidak ada catatan siapa membayar berapa dan kapan. Migrasi ini:
--   1. menambah tabel `pembayaran_denda` (satu baris = satu penerimaan);
--   2. menambah `bayar_denda` yang menerima nominal sebagian;
--   3. menurunkan ulang `lunasi_denda` agar memakai alur yang sama (melunasi
--      sisa sekaligus) sehingga pemanggil lama tetap bekerja.
--
-- `peminjaman.denda_dibayar` tetap menjadi TOTAL yang sudah dibayar — dipakai
-- untuk memblokir pinjaman baru. `denda_dibayar_pada` kini berarti waktu
-- denda benar-benar lunas (null selama masih ada sisa).

create table if not exists public.pembayaran_denda (
  id            uuid primary key default gen_random_uuid(),
  peminjaman_id uuid not null references public.peminjaman (id) on delete cascade,
  nominal       integer not null check (nominal > 0),
  catatan       text,
  diterima_oleh uuid references auth.users (id) on delete set null,
  dibuat_pada   timestamptz not null default now()
);

create index if not exists pembayaran_denda_pinjaman_idx
  on public.pembayaran_denda (peminjaman_id, dibuat_pada);

alter table public.pembayaran_denda enable row level security;

-- Petugas melihat semua penerimaan; anggota hanya milik pinjamannya sendiri.
drop policy if exists pembayaran_denda_lihat on public.pembayaran_denda;
create policy pembayaran_denda_lihat on public.pembayaran_denda
  for select to authenticated
  using (
    public.boleh('sirkulasi.lihat')
    or public.boleh('sirkulasi.kelola')
    or (
      public.boleh('panel.pinjaman')
      and exists (
        select 1 from public.peminjaman p
         where p.id = pembayaran_denda.peminjaman_id
           and p.anggota_id = public.kartu_saya()
      )
    )
  );

revoke all on public.pembayaran_denda from anon;
grant select on public.pembayaran_denda to authenticated, service_role;

-- Data lama: pelunasan penuh yang sudah tercatat di `denda_dibayar` dibuatkan
-- satu baris riwayat agar total dan riwayat tidak berbeda.
insert into public.pembayaran_denda
  (peminjaman_id, nominal, catatan, dibuat_pada)
select p.id, p.denda_dibayar, 'Pelunasan sebelum pencatatan cicilan',
       coalesce(p.denda_dibayar_pada, p.updated_at, now())
  from public.peminjaman p
 where p.denda_dibayar > 0
   and not exists (
     select 1 from public.pembayaran_denda b where b.peminjaman_id = p.id
   );

-- ---------------------------------------------------------------------
create or replace function public.bayar_denda(
  p_peminjaman_id uuid,
  p_nominal integer,
  p_catatan text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p       public.peminjaman%rowtype;
  v_uid     uuid := auth.uid();
  v_aktor   text;
  v_peran   text;
  v_judul   text;
  v_nama    text;
  v_sisa    integer;
  v_bayar   public.pembayaran_denda%rowtype;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('sirkulasi.kelola') then
    raise exception 'Anda tidak memiliki izin untuk menerima pembayaran denda.';
  end if;

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if not found then
    raise exception 'Peminjaman tidak ditemukan.';
  end if;
  if v_p.tanggal_kembali_aktual is null then
    raise exception 'Peminjaman % belum dikembalikan — belum ada denda yang harus dibayar.',
      v_p.kode_pinjam;
  end if;

  v_sisa := v_p.denda - v_p.denda_dibayar;
  if v_sisa <= 0 then
    raise exception 'Denda peminjaman % sudah lunas.', v_p.kode_pinjam;
  end if;
  if p_nominal is null or p_nominal < 1 then
    raise exception 'Nominal pembayaran harus lebih dari 0.';
  end if;
  if p_nominal > v_sisa then
    raise exception 'Nominal Rp% melebihi sisa denda Rp%.',
      replace(to_char(p_nominal::numeric, 'FM999G999G999'), ',', '.'),
      replace(to_char(v_sisa::numeric, 'FM999G999G999'), ',', '.');
  end if;

  insert into public.pembayaran_denda
    (peminjaman_id, nominal, catatan, diterima_oleh)
  values
    (p_peminjaman_id, p_nominal,
     nullif(btrim(coalesce(p_catatan, '')), ''), v_uid)
  returning * into v_bayar;

  update public.peminjaman
     set denda_dibayar = denda_dibayar + p_nominal,
         -- Waktu lunas hanya diisi saat sisa benar-benar habis.
         denda_dibayar_pada = case
           when denda_dibayar + p_nominal >= denda then now()
           else null
         end,
         updated_at = now()
   where id = p_peminjaman_id
  returning * into v_p;

  select b.judul into v_judul from public.buku b where b.id = v_p.buku_id;
  select a.nama  into v_nama  from public.anggota a where a.id = v_p.anggota_id;
  select p.nama, p.peran into v_aktor, v_peran
    from public.profiles p where p.id = v_uid;

  insert into public.log_aktivitas
    (aktor_id, anggota_id, aktor, peran, jenis, aksi, objek, detail)
  values
    (v_uid, v_p.anggota_id, coalesce(v_aktor, 'Petugas'), coalesce(v_peran, 'admin'),
     'denda', 'Pembayaran denda', coalesce(v_judul, v_p.kode_pinjam),
     format('%s · Rp%s · sisa Rp%s · %s', coalesce(v_nama, '-'),
            replace(to_char(p_nominal::numeric, 'FM999G999G999'), ',', '.'),
            replace(to_char((v_p.denda - v_p.denda_dibayar)::numeric, 'FM999G999G999'), ',', '.'),
            v_p.kode_pinjam));

  return jsonb_build_object(
    'peminjaman', to_jsonb(v_p),
    'pembayaran', to_jsonb(v_bayar)
  );
end;
$$;

revoke execute on function public.bayar_denda(uuid, integer, text) from public, anon;
grant execute on function public.bayar_denda(uuid, integer, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Pelunasan penuh = pembayaran sisa terakhir. Tetap dipertahankan supaya
-- tombol/klien lama tidak rusak, tetapi sekarang tercatat sebagai cicilan.
create or replace function public.lunasi_denda(p_peminjaman_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p    public.peminjaman%rowtype;
  v_sisa integer;
  v_hasil jsonb;
begin
  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if not found then
    raise exception 'Peminjaman tidak ditemukan.';
  end if;
  v_sisa := v_p.denda - v_p.denda_dibayar;

  v_hasil := public.bayar_denda(p_peminjaman_id, v_sisa, 'Pelunasan sisa denda');
  return (v_hasil -> 'peminjaman');
end;
$$;

revoke execute on function public.lunasi_denda(uuid) from public, anon;
grant execute on function public.lunasi_denda(uuid) to authenticated, service_role;
