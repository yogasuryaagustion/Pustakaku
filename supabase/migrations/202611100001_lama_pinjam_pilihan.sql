-- Lama pinjam bisa ditentukan saat mencatat peminjaman.
--
-- Sebelumnya jatuh tempo selalu `tanggal_pinjam + pengaturan_sistem.lama_pinjam`,
-- sehingga petugas harus mengubah Pengaturan Sistem (berlaku untuk semua
-- pinjaman berikutnya) hanya untuk satu transaksi khusus — misalnya pinjaman
-- jangka pendek untuk kelas atau perpanjangan khusus.
--
-- Parameter keempat `p_lama_hari` bersifat opsional: bila kosong, nilai
-- standar dari pengaturan tetap dipakai sehingga pemanggil lama (katalog,
-- panel anggota) tidak perlu berubah.
--
-- Catatan: fungsi 3 parameter dihapus lebih dulu. Bila dibiarkan, pemanggilan
-- 3 argumen menjadi ambigu antara versi lama dan versi baru yang punya nilai
-- bawaan, dan PostgreSQL menolak dengan "function is not unique".

drop function if exists public.pinjam_buku(uuid, uuid, date);

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
  v_tgl       date := coalesce(p_tanggal_pinjam, current_date);
  v_lama      integer;
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
  -- Sama dengan batas di Pengaturan (1–90 hari). Nilai di luar itu hampir
  -- pasti salah ketik, jadi ditolak di database, bukan hanya di layar.
  if p_lama_hari is not null and (p_lama_hari < 1 or p_lama_hari > 90) then
    raise exception 'Lama pinjam harus antara 1 dan 90 hari.';
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

  v_lama := coalesce(p_lama_hari, v_sistem.lama_pinjam);

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
         v_tgl, v_tgl + v_lama, 'Dipinjam')
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
     format('%s · jatuh tempo %s%s%s', v_anggota.nama, v_baru.tanggal_kembali,
            case when p_lama_hari is null then '' else ' · lama ' || v_lama || ' hari' end,
            case when v_nomor is null then '' else ' · inv ' || v_nomor end));

  return to_jsonb(v_baru) || jsonb_build_object('nomor_inventaris', v_nomor);
end;
$$;

-- Fungsi baru mewarisi izin EXECUTE untuk PUBLIC dari PostgreSQL, jadi
-- keduanya dicabut — bukan hanya anon — agar sama dengan fungsi lain.
revoke execute on function public.pinjam_buku(uuid, uuid, date, integer) from public, anon;

grant execute on function public.pinjam_buku(uuid, uuid, date, integer)
  to authenticated, service_role;
