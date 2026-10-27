-- =====================================================================
-- PustakaKu — 0002 Fungsi izin + baris bawaan
-- Sumber kebenaran matriks izin: tabel kebijakan_akses, dengan isi awal
-- identik KEBIJAKAN_BAWAAN di src/lib/izin.ts (default-deny).
-- =====================================================================

-- Pusat pengecekan izin di database: DEFAULT-DENY.
-- Izin tak dikenal, peran tak dikenal, atau tabel kosong → false.
create or replace function public.boleh(p_izin text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select k.izin -> public.app_peran() ->> p_izin
        from public.kebijakan_akses k
       where k.id
    ) = 'true',
    false
  );
$$;

comment on function public.boleh(text) is
  'Cek matriks izin (peran x izin) persis seperti cekIzin() di src/lib/izin.ts.';

-- ---------------------------------------------------------------------
-- Baris bawaan: matriks kebijakan akses (18 izin x 3 peran)
-- ---------------------------------------------------------------------
insert into public.kebijakan_akses (id, versi, izin, diubah_pada, diubah_oleh)
values (
  true,
  1,
  '{
    "tamu": {
      "katalog.lihat": true,
      "katalog.pinjam": false,
      "katalog.kelola": false,
      "panel.lihat": false,
      "panel.pinjaman": false,
      "panel.profil": false,
      "panel.bantuan": false,
      "dashboard.lihat": false,
      "sirkulasi.lihat": false,
      "sirkulasi.kelola": false,
      "anggota.lihat": false,
      "anggota.kelola": false,
      "laporan.lihat": false,
      "laporan.ekspor": false,
      "akun.daftar": true,
      "akun.kelola": false,
      "pengaturan.kelola": false,
      "sistem.reset": false
    },
    "user": {
      "katalog.lihat": true,
      "katalog.pinjam": true,
      "katalog.kelola": false,
      "panel.lihat": true,
      "panel.pinjaman": true,
      "panel.profil": true,
      "panel.bantuan": true,
      "dashboard.lihat": false,
      "sirkulasi.lihat": false,
      "sirkulasi.kelola": false,
      "anggota.lihat": false,
      "anggota.kelola": false,
      "laporan.lihat": false,
      "laporan.ekspor": false,
      "akun.daftar": false,
      "akun.kelola": false,
      "pengaturan.kelola": false,
      "sistem.reset": false
    },
    "admin": {
      "katalog.lihat": true,
      "katalog.pinjam": false,
      "katalog.kelola": true,
      "panel.lihat": false,
      "panel.pinjaman": false,
      "panel.profil": true,
      "panel.bantuan": true,
      "dashboard.lihat": true,
      "sirkulasi.lihat": true,
      "sirkulasi.kelola": true,
      "anggota.lihat": true,
      "anggota.kelola": true,
      "laporan.lihat": true,
      "laporan.ekspor": true,
      "akun.daftar": false,
      "akun.kelola": true,
      "pengaturan.kelola": true,
      "sistem.reset": true
    }
  }'::jsonb,
  now(),
  'migrasi'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Baris bawaan: pengaturan sistem (nilai sama dengan SISTEM_DEFAULT)
-- ---------------------------------------------------------------------
insert into public.pengaturan_sistem
  (id, nama, tagline, lama_pinjam, denda_per_hari, maks_pinjaman, diubah_pada, diubah_oleh)
values
  (true, 'PustakaKu', 'Sistem Perpustakaan', 14, 2000, 5, now(), 'migrasi')
on conflict (id) do nothing;
