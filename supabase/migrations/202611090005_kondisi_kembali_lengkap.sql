-- Pengembalian boleh mencatat empat kondisi fisik, bukan hanya dua.
--
-- Sebelumnya dialog pengembalian hanya menawarkan "layak" dan "rusak_ringan",
-- sedangkan inventaris punya empat kondisi (layak, rusak_ringan, rusak_beda,
-- hilang). Akibatnya temuan seperti "buku yang dikembalikan ternyata bukan
-- edisi yang tercatat" atau "buku tidak kembali sama sekali" harus dicatat
-- terpisah lewat opname.
--
-- Aturan status salinan setelah pengembalian:
--   layak         -> status tersedia, kondisi layak        (boleh dipinjam lagi)
--   rusak_ringan  -> status rusak,    kondisi rusak_ringan (tidak ditawarkan)
--   rusak_beda    -> status rusak,    kondisi rusak_beda   (tidak ditawarkan)
--   hilang        -> status hilang,   kondisi hilang       (stok menyusut saat
--                    "Perbaiki Selisih" menulis-habis salinan hilang)
--
-- Tanda tangan fungsi tidak berubah, jadi cukup create or replace.

-- Kolom validasi pengajuan anggota ikut menerima dua kondisi baru.
alter table public.pengembalian_ajuan
  drop constraint if exists pengembalian_ajuan_kondisi_divalidasi_check;

alter table public.pengembalian_ajuan
  add constraint pengembalian_ajuan_kondisi_divalidasi_check
  check (kondisi_divalidasi in ('layak', 'rusak_ringan', 'rusak_beda', 'hilang'));

create or replace function public.kembalikan_buku(
  p_peminjaman_id uuid,
  p_kondisi_fisik text default null,
  p_eksemplar_id uuid default null
) returns jsonb
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
  v_kondisi text;
  v_status  text;
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('sirkulasi.kelola') then
    raise exception 'Anda tidak memiliki izin untuk memproses pengembalian.';
  end if;

  if p_kondisi_fisik is not null
     and p_kondisi_fisik not in ('layak', 'rusak_ringan', 'rusak_beda', 'hilang') then
    raise exception 'Kondisi pengembalian harus layak, rusak_ringan, rusak_beda, atau hilang.';
  end if;

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if not found then
    raise exception 'Peminjaman tidak ditemukan.';
  end if;
  -- Pengembalian ganda ditolak di tingkat database.
  if v_p.tanggal_kembali_aktual is not null then
    raise exception 'Peminjaman % sudah pernah dikembalikan.', v_p.kode_pinjam;
  end if;

  -- Pinjaman lama bisa belum tertaut ke salinan. Tautkan salinan yang dipilih
  -- petugas agar kondisi fisiknya ikut tercatat di inventaris.
  if v_p.eksemplar_id is null and p_eksemplar_id is not null then
    select e.status into v_status
      from public.eksemplar_buku e
     where e.id = p_eksemplar_id
       and e.buku_id = v_p.buku_id
     for update;
    if v_status is null then
      raise exception 'Salinan yang dipilih bukan milik judul ini.';
    end if;
    if v_status not in ('tersedia', 'dipinjam') then
      raise exception 'Salinan berstatus % tidak bisa diterima kembali.', v_status;
    end if;
    if exists (
      select 1 from public.peminjaman x
       where x.eksemplar_id = p_eksemplar_id
         and x.tanggal_kembali_aktual is null
         and x.id <> v_p.id
    ) then
      raise exception 'Salinan itu masih dipinjam pada transaksi lain.';
    end if;

    update public.peminjaman
       set eksemplar_id = p_eksemplar_id
     where id = v_p.id;
    v_p.eksemplar_id := p_eksemplar_id;
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

  -- Terapkan kondisi fisik yang dipilih petugas.
  if v_p.eksemplar_id is not null then
    if p_kondisi_fisik = 'layak' then
      update public.eksemplar_buku e
         set status = 'tersedia',
             kondisi_fisik = 'layak',
             diedit_pada = now()
       where e.id = v_p.eksemplar_id
      returning e.nomor_inventaris, e.kondisi_fisik into v_nomor, v_kondisi;
    elsif p_kondisi_fisik in ('rusak_ringan', 'rusak_beda') then
      -- Keduanya tidak boleh dipinjam lagi; yang membedakan hanya catatan
      -- kondisinya untuk tindak lanjut inventaris.
      update public.eksemplar_buku e
         set status = 'rusak',
             kondisi_fisik = p_kondisi_fisik,
             diedit_pada = now()
       where e.id = v_p.eksemplar_id
      returning e.nomor_inventaris, e.kondisi_fisik into v_nomor, v_kondisi;
    elsif p_kondisi_fisik = 'hilang' then
      -- Buku tidak kembali: salinan keluar dari rak. Stok katalog baru turun
      -- saat "Perbaiki Selisih" menulis-habis salinan hilang.
      update public.eksemplar_buku e
         set status = 'hilang',
             kondisi_fisik = 'hilang',
             diedit_pada = now()
       where e.id = v_p.eksemplar_id
      returning e.nomor_inventaris, e.kondisi_fisik into v_nomor, v_kondisi;
    else
      -- Tanpa pilihan kondisi: bebas dari pinjaman, kondisi tidak diubah
      -- kecuali petugas sudah menandainya rusak/hilang selama dipinjam.
      update public.eksemplar_buku e
         set status = 'tersedia',
             diedit_pada = now()
       where e.id = v_p.eksemplar_id
         and e.status = 'dipinjam'
      returning e.nomor_inventaris, e.kondisi_fisik into v_nomor, v_kondisi;
      if v_nomor is null then
        select e.nomor_inventaris, e.kondisi_fisik
          into v_nomor, v_kondisi
          from public.eksemplar_buku e
         where e.id = v_p.eksemplar_id;
      end if;
    end if;
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
     || case when v_nomor is null then '' else ' · inv ' || v_nomor end
     || case when v_kondisi is null then '' else ' · kondisi ' || v_kondisi end);

  return to_jsonb(v_p) || jsonb_build_object(
    'nomor_inventaris', v_nomor,
    'kondisi_fisik', v_kondisi
  );
end;
$$;

revoke execute on function public.kembalikan_buku(uuid, text, uuid) from anon;

grant execute on function public.kembalikan_buku(uuid, text, uuid) to authenticated, service_role;

create or replace function public.verifikasi_kembali(
  p_peminjaman_id uuid,
  p_kondisi_fisik text,
  p_eksemplar_id uuid default null
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
  if p_kondisi_fisik is null
     or p_kondisi_fisik not in ('layak', 'rusak_ringan', 'rusak_beda', 'hilang') then
    raise exception 'Kondisi buku harus layak, rusak_ringan, rusak_beda, atau hilang.';
  end if;
  if not exists (
    select 1 from public.pengembalian_ajuan
     where peminjaman_id = p_peminjaman_id and status = 'menunggu'
  ) then
    raise exception 'Tidak ada pengajuan pengembalian yang menunggu untuk pinjaman ini.';
  end if;

  -- Memakai alur pengembalian yang sudah ada agar aturan denda dan status
  -- eksemplar tetap satu sumber.
  v_hasil := public.kembalikan_buku(p_peminjaman_id, p_kondisi_fisik, p_eksemplar_id);

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

revoke execute on function public.verifikasi_kembali(uuid, text, uuid) from public;

grant execute on function public.verifikasi_kembali(uuid, text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
