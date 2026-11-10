-- ---------------------------------------------------------------------
-- Uji regresi public.rekonsiliasi_stok_inventaris() — perlakuan salinan
-- rusak vs hilang saat "Perbaiki Selisih".
--
-- Seluruh skrip berjalan di dalam satu transaksi dan diakhiri ROLLBACK, jadi
-- data produksi/staging tidak berubah. Cara pakai (psql):
--
--   psql "$DATABASE_URL" -f supabase/tests/rekonsiliasi_stok.sql
--
-- Hasil: tabel berisi baris uji dengan kolom lolos. Semua harus true.
-- Bila ada yang false, periksa ulang migrasi 202611090002_rekonsiliasi_tulis_habis.sql.
-- ---------------------------------------------------------------------

begin;

create temp table _uji_rekonsiliasi (
  langkah text,
  harapan text,
  dapat text,
  lolos boolean
) on commit drop;

do $$
declare
  v_buku uuid;
  v_stok integer;
  v_rusak integer;
  v_hilang integer;
  v_diperbaiki integer;
begin
  -- Satu judul uji dengan tiga salinan: tersedia, rusak, dan hilang.
  insert into public.buku (judul, penulis)
  values ('UJI REKONSILIASI STOK', 'Pengujian Otomatis')
  returning id into v_buku;

  insert into public.eksemplar_buku (buku_id, nomor_inventaris, status, kondisi_fisik)
  values
    (v_buku, 'UJI-REK-0001', 'tersedia', 'layak'),
    (v_buku, 'UJI-REK-0002', 'rusak', 'rusak_beda'),
    (v_buku, 'UJI-REK-0003', 'hilang', 'hilang');

  select stok into v_stok from public.buku where id = v_buku;
  insert into _uji_rekonsiliasi
  select 'stok awal menghitung semua salinan', '3', v_stok::text, v_stok = 3;

  -- Rekonsiliasi hanya boleh menulis habis salinan hilang.
  v_diperbaiki := public.rekonsiliasi_stok_inventaris();
  insert into _uji_rekonsiliasi
  select 'satu salinan hilang ditulis habis', '1', v_diperbaiki::text, v_diperbaiki = 1;

  select count(*) into v_hilang
    from public.eksemplar_buku
   where buku_id = v_buku and status = 'hilang';
  insert into _uji_rekonsiliasi
  select 'salinan hilang terhapus dari koleksi', '0', v_hilang::text, v_hilang = 0;

  -- Salinan rusak tetap ada karena barangnya masih di rak.
  select count(*) into v_rusak
    from public.eksemplar_buku
   where buku_id = v_buku and status = 'rusak' and kondisi_fisik = 'rusak_beda';
  insert into _uji_rekonsiliasi
  select 'salinan rusak tetap tercatat', '1', v_rusak::text, v_rusak = 1;

  select stok into v_stok from public.buku where id = v_buku;
  insert into _uji_rekonsiliasi
  select 'stok katalog turun mengikuti salinan tersisa', '2', v_stok::text, v_stok = 2;

  -- Dijalankan ulang tidak boleh mengubah apa pun lagi.
  v_diperbaiki := public.rekonsiliasi_stok_inventaris();
  insert into _uji_rekonsiliasi
  select 'rekonsiliasi ulang tidak menghapus salinan rusak', '0', v_diperbaiki::text, v_diperbaiki = 0;

  select stok into v_stok from public.buku where id = v_buku;
  insert into _uji_rekonsiliasi
  select 'stok tetap 2 setelah rekonsiliasi ulang', '2', v_stok::text, v_stok = 2;
end $$;

select langkah, harapan, dapat, lolos from _uji_rekonsiliasi;

-- Jangan simpan data uji.
rollback;
