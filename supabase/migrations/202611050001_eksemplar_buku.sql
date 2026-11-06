-- 202611050001_eksemplar_buku.sql
-- Tujuan:
-- 1) Menambahkan tabel eksemplar_buku sebagai sumber kebenaran inventaris fisik.
-- 2) Membuat stok di tabel buku tetap konsisten dengan jumlah eksemplar.
-- 3) Menyediakan view v_inventaris_per_buku untuk sinkronisasi & stock opname.
--
-- Catatan: tabel katalog di proyek ini bernama `buku` (bukan `bukus`) dengan
-- kolom judul, penulis, penerbit, tahun, isbn, kategori, rak, stok, deskripsi,
-- gambar, ditambahkan_pada.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tabel eksemplar fisik
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eksemplar_buku (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buku_id UUID NOT NULL REFERENCES public.buku(id) ON DELETE CASCADE,
  nomor_inventaris TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'tersedia',
  kondisi_fisik TEXT NOT NULL DEFAULT 'layak',
  tanggal_pengadaan DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diedit_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT eksemplar_status_chk
    CHECK (status IN ('tersedia', 'dipinjam', 'rusak', 'hilang')),
  CONSTRAINT eksemplar_kondisi_chk
    CHECK (kondisi_fisik IN ('layak', 'rusak_ringan', 'rusak_beda', 'hilang'))
);

-- Nomor inventaris unik di seluruh sistem (boleh kosong saat impor bertahap).
CREATE UNIQUE INDEX IF NOT EXISTS idx_eksemplar_buku_nomor_inventaris
  ON public.eksemplar_buku (nomor_inventaris)
  WHERE nomor_inventaris <> '';

CREATE INDEX IF NOT EXISTS idx_eksemplar_buku_buku_id
  ON public.eksemplar_buku (buku_id);

CREATE INDEX IF NOT EXISTS idx_eksemplar_buku_status
  ON public.eksemplar_buku (status);

-- Satu judul hanya boleh punya satu eksemplar berstatus 'dipinjam' pada satu
-- waktu (sirkulasi menandai eksemplar yang benar-benar keluar).
CREATE UNIQUE INDEX IF NOT EXISTS idx_eksemplar_buku_status_dipinjam
  ON public.eksemplar_buku (buku_id)
  WHERE status = 'dipinjam';

-- ---------------------------------------------------------------------
-- 2. View ringkasan inventaris per judul
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_inventaris_per_buku AS
SELECT
  b.id AS buku_id,
  b.judul,
  b.penulis,
  b.penerbit,
  b.tahun,
  b.isbn,
  b.kategori,
  b.rak,
  b.stok,
  COUNT(e.id)::int AS total_eksemplar,
  COUNT(e.id) FILTER (WHERE e.status = 'tersedia')::int AS tersedia,
  COUNT(e.id) FILTER (WHERE e.status = 'dipinjam')::int AS dipinjam,
  COUNT(e.id) FILTER (WHERE e.status = 'rusak')::int AS rusak,
  COUNT(e.id) FILTER (WHERE e.status = 'hilang')::int AS hilang
FROM public.buku b
LEFT JOIN public.eksemplar_buku e ON e.buku_id = b.id
GROUP BY b.id;

-- ---------------------------------------------------------------------
-- 3. Sinkronisasi stok otomatis
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sinkronisasi_stok_buku()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.buku b
  SET stok = v.total
  FROM (
    SELECT buku_id, COUNT(*)::int AS total
    FROM public.eksemplar_buku
    GROUP BY buku_id
  ) v
  WHERE b.id = v.buku_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sinkronisasi_stok_buku ON public.eksemplar_buku;

CREATE TRIGGER trg_sinkronisasi_stok_buku
AFTER INSERT OR UPDATE OF buku_id, status OR DELETE ON public.eksemplar_buku
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_sinkronisasi_stok_buku();

-- ---------------------------------------------------------------------
-- 4. RLS + hak akses
-- ---------------------------------------------------------------------
ALTER TABLE public.eksemplar_buku ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eksemplar_buku_lihat ON public.eksemplar_buku;
CREATE POLICY eksemplar_buku_lihat
ON public.eksemplar_buku
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS eksemplar_buku_tambah ON public.eksemplar_buku;
CREATE POLICY eksemplar_buku_tambah
ON public.eksemplar_buku
FOR INSERT
TO public
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS eksemplar_buku_ubah ON public.eksemplar_buku;
CREATE POLICY eksemplar_buku_ubah
ON public.eksemplar_buku
FOR UPDATE
TO public
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS eksemplar_buku_hapus ON public.eksemplar_buku;
CREATE POLICY eksemplar_buku_hapus
ON public.eksemplar_buku
FOR DELETE
TO public
USING (public.is_admin());

GRANT SELECT ON TABLE public.eksemplar_buku TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eksemplar_buku TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eksemplar_buku TO service_role;
GRANT SELECT ON TABLE public.v_inventaris_per_buku TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Samakan stok buku yang sudah punya eksemplar
-- ---------------------------------------------------------------------
UPDATE public.buku b
SET stok = v.total
FROM (
  SELECT buku_id, COUNT(*)::int AS total
  FROM public.eksemplar_buku
  GROUP BY buku_id
) v
WHERE b.id = v.buku_id
  AND b.stok <> v.total;

COMMIT;
