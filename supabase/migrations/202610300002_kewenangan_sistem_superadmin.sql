-- =====================================================================
-- PustakaKu — 0002 Kewenangan sistem menempel pada Super Admin
--
-- Menyusul 202610300001_peran_superadmin.sql. Migrasi sebelumnya mengisi
-- kunci izin yang hilang tanpa menimpa nilai tersimpan, sehingga baris
-- yang berasal dari rilis lama masih menyimpan:
--
--     admin.akun.kelola / admin.pengaturan.kelola / admin.sistem.reset = true
--
-- Padahal kebijakan 3 peran menetapkan ketiganya hanya untuk Super Admin
-- (Admin = operasional: dashboard, katalog, sirkulasi, anggota, statistik
-- kunjungan, laporan). Berlaku idempoten — aman dijalankan berulang.
-- =====================================================================

do $$
declare
  m jsonb;
  k text;
  sistem jsonb := '{
    "tamu":       {"akun.kelola": false, "pengaturan.kelola": false, "sistem.reset": false},
    "user":       {"akun.kelola": false, "pengaturan.kelola": false, "sistem.reset": false},
    "admin":      {"akun.kelola": false, "pengaturan.kelola": false, "sistem.reset": false},
    "superadmin": {"akun.kelola": true,  "pengaturan.kelola": true,  "sistem.reset": true}
  }'::jsonb;
begin
  select coalesce(k2.izin, '{}'::jsonb) into m from public.kebijakan_akses k2 where k2.id;

  if m is null or m = '{}'::jsonb then
    raise exception
      'Baris kebijakan_akses masih kosong — jalankan 202610300001_peran_superadmin.sql lebih dulu.';
  end if;

  foreach k in array array['tamu', 'user', 'admin', 'superadmin'] loop
    m := m || jsonb_build_object(
      k, coalesce(m->k, '{}'::jsonb) || coalesce(sistem->k, '{}'::jsonb)
    );
  end loop;

  update public.kebijakan_akses
     set izin = m,
         diubah_pada = now(),
         diubah_oleh = 'migrasi 3 peran — kewenangan sistem'
   where id;

  -- Buang cache matriks izin di API (TTL 30 dtk) supaya berlaku seketika:
  -- tidak ada cara SQL memaksa proses Node lain, jadi nilai segar terbaca
  -- paling lama satu TTL setelah migrasi ini dijalankan.
end;
$$;
