-- Tambah beberapa eksemplar sekaligus dengan nomor inventaris berurutan.
--
-- Sebelumnya formulir "Tambah Eksemplar" hanya bisa menyimpan satu salinan,
-- sehingga menambah 5 buku baru berarti mengulang formulir 5 kali. Migrasi ini
-- menambah fungsi yang menyisipkan sekian salinan dalam SATU transaksi, dengan
-- nomor diambil dari pola Pengaturan (nomor_inventaris_berikutnya) untuk setiap
-- salinan — bukan dari hitungan di aplikasi.
--
-- Semua salinan harus berhasil atau tidak sama sekali: bila satu penyisipan
-- gagal (mis. nomor bentrok), transaksi dibatalkan sehingga inventaris tidak
-- setengah jadi.

create or replace function public.tambah_eksemplar_banyak(
  p_buku_id uuid,
  p_jumlah integer default 1,
  p_status text default 'tersedia',
  p_kondisi text default 'layak',
  p_tanggal date default null,
  p_keterangan text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hasil jsonb := '[]'::jsonb;
  v_nomor text;
  v_coba  integer;
  v_i     integer;
  v_baru  public.eksemplar_buku%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('katalog.kelola') then
    raise exception 'Anda tidak memiliki izin untuk menambah eksemplar.';
  end if;
  if p_jumlah is null or p_jumlah < 1 or p_jumlah > 50 then
    raise exception 'Jumlah eksemplar harus antara 1 dan 50.';
  end if;
  if not exists (select 1 from public.buku b where b.id = p_buku_id) then
    raise exception 'Buku tidak ditemukan.';
  end if;
  if p_status not in ('tersedia', 'dipinjam', 'rusak', 'hilang') then
    raise exception 'Status eksemplar "%" tidak dikenal.', p_status;
  end if;
  if p_kondisi not in ('layak', 'rusak_ringan', 'rusak_beda', 'hilang') then
    raise exception 'Kondisi fisik "%" tidak dikenal.', p_kondisi;
  end if;

  -- Satu transaksi per pemanggilan: kunci ini menahan pembuatan nomor
  -- otomatis dari permintaan lain sampai seluruh salinan selesai disisipkan,
  -- jadi dua petugas yang menambah bersamaan tidak mendapat nomor kembar.
  perform pg_advisory_xact_lock(hashtext('inventaris-nomor'));

  for v_i in 1..p_jumlah loop
    v_nomor := null;
    v_coba := 0;

    loop
      v_coba := v_coba + 1;
      v_nomor := public.nomor_inventaris_berikutnya();

      begin
        insert into public.eksemplar_buku
          (buku_id, nomor_inventaris, status, kondisi_fisik, tanggal_pengadaan, keterangan)
        values
          (p_buku_id, v_nomor, p_status, p_kondisi,
           coalesce(p_tanggal, current_date), p_keterangan)
        returning * into v_baru;
        exit;
      exception when unique_violation then
        -- Nomor dilewati walau sudah dikunci (mis. sisa nomor lama); cari lagi.
        if v_coba > 5 then
          raise exception 'Gagal membuat nomor inventaris unik.';
        end if;
        v_nomor := null;
      end;
    end loop;

    v_hasil := v_hasil || to_jsonb(v_baru);
  end loop;

  return v_hasil;
end;
$$;

revoke execute on function public.tambah_eksemplar_banyak(uuid, integer, text, text, date, text) from anon;

grant execute on function public.tambah_eksemplar_banyak(uuid, integer, text, text, date, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
