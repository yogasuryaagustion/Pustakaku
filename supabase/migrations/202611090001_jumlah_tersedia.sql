-- ---------------------------------------------------------------------
-- Jumlah salinan yang benar-benar bisa dipinjam, per judul.
--
-- Sebelumnya UI menghitung ketersediaan sebagai `buku.stok - peminjaman aktif`.
-- Karena `buku.stok` adalah jumlah SELURUH salinan (termasuk yang rusak/hilang),
-- katalog dan dialog pinjam menawarkan judul yang salinannya sudah tidak layak.
-- Fungsi ini meniru aturan `pinjam_buku` persis:
--   - judul yang sudah punya salinan → hitung salinan berstatus 'tersedia' dan
--     kondisi fisik bukan 'hilang';
--   - judul tanpa salinan (data lama) → `stok - peminjaman aktif`.
-- ---------------------------------------------------------------------

create or replace function public.jumlah_tersedia()
returns table (buku_id uuid, jumlah bigint)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         case
           when count(e.id) = 0 then
             greatest(
               0,
               b.stok - (
                 select count(*)
                   from public.peminjaman p
                  where p.buku_id = b.id
                    and p.status = 'Dipinjam'
               )
             )::bigint
           else
             count(e.id) filter (
               where e.status = 'tersedia'
                 and e.kondisi_fisik <> 'hilang'
             )::bigint
         end
    from public.buku b
    left join public.eksemplar_buku e on e.buku_id = b.id
   group by b.id, b.stok;
$$;

revoke execute on function public.jumlah_tersedia() from public;
grant execute on function public.jumlah_tersedia() to anon, authenticated, service_role;
