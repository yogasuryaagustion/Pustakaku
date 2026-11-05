-- 202611050001_eksemplar_buku.sql
-- Tujuan:
-- 1) Menambahkan tabel eksemplar_buku sebagai sumber kebenaran inventaris fisik.
-- 2) Membuat stok di bukus tetap konsisten dengan jumlah eksemplar yang tidak
--    dipinjam/diblokir, tanpa mengubah logika aplikasi lama secara langsung.
-- 3) Memberikan view v_inventaris_per_buku untuk sinkronisasi dan stock opname.

BEGIN;

-- Tabel eksemplar fisik
CREATE TABLE IF NOT EXISTS eksemplar_buku (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buku_id UUID NOT NULL REFERENCES bukus(id) ON DELETE CASCADE,
  nomor_inventaris TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'tersedia',
  kondisi_fisik TEXT NOT NULL DEFAULT 'layak',
  tanggal_pengadaan DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diedit_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT eksemplar_status_chk CHECK (status IN ('tersedia','dipinjam','rusak','hilang')),
  CONSTRAINT eksemplar_kondisi_chk CHECK (kondisi_fisik IN ('layak','rusak_ringan','rusak_beda','hilang'))
);

-- Nomor inventaris unik di seluruh sistem
CREATE UNIQUE INDEX IF NOT EXISTS idx_eksemplar_buku_nomor_inventaris
  ON eksemplar_buku (nomor_inventaris)
  WHERE nomor_inventaris IS NOT NULL;

-- Dapatkan eksemplar yang sedang dipinjam agar tidak dipakai dua kali
CREATE UNIQUE INDEX IF NOT EXISTS idx_eksemplar_buku_status_dipinjam
  ON eksemplar_buku (buku_id)
  WHERE status = 'dipinjam';

-- View ringkasan inventaris per judul
CREATE OR REPLACE VIEW v_inventaris_per_buku AS
SELECT
  b.id AS buku_id,
  b.judul,
  b.pengarang,
  b.penerbit,
  b.tahun_terbit,
  b.tempat_terbit,
  b.bahasa,
  b.kategori,
  b.plat,
  b.dewey,
  b.cls,
  b.sinopsis,
  b.cover_url,
  b.ditambahkan_pada,
  b.diedit_pada,
  b.dibuat_pada,
  COUNT(e.id) AS total_eksemplar,
  COUNT(e.id) FILTER (WHERE e.status = 'tersedia') AS tersedia,
  COUNT(e.id) FILTER (WHERE e.status = 'dipinjam') AS dipinjam,
  COUNT(e.id) FILTER (WHERE e.status = 'rusak') AS rusak,
  COUNT(e.id) FILTER (WHERE e.status = 'hilang') AS hilang
FROM bukus b
LEFT JOIN eksemplar_buku e ON e.buku_id = b.id
GROUP BY b.id;

-- Pembaruan stok otomatis di bukus
CREATE OR REPLACE FUNCTION fn_sinkronisasi_stok_buku()
RETURNS trigger AS $$
BEGIN
  UPDATE bukus
  SET stok = v.total
  FROM (
    SELECT buku_id, COUNT(*) AS total
    FROM eksemplar_buku
    WHERE buku_id IS NOT NULL
    GROUP BY buku_id
  ) v
  WHERE bukus.id = v.buku_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sinkronisasi_stok_buku
AFTER INSERT OR UPDATE OF buku_id, status ON eksemplar_buku
FOR EACH STATEMENT
EXECUTE FUNCTION fn_sinkronisasi_stok_buku();

-- Panggil sekali untuk menyamakan stok yang sudah ada
UPDATE bukus
SET stok = v.total
FROM (
  SELECT buku_id, COUNT(*) AS total
  FROM eksemplar_buku
  GROUP BY buku_id
) v
WHERE bukus.id = v.buku_id;

COMMIT;