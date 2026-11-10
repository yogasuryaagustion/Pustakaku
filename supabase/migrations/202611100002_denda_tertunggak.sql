-- Denda tertunggak sebagai syarat peminjaman berikutnya.
--
-- Sebelumnya denda hanya dicatat sebagai angka pada satu peminjaman dan tidak
-- pernah "dibayar" di sistem, sehingga tidak ada dasar untuk menolak pinjaman
-- baru milik anggota yang masih berutang.
--
-- Migrasi ini:
--   1. menambah `peminjaman.denda_dibayar` + `denda_dibayar_pada` (pembayaran
--      penuh; kolomnya berupa nominal agar cicilan bisa ditambahkan nanti
--      tanpa mengubah skema);
--   2. menambah fungsi `lunasi_denda` untuk petugas;
--   3. menolak `pinjam_buku` bila anggota masih punya sisa denda;
--   4. menambah jenis jejak `denda` agar pelunasan tercatat di log aktivitas.

alter table public.peminjaman
  add column if not exists denda_dibayar integer not null default 0,
  add column if not exists denda_dibayar_pada timestamptz;

-- Nominal bayar tidak boleh negatif atau melebihi denda yang tercatat.
alter table public.peminjaman
  drop constraint if exists peminjaman_denda_dibayar_wajar;
alter table public.peminjaman
  add constraint peminjaman_denda_dibayar_wajar
  check (denda_dibayar >= 0 and denda_dibayar <= denda);

-- ---------------------------------------------------------------------
-- Jenis jejak baru: 'denda'. Nama constraint check bawaan tidak dijamin,
-- jadi dicari lewat katalog lalu dibuat ulang dengan daftar yang lengkap.
do $$
declare
  v_nama text;
begin
  select c.conname into v_nama
    from pg_constraint c
   where c.conrelid = 'public.log_aktivitas'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%jenis%'
   limit 1;

  if v_nama is not null then
    execute format('alter table public.log_aktivitas drop constraint %I', v_nama);
  end if;

  alter table public.log_aktivitas
    add constraint log_aktivitas_jenis_check
    check (jenis in ('masuk', 'pinjam', 'kembali', 'perpanjang',
                     'buku', 'anggota', 'akun', 'sistem', 'denda'));
end;
$$;

-- ---------------------------------------------------------------------
create or replace function public.lunasi_denda(p_peminjaman_id uuid)
returns jsonb
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
  -- Denda baru pasti setelah buku kembali: nominalnya dihitung saat itu.
  if v_p.tanggal_kembali_aktual is null then
    raise exception 'Peminjaman % belum dikembalikan — belum ada denda yang harus dibayar.',
      v_p.kode_pinjam;
  end if;

  v_sisa := v_p.denda - v_p.denda_dibayar;
  if v_sisa <= 0 then
    raise exception 'Denda peminjaman % sudah lunas.', v_p.kode_pinjam;
  end if;

  update public.peminjaman
     set denda_dibayar = denda,
         denda_dibayar_pada = now(),
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
     'denda', 'Denda dilunasi', coalesce(v_judul, v_p.kode_pinjam),
     -- Pemisah ribuan mengikuti locale database; diseragamkan ke titik.
     format('%s · Rp%s · %s', coalesce(v_nama, '-'),
            replace(to_char(v_sisa::numeric, 'FM999G999G999'), ',', '.'),
            v_p.kode_pinjam));

  return to_jsonb(v_p);
end;
$$;

revoke execute on function public.lunasi_denda(uuid) from public, anon;
grant execute on function public.lunasi_denda(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- `pinjam_buku` kini juga menolak anggota yang masih berutang denda.
drop function if exists public.pinjam_buku(uuid, uuid, date, integer);

create or replace function public.pinjam_buku(
  p_buku_id uuid,
  p_anggota_id uuid,
  p_tanggal_pinjam date default null,
  p_lama_hari integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tgl        date := coalesce(p_tanggal_pinjam, current_date);
  v_lama       integer;
  v_buku       public.buku%rowtype;
  v_anggota    public.anggota%rowtype;
  v_sistem     public.pengaturan_sistem%rowtype;
  v_dipinjam   integer;
  v_aktif      integer;
  v_tertunggak integer;
  v_coba       integer := 0;
  v_kode       text;
  v_baru       public.peminjaman%rowtype;
  v_uid        uuid := auth.uid();
  v_aktor      text;
  v_peran      text;
  v_eksemplar  public.eksemplar_buku%rowtype;
  v_punya_eks  integer;
  v_nomor      text;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not (public.boleh('katalog.pinjam') or public.boleh('sirkulasi.kelola')) then
    raise exception 'Anda tidak memiliki izin untuk mengajukan peminjaman.';
  end if;
  if v_tgl > current_date + 365 or v_tgl < current_date - 365 then
    raise exception 'Tanggal pinjam di luar rentang yang wajar (±1 tahun).';
  end if;
  if p_lama_hari is not null and (p_lama_hari < 1 or p_lama_hari > 90) then
    raise exception 'Lama pinjam harus antara 1 dan 90 hari.';
  end if;

  select * into v_buku from public.buku where id = p_buku_id for update;
  if not found then
    raise exception 'Buku tidak ditemukan.';
  end if;

  select * into v_anggota from public.anggota where id = p_anggota_id for update;
  if not found then
    raise exception 'Anggota tidak ditemukan.';
  end if;
  if not v_anggota.aktif then
    raise exception 'Anggota % tidak aktif.', v_anggota.nama;
  end if;

  -- Sanksi: denda yang belum dilunasi menahan peminjaman berikutnya.
  select coalesce(sum(p.denda - p.denda_dibayar), 0) into v_tertunggak
    from public.peminjaman p
   where p.anggota_id = p_anggota_id
     and p.denda > p.denda_dibayar;
  if v_tertunggak > 0 then
    raise exception 'Anggota % masih memiliki denda tertunggak Rp%. Lunasi denda terlebih dahulu.',
      v_anggota.nama,
      replace(to_char(v_tertunggak::numeric, 'FM999G999G999'), ',', '.');
  end if;

  select * into v_sistem from public.pengaturan_sistem where id;
  if not found then
    raise exception 'Pengaturan sistem belum diisi — jalankan migrasi 0002.';
  end if;

  v_lama := coalesce(p_lama_hari, v_sistem.lama_pinjam);

  select e.* into v_eksemplar
    from public.eksemplar_buku e
   where e.buku_id = p_buku_id
     and e.status = 'tersedia'
     and e.kondisi_fisik <> 'hilang'
   order by e.nomor_inventaris
   for update skip locked
   limit 1;

  select count(*) into v_punya_eks
    from public.eksemplar_buku e
   where e.buku_id = p_buku_id;

  if v_punya_eks > 0 then
    if v_eksemplar.id is null then
      raise exception 'Semua eksemplar "%" sedang dipinjam atau tidak tersedia.', v_buku.judul;
    end if;
  else
    select count(*) into v_dipinjam
      from public.peminjaman
     where buku_id = p_buku_id and status = 'Dipinjam';
    if v_buku.stok - v_dipinjam <= 0 then
      raise exception 'Stok "%" habis.', v_buku.judul;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pinjam:' || p_anggota_id::text, 0));
  select count(*) into v_aktif
    from public.peminjaman
   where anggota_id = p_anggota_id and status = 'Dipinjam';
  if v_aktif >= v_sistem.maks_pinjaman then
    raise exception 'Batas maksimal % buku sedang dipinjam. Kembalikan salah satu dulu.',
      v_sistem.maks_pinjaman;
  end if;

  if v_eksemplar.id is not null then
    update public.eksemplar_buku
       set status = 'dipinjam',
           diedit_pada = now()
     where id = v_eksemplar.id;
    v_nomor := v_eksemplar.nomor_inventaris;
  end if;

  while v_coba < 10 loop
    v_coba := v_coba + 1;
    v_kode := 'PIN-' || lpad(nextval('public.kode_pinjam_seq')::text, 4, '0');
    begin
      insert into public.peminjaman
        (kode_pinjam, buku_id, anggota_id, eksemplar_id,
         tanggal_pinjam, tanggal_kembali, status)
      values
        (v_kode, p_buku_id, p_anggota_id, v_eksemplar.id,
         v_tgl, v_tgl + v_lama, 'Dipinjam')
      returning * into v_baru;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  if v_baru.id is null then
    raise exception 'Gagal membuat kode pinjam baru.';
  end if;

  select p.nama, p.peran into v_aktor, v_peran
    from public.profiles p where p.id = v_uid;

  insert into public.log_aktivitas
    (aktor_id, anggota_id, aktor, peran, jenis, aksi, objek, detail)
  values
    (v_uid, p_anggota_id, coalesce(v_aktor, 'Anggota'), coalesce(v_peran, 'user'),
     'pinjam', 'Peminjaman dicatat', v_buku.judul,
     format('%s · jatuh tempo %s%s%s', v_anggota.nama, v_baru.tanggal_kembali,
            case when p_lama_hari is null then '' else ' · lama ' || v_lama || ' hari' end,
            case when v_nomor is null then '' else ' · inv ' || v_nomor end));

  return to_jsonb(v_baru) || jsonb_build_object('nomor_inventaris', v_nomor);
end;
$$;

revoke execute on function public.pinjam_buku(uuid, uuid, date, integer) from public, anon;
grant execute on function public.pinjam_buku(uuid, uuid, date, integer)
  to authenticated, service_role;
