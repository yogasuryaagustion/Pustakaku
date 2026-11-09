-- ---------------------------------------------------------------------
-- Rekonsiliasi stok: tulis habis salinan hilang, lalu samakan stok katalog.
--
-- Sebelumnya fungsi ini hanya menyalin `stok = COUNT(*)` seluruh salinan.
-- Karena trigger `fn_sinkronisasi_stok_buku` melakukan hal yang sama, tidak
-- pernah ada selisih yang bisa diperbaiki — termasuk setelah hitung fisik
-- menemukan buku yang hilang.
--
-- Aturan baru: salinan berstatus `hilang` sudah tidak ada di rak, jadi
-- dikeluarkan dari koleksi (dihapus) saat rekonsiliasi dijalankan. Trigger
-- lalu menurunkan `buku.stok`, sehingga stok katalog sama dengan barang yang
-- benar-benar ada. Salinan rusak tetap dihitung karena fisiknya masih ada.
-- Salinan hilang yang masih terikat pinjaman aktif sengaja dilewati agar
-- data sirkulasi tidak kehilangan jejak eksemplar.
-- ---------------------------------------------------------------------

create or replace function public.rekonsiliasi_stok_inventaris()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hapus integer := 0;
  v_sinkron integer := 0;
begin
  -- 1. Tulis habis salinan yang dinyatakan hilang dan tidak sedang dipinjam.
  with hapus as (
    delete from public.eksemplar_buku e
     where e.status = 'hilang'
       and not exists (
         select 1
           from public.peminjaman p
          where p.eksemplar_id = e.id
            and p.status = 'Dipinjam'
       )
    returning e.id
  )
  select count(*)::int into v_hapus from hapus;

  -- 2. Samakan stok judul yang masih punya salinan (jaring pengaman bila stok
  --    pernah diubah manual). Judul tanpa salinan dibiarkan memakai angka
  --    katalognya seperti sebelumnya.
  with hitung as (
    select buku_id, count(*)::int as total
      from public.eksemplar_buku
     group by buku_id
  ), ubah as (
    update public.buku b
       set stok = h.total
      from hitung h
     where b.id = h.buku_id
       and b.stok <> h.total
    returning b.id
  )
  select count(*)::int into v_sinkron from ubah;

  return v_hapus;
end;
$$;

revoke execute on function public.rekonsiliasi_stok_inventaris() from public;
grant execute on function public.rekonsiliasi_stok_inventaris() to authenticated, service_role;
