-- =====================================================================
-- PustakaKu — 0003 Row Level Security
-- Prinsip: DEFAULT-DENY + peran + kepemilikan data.
--   * Matriks izin dibaca dari tabel kebijakan_akses (public.boleh()),
--     sehingga kebijakan yang diketik admin di /admin/akses berlaku juga
--     di database, bukan hanya di tampilan.
--   * Klien browser TIDAK pernah memegang kunci service role; route handler
--     memakai klien berbasis sesi sehingga RLS ini ikut menegakkan aturan.
--   * Peminjaman/pengembalian/perpanjaman hanya lewat fungsi RPC (0004)
--     yang mengecek izin + stok secara atomik.
-- =====================================================================

alter table public.anggota           enable row level security;
alter table public.profiles          enable row level security;
alter table public.buku              enable row level security;
alter table public.peminjaman        enable row level security;
alter table public.kebijakan_akses   enable row level security;
alter table public.pengaturan_sistem enable row level security;
alter table public.log_aktivitas     enable row level security;

-- ---------------------------------------------------------------------
-- buku — katalog boleh dilihat siapa pun sesuai izin; kelola hanya admin
-- ---------------------------------------------------------------------
create policy buku_lihat on public.buku
  for select using (public.boleh('katalog.lihat'));

create policy buku_tambah on public.buku
  for insert with check (public.boleh('katalog.kelola'));

create policy buku_ubah on public.buku
  for update
  using      (public.boleh('katalog.kelola'))
  with check (public.boleh('katalog.kelola'));

create policy buku_hapus on public.buku
  for delete using (public.boleh('katalog.kelola'));

-- ---------------------------------------------------------------------
-- anggota — lihat sesuai izin + selalu boleh membaca kartu sendiri
-- ---------------------------------------------------------------------
create policy anggota_lihat on public.anggota
  for select using (
    public.boleh('anggota.lihat')
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.anggota_id = public.anggota.id
    )
  );

create policy anggota_tambah on public.anggota
  for insert with check (public.boleh('anggota.kelola'));

create policy anggota_ubah on public.anggota
  for update
  using (
    public.boleh('anggota.kelola')
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.anggota_id = public.anggota.id
    )
  )
  with check (
    public.boleh('anggota.kelola')
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.anggota_id = public.anggota.id
    )
  );

create policy anggota_hapus on public.anggota
  for delete using (public.boleh('anggota.kelola'));

-- ---------------------------------------------------------------------
-- profiles — akun membaca profilnya sendiri; admin membaca semua
-- (INSERT ditangani pemicu saat signUp; UPDATE oleh server / halaman profil)
-- ---------------------------------------------------------------------
create policy profiles_lihat on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_tambah on public.profiles
  for insert with check (public.is_admin());

create policy profiles_ubah on public.profiles
  for update
  using      (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_hapus on public.profiles
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- peminjaman — baca: petugas/laporan sesuai izin, anggota hanya miliknya.
-- Tulis lewat RPC (0004); kebijakan insert/update di bawah hanya untuk
-- impor data lama yang dijalankan admin.
-- ---------------------------------------------------------------------
create policy peminjaman_lihat on public.peminjaman
  for select using (
    public.boleh('sirkulasi.lihat')
    or public.boleh('laporan.lihat')
    or (
      public.boleh('panel.pinjaman')
      and exists (
        select 1
          from public.profiles p
          join public.anggota a on a.id = p.anggota_id
         where p.id = auth.uid() and a.id = public.peminjaman.anggota_id
      )
    )
  );

create policy peminjaman_tambah on public.peminjaman
  for insert with check (public.boleh('sirkulasi.kelola'));

create policy peminjaman_ubah on public.peminjaman
  for update
  using      (public.boleh('sirkulasi.kelola'))
  with check (public.boleh('sirkulasi.kelola'));

create policy peminjaman_hapus on public.peminjaman
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- kebijakan_akses — matriks izin terbuka untuk semua (dipakai seluruh UI
-- untuk menampilkan/menyembunyikan menu); hanya admin yang boleh menulis.
-- ---------------------------------------------------------------------
create policy kebijakan_lihat on public.kebijakan_akses
  for select using (true);

create policy kebijakan_tambah on public.kebijakan_akses
  for insert with check (public.is_admin());

create policy kebijakan_ubah on public.kebijakan_akses
  for update
  using      (public.is_admin())
  with check (public.is_admin());

create policy kebijakan_hapus on public.kebijakan_akses
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- pengaturan_sistem — nilai tampil publik (nama, lama pinjam, denda);
-- perubahan hanya admin.
-- ---------------------------------------------------------------------
create policy pengaturan_lihat on public.pengaturan_sistem
  for select using (true);

create policy pengaturan_tambah on public.pengaturan_sistem
  for insert with check (public.is_admin());

create policy pengaturan_ubah on public.pengaturan_sistem
  for update
  using      (public.is_admin())
  with check (public.is_admin());

create policy pengaturan_hapus on public.pengaturan_sistem
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- log_aktivitas — admin membaca semua; pengguna biasa hanya jejak miliknya
-- (aktor_id = akun sendiri, atau anggota_id = kartu yang terdampak).
-- kolom aktor_id/anggota_id diisi SERVER dari sesi — tidak dipercaya dari klien.
-- ---------------------------------------------------------------------
create policy log_lihat on public.log_aktivitas
  for select using (
    public.is_admin()
    or aktor_id = auth.uid()
    or (
      anggota_id is not null
      and anggota_id = (select p.anggota_id from public.profiles p where p.id = auth.uid())
    )
  );

create policy log_tambah on public.log_aktivitas
  for insert with check (
    auth.uid() is not null
    and (aktor_id is null or aktor_id = auth.uid() or public.is_admin())
    and (
      anggota_id is null
      or public.is_admin()
      or anggota_id = (select p.anggota_id from public.profiles p where p.id = auth.uid())
    )
  );

create policy log_hapus on public.log_aktivitas
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- Identitas penulis jejak SELALU dari sesi — tidak pernah dari body klien,
-- sehingga jejak tidak bisa dipalsukan (mengikuti janji src/lib/audit.ts).
-- ---------------------------------------------------------------------
create or replace function public.jaga_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.jwt_peran() = 'authenticated' and public.app_peran() <> 'admin' then
    select p.nama into new.aktor from public.profiles p where p.id = auth.uid();
    new.aktor_id   := auth.uid();
    new.anggota_id := (
      select p.anggota_id from public.profiles p where p.id = auth.uid()
    );
    new.peran := public.app_peran();
    new.aktor := coalesce(nullif(new.aktor, ''), 'Anggota');
  end if;
  return new;
end;
$$;

create trigger trg_jaga_log before insert on public.log_aktivitas
  for each row execute function public.jaga_log();
