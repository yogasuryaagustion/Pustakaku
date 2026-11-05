BEGIN;

-- =====================================================
-- 1. FUNGSI PERLINDUNGAN SUPER ADMIN TERAKHIR
-- =====================================================

CREATE OR REPLACE FUNCTION public.cegah_superadmin_terakhir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    jumlah_superadmin integer;
BEGIN

    -- Kunci transaksi agar perubahan peran dan penghapusan
    -- Super Admin diperiksa secara bergantian.
    PERFORM pg_advisory_xact_lock(20261102000200::bigint);

    -- =================================================
    -- A. KETIKA PERAN SUPER ADMIN DIUBAH
    -- =================================================

    IF TG_OP = 'UPDATE' THEN

        -- Tidak perlu pemeriksaan jika peran tidak berubah.
        IF OLD.peran IS DISTINCT FROM NEW.peran
           AND OLD.peran = 'superadmin' THEN

            SELECT COUNT(*)
            INTO jumlah_superadmin
            FROM public.profiles
            WHERE peran = 'superadmin'
              AND id <> OLD.id;

            IF jumlah_superadmin = 0 THEN
                RAISE EXCEPTION
                    'Tidak dapat menurunkan peran Super Admin terakhir. Sistem harus memiliki minimal satu Super Admin.'
                    USING ERRCODE = '23514';
            END IF;

        END IF;

        RETURN NEW;
    END IF;

    -- =================================================
    -- B. KETIKA PROFIL SUPER ADMIN DIHAPUS
    -- =================================================

    IF TG_OP = 'DELETE' THEN

        IF OLD.peran = 'superadmin' THEN

            SELECT COUNT(*)
            INTO jumlah_superadmin
            FROM public.profiles
            WHERE peran = 'superadmin'
              AND id <> OLD.id;

            IF jumlah_superadmin = 0 THEN
                RAISE EXCEPTION
                    'Tidak dapat menghapus Super Admin terakhir. Sistem harus memiliki minimal satu Super Admin.'
                    USING ERRCODE = '23514';
            END IF;

        END IF;

        RETURN OLD;
    END IF;

    RETURN NULL;

END;
$function$;


-- =====================================================
-- 2. TRIGGER UNTUK UPDATE PERAN
-- =====================================================

DROP TRIGGER IF EXISTS trg_cegah_superadmin_update
ON public.profiles;

CREATE TRIGGER trg_cegah_superadmin_update
BEFORE UPDATE OF peran
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cegah_superadmin_terakhir();


-- =====================================================
-- 3. TRIGGER UNTUK DELETE PROFIL
-- =====================================================

DROP TRIGGER IF EXISTS trg_cegah_superadmin_delete
ON public.profiles;

CREATE TRIGGER trg_cegah_superadmin_delete
BEFORE DELETE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cegah_superadmin_terakhir();


COMMIT;