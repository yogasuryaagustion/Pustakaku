-- 202611120001_arsip_buku.sql
-- Tujuan:
--   Buku yang sudah pernah dipinjam tidak bisa dihapus permanen karena
--   peminjaman.buku_id memakai ON DELETE RESTRICT (riwayat harus utuh).
--   Supaya admin tetap bisa "menghapus" judul seperti itu dari katalog,
--   baris buku tidak dibuang melainkan ditandai dihapus_pada:
--     - GET /api/buku (katalog, laporan, dashboard) hanya membaca baris
--       dengan dihapus_pada IS NULL,
--     - riwayat peminjaman, denda, dan eksemplar tetap merujuk buku yang sama.
--   DELETE /api/buku/[id] tetap menghapus permanen buku tanpa riwayat.

BEGIN;

ALTER TABLE public.buku ADD COLUMN IF NOT EXISTS dihapus_pada timestamptz;

COMMENT ON COLUMN public.buku.dihapus_pada IS
  'Waktu buku diarsipkan (disembunyikan dari katalog). NULL = masih tampil.';

-- Katalog selalu menyaring baris aktif; indeks parsial menjaga biayanya tetap
-- kecil meski arsip bertambah.
CREATE INDEX IF NOT EXISTS buku_belum_dihapus_idx
  ON public.buku (created_at DESC)
  WHERE dihapus_pada IS NULL;

COMMIT;
