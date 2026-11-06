-- 202611060001_opname.sql
-- Tujuan:
-- 1) Menyimpan sesi stock opname beserta baris pemeriksaannya.
-- 2) Menyediakan fungsi rekonsiliasi stok buku dari data eksemplar fisik.
--
-- Stock opname = pencocokan jumlah/keadaan fisik (eksemplar_buku) dengan
-- catatan sistem (buku.stok) pada satu waktu, lalu hasilnya disimpan sebagai
-- riwayat yang bisa ditinjau ulang.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Sesi opname
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL DEFAULT '',
  komentar TEXT,
  jumlah_dibandingkan INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_dibandingkan >= 0),
  jumlah_ditemukan INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_ditemukan >= 0),
  jumlah_tidak_ditemukan INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_tidak_ditemukan >= 0),
  selisih INTEGER NOT NULL DEFAULT 0,
  dikerjakan_bynama TEXT NOT NULL DEFAULT '',
  dikerjakan_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opname_dibuat_pada
  ON public.opname (dibuat_pada DESC);

-- ---------------------------------------------------------------------
-- 2. Baris opname (satu baris = satu eksemplar yang diperiksa)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opname_baris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES public.opname(id) ON DELETE CASCADE,
  eksemplar_id UUID REFERENCES public.eksemplar_buku(id) ON DELETE SET NULL,
  buku_id UUID REFERENCES public.buku(id) ON DELETE SET NULL,
  nomor_inventaris TEXT NOT NULL DEFAULT '',
  judul TEXT NOT NULL DEFAULT '',
  status_sistem TEXT NOT NULL DEFAULT '',
  kondisi_sistem TEXT NOT NULL DEFAULT '',
  ditemukan BOOLEAN NOT NULL DEFAULT FALSE,
  jumlah_fisik INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_fisik >= 0),
  status_fisik TEXT,
  kondisi_fisik TEXT,
  keterangan TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opname_baris_opname
  ON public.opname_baris (opname_id);

-- ---------------------------------------------------------------------
-- 3. Rekonsiliasi stok: stok buku = jumlah eksemplar fisik
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rekonsiliasi_stok_inventaris()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jumlah integer := 0;
BEGIN
  WITH hitung AS (
    SELECT buku_id, COUNT(*)::int AS total
    FROM public.eksemplar_buku
    WHERE buku_id IS NOT NULL
    GROUP BY buku_id
  ), ubah AS (
    UPDATE public.buku b
    SET stok = h.total
    FROM hitung h
    WHERE b.id = h.buku_id
      AND b.stok <> h.total
    RETURNING b.id
  )
  SELECT COUNT(*)::int INTO jumlah FROM ubah;

  RETURN jumlah;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. RLS + hak akses
-- ---------------------------------------------------------------------
ALTER TABLE public.opname ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opname_baris ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opname_lihat ON public.opname;
CREATE POLICY opname_lihat
ON public.opname
FOR SELECT
TO public
USING (public.is_admin());

DROP POLICY IF EXISTS opname_tambah ON public.opname;
CREATE POLICY opname_tambah
ON public.opname
FOR INSERT
TO public
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS opname_ubah ON public.opname;
CREATE POLICY opname_ubah
ON public.opname
FOR UPDATE
TO public
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS opname_hapus ON public.opname;
CREATE POLICY opname_hapus
ON public.opname
FOR DELETE
TO public
USING (public.is_admin());

DROP POLICY IF EXISTS opname_baris_lihat ON public.opname_baris;
CREATE POLICY opname_baris_lihat
ON public.opname_baris
FOR SELECT
TO public
USING (public.is_admin());

DROP POLICY IF EXISTS opname_baris_tambah ON public.opname_baris;
CREATE POLICY opname_baris_tambah
ON public.opname_baris
FOR INSERT
TO public
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS opname_baris_ubah ON public.opname_baris;
CREATE POLICY opname_baris_ubah
ON public.opname_baris
FOR UPDATE
TO public
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS opname_baris_hapus ON public.opname_baris;
CREATE POLICY opname_baris_hapus
ON public.opname_baris
FOR DELETE
TO public
USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.opname TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.opname_baris TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rekonsiliasi_stok_inventaris() TO authenticated, service_role;

COMMIT;
