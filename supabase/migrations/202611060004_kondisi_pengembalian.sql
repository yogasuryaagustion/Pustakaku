-- Pengembalian sekaligus mencatat kondisi fisik salinan yang diterima.
--
-- Petugas memilih "layak" (kembali ke rak, bisa dipinjam lagi) atau
-- "rusak_ringan" (disimpan sebagai rusak, tidak ditawarkan untuk dipinjam).
-- Bila kondisi tidak dikirim (mis. pengembalian mandiri dari panel anggota),
-- perilaku lama dipertahankan: eksemplar hanya dibebaskan tanpa mengubah
-- kondisi yang sudah tercatat.
--
-- Parameter baru membuat tanda tangan fungsi berubah, jadi versi satu
-- parameter dihapus lebih dulu agar pemanggilan tidak ambigu.

drop function if exists public.kembalikan_buku(uuid);

create or replace function public.kembalikan_buku(
  p_peminjaman_id uuid,
  p_kondisi_fisik text default null
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
begin
  if v_uid is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('sirkulasi.kelola') then
    raise exception 'Anda tidak memiliki izin untuk memproses pengembalian.';
  end if;

  if p_kondisi_fisik is not null and p_kondisi_fisik not in ('layak', 'rusak_ringan') then
    raise exception 'Kondisi pengembalian harus "layak" atau "rusak_ringan".';
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

  -- Terapkan kondisi fisik yang dipilih petugas.
  if v_p.eksemplar_id is not null then
    if p_kondisi_fisik = 'layak' then
      update public.eksemplar_buku e
         set status = 'tersedia',
             kondisi_fisik = 'layak',
             diedit_pada = now()
       where e.id = v_p.eksemplar_id
      returning e.nomor_inventaris, e.kondisi_fisik into v_nomor, v_kondisi;
    elsif p_kondisi_fisik = 'rusak_ringan' then
      update public.eksemplar_buku e
         set status = 'rusak',
             kondisi_fisik = 'rusak_ringan',
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

revoke execute on function public.kembalikan_buku(uuid, text) from anon;

grant execute on function public.kembalikan_buku(uuid, text) to authenticated, service_role;

-- Tanda tangan fungsi berubah: minta PostgREST memuat ulang cache skema.
notify pgrst, 'reload schema';
