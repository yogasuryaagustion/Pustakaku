-- =====================================================================
-- PustakaKu — 0004 Fungsi transaksi atomik
-- Semua operasi sirkulasi (pinjam / kembali / perpanjang) dijalankan di
-- dalam SATU transaksi PostgreSQL: kunci baris, validasi izin & stok,
-- lalu tulis peminjaman + jejak aktivitas. Bila salah satu langkah gagal,
-- seluruh perubahan dibatalkan — tidak ada stok yang berubah setengah jalan.
--
-- Kunci (locking) yang dipakai:
--   * SELECT ... FOR UPDATE pada baris buku  → dua peminjaman bersamaan
--     tidak bisa melewati batas stok.
--   * pg_advisory_xact_lock per anggota      → batas maksimal pinjaman
--     per anggota tidak bisa dilewati oleh dua permintaan serentak.
-- =====================================================================

create or replace function public.pinjam_buku(
  p_buku_id uuid,
  p_anggota_id uuid,
  p_tanggal_pinjam date default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tgl      date := coalesce(p_tanggal_pinjam, current_date);
  v_buku     public.buku%rowtype;
  v_anggota  public.anggota%rowtype;
  v_sistem   public.pengaturan_sistem%rowtype;
  v_dipinjam integer;
  v_aktif    integer;
  v_coba     integer := 0;
  v_kode     text;
  v_baru     public.peminjaman%rowtype;
  v_uid      uuid := auth.uid();
  v_aktor    text;
  v_peran    text;
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

  -- Kunci baris buku: serialisasi peminjaman pada judul yang sama.
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

  select * into v_sistem from public.pengaturan_sistem where id;
  if not found then
    raise exception 'Pengaturan sistem belum diisi — jalankan migrasi 0002.';
  end if;

  -- Stok tersedia = stok − peminjaman berstatus Dipinjam.
  select count(*) into v_dipinjam
    from public.peminjaman
   where buku_id = p_buku_id and status = 'Dipinjam';
  if v_buku.stok - v_dipinjam <= 0 then
    raise exception 'Stok "%" habis.', v_buku.judul;
  end if;

  -- Batas pinjaman aktif per anggota.
  perform pg_advisory_xact_lock(hashtextextended('pinjam:' || p_anggota_id::text, 0));
  select count(*) into v_aktif
    from public.peminjaman
   where anggota_id = p_anggota_id and status = 'Dipinjam';
  if v_aktif >= v_sistem.maks_pinjaman then
    raise exception 'Batas maksimal % buku sedang dipinjam. Kembalikan salah satu dulu.',
      v_sistem.maks_pinjaman;
  end if;

  -- Kode pinjam unik; nomor berikutnya bila bentrok dengan data impor.
  while v_coba < 10 loop
    v_coba := v_coba + 1;
    v_kode := 'PIN-' || lpad(nextval('public.kode_pinjam_seq')::text, 4, '0');
    begin
      insert into public.peminjaman
        (kode_pinjam, buku_id, anggota_id, tanggal_pinjam, tanggal_kembali, status)
      values
        (v_kode, p_buku_id, p_anggota_id, v_tgl, v_tgl + v_sistem.lama_pinjam, 'Dipinjam')
      returning * into v_baru;
      exit;
    exception when unique_violation then
      null; -- nomor sudah terpakai data lama → coba nomor berikutnya
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
     format('%s · jatuh tempo %s', v_anggota.nama, v_baru.tanggal_kembali));

  return to_jsonb(v_baru);
end;
$$;

-- ---------------------------------------------------------------------
create or replace function public.kembalikan_buku(p_peminjaman_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p       public.peminjaman%rowtype;
  v_sistem  public.pengaturan_sistem%rowtype;
  v_judul   text;
  v_nama    text;
  v_telat   integer;
  v_denda   integer;
  v_uid     uuid := auth.uid();
  v_aktor   text;
  v_peran   text;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('sirkulasi.kelola') then
    raise exception 'Anda tidak memiliki izin untuk memproses pengembalian.';
  end if;

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if not found then
    raise exception 'Peminjaman tidak ditemukan.';
  end if;
  -- Pengembalian ganda ditolak di tingkat database.
  if v_p.tanggal_kembali_aktual is not null then
    raise exception 'Peminjaman % sudah pernah dikembalikan.', v_p.kode_pinjam;
  end if;

  select * into v_sistem from public.pengaturan_sistem where id;
  if not found then
    raise exception 'Pengaturan sistem belum diisi — jalankan migrasi 0002.';
  end if;

  v_telat := greatest(0, current_date - v_p.tanggal_kembali);
  v_denda := v_telat * v_sistem.denda_per_hari;

  update public.peminjaman
     set tanggal_kembali_aktual = current_date,
         denda = v_denda,
         status = case when v_denda > 0 then 'Terlambat' else 'Dikembalikan' end,
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
     'kembali', 'Pengembalian buku', coalesce(v_judul, v_p.kode_pinjam),
     case when v_denda > 0
          then format('%s · denda Rp%s', coalesce(v_nama, '-'),
                      to_char(v_denda::numeric, 'FM999G999G999'))
          else format('%s · tepat waktu', coalesce(v_nama, '-'))
     end);

  return to_jsonb(v_p);
end;
$$;

-- ---------------------------------------------------------------------
create or replace function public.perpanjang_buku(
  p_peminjaman_id uuid,
  p_hari integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p      public.peminjaman%rowtype;
  v_sistem public.pengaturan_sistem%rowtype;
  v_hari   integer;
  v_baru   date;
  v_judul  text;
  v_uid    uuid := auth.uid();
  v_aktor  text;
  v_peran  text;
  v_boleh  boolean;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if not found then
    raise exception 'Peminjaman tidak ditemukan.';
  end if;

  v_boleh := public.boleh('sirkulasi.kelola')
    or (
      public.boleh('panel.pinjaman')
      and exists (
        select 1 from public.profiles p
         where p.id = v_uid and p.anggota_id = v_p.anggota_id
      )
    );
  if not v_boleh then
    raise exception 'Anda tidak memiliki izin untuk memperpanjang pinjaman ini.';
  end if;

  if v_p.status <> 'Dipinjam' or v_p.tanggal_kembali_aktual is not null then
    raise exception 'Hanya pinjaman berstatus Dipinjam yang bisa diperpanjang.';
  end if;

  select * into v_sistem from public.pengaturan_sistem where id;
  if not found then
    raise exception 'Pengaturan sistem belum diisi — jalankan migrasi 0002.';
  end if;

  v_hari := coalesce(p_hari, v_sistem.lama_pinjam);
  if v_hari < 1 or v_hari > 90 then
    raise exception 'Lama perpanjaman harus antara 1 dan 90 hari.';
  end if;

  v_baru := v_p.tanggal_kembali + v_hari;
  if v_baru > v_p.tanggal_pinjam + 365 then
    raise exception 'Perpanjaman melebihi batas 1 tahun sejak tanggal pinjam.';
  end if;

  update public.peminjaman
     set tanggal_kembali = v_baru, updated_at = now()
   where id = p_peminjaman_id
  returning * into v_p;

  select b.judul into v_judul from public.buku b where b.id = v_p.buku_id;
  select p.nama, p.peran into v_aktor, v_peran
    from public.profiles p where p.id = v_uid;

  insert into public.log_aktivitas
    (aktor_id, anggota_id, aktor, peran, jenis, aksi, objek, detail)
  values
    (v_uid, v_p.anggota_id, coalesce(v_aktor, 'Anggota'), coalesce(v_peran, 'user'),
     'perpanjang', 'Pinjaman diperpanjang', coalesce(v_judul, v_p.kode_pinjam),
     format('+%s hari → jatuh tempo %s', v_hari, v_baru));

  return to_jsonb(v_p);
end;
$$;

-- Fungsi transaksi hanya untuk sesi login; tamu tidak membutuhkannya.
revoke execute on function public.pinjam_buku(uuid, uuid, date) from anon;
revoke execute on function public.kembalikan_buku(uuid) from anon;
revoke execute on function public.perpanjang_buku(uuid, integer) from anon;

grant execute on function public.pinjam_buku(uuid, uuid, date) to authenticated;
grant execute on function public.kembalikan_buku(uuid) to authenticated;
grant execute on function public.perpanjang_buku(uuid, integer) to authenticated;
