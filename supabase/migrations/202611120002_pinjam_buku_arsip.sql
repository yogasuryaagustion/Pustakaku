-- 202611120002_pinjam_buku_arsip.sql
-- Tujuan:
--   Buku yang diarsipkan (buku.dihapus_pada terisi, migrasi 202611120001)
--   hilang dari katalog, tetapi salinan fisiknya tetap ada di eksemplar_buku
--   dengan status 'tersedia'. Tanpa penjagaan di sini, petugas bisa memindai
--   label INV-… dan tetap meminjam judul yang sudah diarsipkan.
--
--   Penjagaan ditaruh tepat setelah baris buku dibaca & dikunci, jadi berlaku
--   untuk dua jalur sekaligus: p_buku_id langsung maupun p_eksemplar_id hasil
--   pindai barcode (RPC pinjam_buku adalah satu-satunya pintu peminjaman).
--
--   Tanda tangan fungsi TIDAK berubah, sehingga create or replace cukup dan
--   pemanggil lama (4 atau 5 argumen) tetap berjalan.

create or replace function public.pinjam_buku(
  p_buku_id uuid,
  p_anggota_id uuid,
  p_tanggal_pinjam date default null,
  p_lama_hari integer default null,
  p_eksemplar_id uuid default null
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

  -- Buku berarsip hanya boleh tampil di riwayat. Salinan fisiknya masih
  -- berstatus 'tersedia', jadi tanpa cek ini pemindaian barcode akan tetap
  -- membuat pinjaman baru untuk judul yang sudah ditarik dari katalog.
  if v_buku.dihapus_pada is not null then
    raise exception 'Buku "%" sudah diarsipkan dan tidak bisa dipinjam.', v_buku.judul;
  end if;

  select * into v_anggota from public.anggota where id = p_anggota_id for update;
  if not found then
    raise exception 'Anggota tidak ditemukan.';
  end if;
  if not v_anggota.aktif then
    raise exception 'Anggota % tidak aktif.', v_anggota.nama;
  end if;

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

  if p_eksemplar_id is not null then
    -- Salinan hasil pindai barcode: harus benar-benar milik judul ini dan siap
    -- dipinjam, supaya slip dan inventaris menunjuk barang yang sama.
    select e.* into v_eksemplar
      from public.eksemplar_buku e
     where e.id = p_eksemplar_id
     for update;
    if v_eksemplar.id is null then
      raise exception 'Salinan dengan barcode itu tidak ditemukan.';
    end if;
    if v_eksemplar.buku_id <> p_buku_id then
      raise exception 'Barcode % bukan milik judul "%".',
        v_eksemplar.nomor_inventaris, v_buku.judul;
    end if;
    if v_eksemplar.kondisi_fisik = 'hilang' or v_eksemplar.status = 'hilang' then
      raise exception 'Salinan % dinyatakan hilang dan tidak bisa dipinjam.',
        v_eksemplar.nomor_inventaris;
    end if;
    if v_eksemplar.status <> 'tersedia' then
      raise exception 'Salinan % berstatus % dan tidak bisa dipinjam.',
        v_eksemplar.nomor_inventaris, v_eksemplar.status;
    end if;
  else
    select e.* into v_eksemplar
      from public.eksemplar_buku e
     where e.buku_id = p_buku_id
       and e.status = 'tersedia'
       and e.kondisi_fisik <> 'hilang'
     order by e.nomor_inventaris
     for update skip locked
     limit 1;
  end if;

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

revoke all on function public.pinjam_buku(uuid, uuid, date, integer, uuid) from public, anon;

grant execute on function public.pinjam_buku(uuid, uuid, date, integer, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
