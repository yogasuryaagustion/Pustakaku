
BEGIN;

-- =====================================================
-- 1. JWT ROLE: TANPA JWT TIDAK OTOMATIS MENJADI SUPERUSER
-- =====================================================

CREATE OR REPLACE FUNCTION public.jwt_peran()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      current_setting('request.jwt.claims', true),
      ''
    )::jsonb ->> 'role',
    'anon'
  );
$$;


-- =====================================================
-- 2. FUNGSI PEMERIKSAAN SUPER ADMIN
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.jwt_peran() = 'service_role'
    OR public.app_peran() = 'superadmin';
$$;


-- =====================================================
-- 3. FUNGSI PEMERIKSAAN ADMIN UMUM
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.jwt_peran() = 'service_role'
    OR public.app_peran() IN ('superadmin', 'admin');
$$;


-- =====================================================
-- 4. KEBIJAKAN AKSES: HANYA SUPER ADMIN
-- =====================================================

DROP POLICY IF EXISTS kebijakan_tambah
ON public.kebijakan_akses;

CREATE POLICY kebijakan_tambah
ON public.kebijakan_akses
FOR INSERT
TO public
WITH CHECK (public.is_superadmin());


DROP POLICY IF EXISTS kebijakan_ubah
ON public.kebijakan_akses;

CREATE POLICY kebijakan_ubah
ON public.kebijakan_akses
FOR UPDATE
TO public
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());


DROP POLICY IF EXISTS kebijakan_hapus
ON public.kebijakan_akses;

CREATE POLICY kebijakan_hapus
ON public.kebijakan_akses
FOR DELETE
TO public
USING (public.is_superadmin());


-- =====================================================
-- 5. PENGATURAN SISTEM: HANYA SUPER ADMIN
-- =====================================================

DROP POLICY IF EXISTS pengaturan_tambah
ON public.pengaturan_sistem;

CREATE POLICY pengaturan_tambah
ON public.pengaturan_sistem
FOR INSERT
TO public
WITH CHECK (public.is_superadmin());


DROP POLICY IF EXISTS pengaturan_ubah
ON public.pengaturan_sistem;

CREATE POLICY pengaturan_ubah
ON public.pengaturan_sistem
FOR UPDATE
TO public
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());


DROP POLICY IF EXISTS pengaturan_hapus
ON public.pengaturan_sistem;

CREATE POLICY pengaturan_hapus
ON public.pengaturan_sistem
FOR DELETE
TO public
USING (public.is_superadmin());


-- =====================================================
-- 6. PROFIL: PENGHAPUSAN HANYA SUPER ADMIN
-- =====================================================

DROP POLICY IF EXISTS profiles_hapus
ON public.profiles;

CREATE POLICY profiles_hapus
ON public.profiles
FOR DELETE
TO public
USING (public.is_superadmin());


-- =====================================================
-- 7. LOG AKTIVITAS: PENGHAPUSAN HANYA SUPER ADMIN
-- =====================================================

DROP POLICY IF EXISTS log_hapus
ON public.log_aktivitas;

CREATE POLICY log_hapus
ON public.log_aktivitas
FOR DELETE
TO public
USING (public.is_superadmin());


-- =====================================================
-- 8. PEMINJAMAN: PENGHAPUSAN HANYA SUPER ADMIN
-- =====================================================

DROP POLICY IF EXISTS peminjaman_hapus
ON public.peminjaman;

CREATE POLICY peminjaman_hapus
ON public.peminjaman
FOR DELETE
TO public
USING (public.is_superadmin());


COMMIT;
