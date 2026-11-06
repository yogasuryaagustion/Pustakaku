-- Menyambungkan sirkulasi ke inventaris fisik.
--
-- Sebelumnya `pinjam_buku` hanya memeriksa angka stok dan tidak menyentuh
-- `eksemplar_buku`, sehingga eksemplar tetap berstatus "tersedia" walau
-- barangnya sudah dibawa anggota. Migrasi ini:
--   1. menambah kolom `peminjaman.eksemplar_id` (satu pinjaman aktif = satu
--      eksemplar, dijaga indeks unik parsial);
--   2. memilih satu eksemplar tersedia saat meminjam dan menandainya
--      "dipinjam";
--   3. mengembalikan eksemplar itu ke "tersedia" saat buku dikembalikan.
--
-- Judul yang belum punya data eksemplar tetap bisa dipinjam seperti dulu
-- (memakai `buku.stok`) supaya sirkulasi tidak berhenti sebelum inventaris
-- fisik didata. Eksemplar yang ditandai rusak/hilang oleh petugas tidak
-- diubah saat pengembalian — kondisi fisiknya tetap tercatat.

-- Indeks lama membatasi satu judul hanya boleh punya SATU eksemplar
-- 'dipinjam'. Untuk buku dengan beberapa salinan itu salah: peminjaman kedua
-- gagal dengan duplicate key. Batas yang benar ada di sisi peminjaman.
drop index if exists public.idx_eksemplar_buku_status_dipinjam;

alter table public.peminjaman
  add column if not exists eksemplar_id uuid
  references public.eksemplar_buku(id) on delete set null;

create index if not exists peminjaman_eksemplar_idx
  on public.peminjaman (eksemplar_id);

-- Satu eksemplar fisik tidak boleh dipinjam dua kali sekaligus.
create unique index if not exists peminjaman_eksemplar_aktif_uniq
  on public.peminjaman (eksemplar_id)
  where eksemplar_id is not null and status = 'Dipinjam';

-- ---------------------------------------------------------------------
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
  v_tgl       date := coalesce(p_tanggal_pinjam, current_date);
  v_buku      public.buku%rowtype;
  v_anggota   public.anggota%rowtype;
  v_sistem    public.pengaturan_sistem%rowtype;
  v_dipinjam  integer;
  v_aktif     integer;
  v_coba      integer := 0;
  v_kode      text;
  v_baru      public.peminjaman%rowtype;
  v_uid       uuid := auth.uid();
  v_aktor     text;
  v_peran     text;
  v_eksemplar public.eksemplar_buku%rowtype;
  v_punya_eks integer;
  v_nomor     text;
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

  -- Pilih satu eksemplar fisik yang benar-benar tersedia. SKIP LOCKED membuat
  -- dua peminjaman bersamaan tidak mungkin mengambil salinan yang sama.
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
    -- Judul yang sudah didata fisiknya: ketersediaan ditentukan eksemplar.
    if v_eksemplar.id is null then
      raise exception 'Semua eksemplar "%" sedang dipinjam atau tidak tersedia.', v_buku.judul;
    end if;
  else
    -- Belum ada data eksemplar: perilaku lama berbasis buku.stok.
    select count(*) into v_dipinjam
      from public.peminjaman
     where buku_id = p_buku_id and status = 'Dipinjam';
    if v_buku.stok - v_dipinjam <= 0 then
      raise exception 'Stok "%" habis.', v_buku.judul;
    end if;
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

  -- Tandai salinan fisik sebagai dipinjam.
  if v_eksemplar.id is not null then
    update public.eksemplar_buku
       set status = 'dipinjam',
           diedit_pada = now()
     where id = v_eksemplar.id;
    v_nomor := v_eksemplar.nomor_inventaris;
  end if;

  -- Kode pinjam unik; nomor berikutnya bila bentrok dengan data impor.
  while v_coba < 10 loop
    v_coba := v_coba + 1;
    v_kode := 'PIN-' || lpad(nextval('public.kode_pinjam_seq')::text, 4, '0');
    begin
      insert into public.peminjaman
        (kode_pinjam, buku_id, anggota_id, eksemplar_id,
         tanggal_pinjam, tanggal_kembali, status)
      values
        (v_kode, p_buku_id, p_anggota_id, v_eksemplar.id,
         v_tgl, v_tgl + v_sistem.lama_pinjam, 'Dipinjam')
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
     format('%s · jatuh tempo %s%s', v_anggota.nama, v_baru.tanggal_kembali,
            case when v_nomor is null then '' else ' · inv ' || v_nomor end));

  return to_jsonb(v_baru) || jsonb_build_object('nomor_inventaris', v_nomor);
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
  v_nomor   text;
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

  -- Salinan fisik kembali ke rak, kecuali petugas sudah menandainya
  -- rusak/hilang selama dipinjam — kondisi itu sengaja dipertahankan.
  if v_p.eksemplar_id is not null then
    update public.eksemplar_buku e
       set status = 'tersedia',
           diedit_pada = now()
     where e.id = v_p.eksemplar_id
       and e.status = 'dipinjam'
    returning e.nomor_inventaris into v_nomor;
  end if;

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
     end
     || case when v_nomor is null then '' else ' · inv ' || v_nomor end);

  return to_jsonb(v_p) || jsonb_build_object('nomor_inventaris', v_nomor);
end;
$$;

revoke execute on function public.pinjam_buku(uuid, uuid, date) from anon;
revoke execute on function public.kembalikan_buku(uuid) from anon;

grant execute on function public.pinjam_buku(uuid, uuid, date) to authenticated, service_role;
grant execute on function public.kembalikan_buku(uuid) to authenticated, service_role;
