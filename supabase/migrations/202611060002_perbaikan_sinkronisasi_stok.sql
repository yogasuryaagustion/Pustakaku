-- Perbaikan sinkronisasi stok buku ↔ eksemplar fisik.
--
-- Trigger lama berjalan FOR EACH STATEMENT dan menghitung ulang stok lewat
-- subquery yang hanya memuat buku yang MASIH punya eksemplar. Akibatnya,
-- menghapus eksemplar terakhir sebuah judul meninggalkan stok lama (mis. stok
-- tetap 1 padahal barang fisik sudah 0). Trigger baru berjalan per baris dan
-- memakai OLD/NEW, sehingga buku yang eksemplarnya habis ikut disetel ke 0.

create or replace function public.fn_sinkronisasi_stok_buku()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    update public.buku b
       set stok = (
             select count(*)::int
             from public.eksemplar_buku e
             where e.buku_id = old.buku_id
           )
     where b.id = old.buku_id;
    return null;
  end if;

  update public.buku b
     set stok = (
           select count(*)::int
           from public.eksemplar_buku e
           where e.buku_id = new.buku_id
         )
   where b.id = new.buku_id;

  -- Eksemplar dipindahkan ke judul lain: stok judul asal juga disesuaikan.
  if tg_op = 'UPDATE' and old.buku_id is distinct from new.buku_id then
    update public.buku b
       set stok = (
             select count(*)::int
             from public.eksemplar_buku e
             where e.buku_id = old.buku_id
           )
     where b.id = old.buku_id;
  end if;

  return null;
end;
$$;

-- Status eksemplar tidak memengaruhi jumlah fisik, jadi cukup buku_id.
drop trigger if exists trg_sinkronisasi_stok_buku on public.eksemplar_buku;

create trigger trg_sinkronisasi_stok_buku
after insert or delete or update of buku_id on public.eksemplar_buku
for each row execute function public.fn_sinkronisasi_stok_buku();
