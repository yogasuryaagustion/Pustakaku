-- =====================================================================
-- PustakaKu — 0006 Fungsi pendukung + perbaikan aturan tautan kartu
--
--   1. jaga_profil()  — perbaikan: kini mengizinkan penautan kartu anggota
--                       pertama kali, TETAPI hanya bila email kartu sama
--                      dengan email akun (mencegah penautan kartu orang lain).
--   2. nomor_anggota_baru()  — nomor AGT-XXXX otomatis dari sekuens.
--   3. jumlah_dipinjam()     — agregat ketersediaan per buku TANPA data
--                       pribadi, dipakai katalog (termasuk untuk tamu).
--   4. daftar_kartu()  — membuat kartu anggota saat pendaftaran publik
--                       (RLS menolak INSERT bagi tamu, jadi lewat fungsi ini).
--   5. sinkron_sekuens()— menyamakan sekuens dengan data impor lama.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Aturan tautan kartu (menimpa definisi di 0001)
-- ---------------------------------------------------------------------
create or replace function public.jaga_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.jwt_peran() = 'authenticated'
     and public.app_peran() <> 'admin' then
    -- Peningkatan hak diri sendiri dicegah di tingkat database.
    new.peran := old.peran;

    -- Tautan kartu: hanya sekali, hanya kartu ber-email sama dengan akun.
    if new.anggota_id is distinct from old.anggota_id then
      if old.anggota_id is not null then
        new.anggota_id := old.anggota_id;                    -- sudah tertaut → kunci
      elsif new.anggota_id is not null then
        if not exists (
          select 1 from public.anggota a
           where a.id = new.anggota_id
             and a.email <> ''
             and lower(a.email) = lower(new.email)
        ) then
          new.anggota_id := old.anggota_id;                  -- email berbeda → tolak
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Nomor kartu baru
-- ---------------------------------------------------------------------
create or replace function public.nomor_anggota_baru() returns text
language sql security definer set search_path = public as $$
  select 'AGT-' || lpad(nextval('public.nomor_anggota_seq')::text, 4, '0');
$$;

-- ---------------------------------------------------------------------
-- 3. Jumlah peminjaman aktif per buku (tanpa identitas peminjam)
-- ---------------------------------------------------------------------
create or replace function public.jumlah_dipinjam()
returns table (buku_id uuid, jumlah bigint)
language sql stable security definer set search_path = public as $$
  select p.buku_id, count(*)::bigint
    from public.peminjaman p
   where p.status = 'Dipinjam'
   group by p.buku_id;
$$;

-- ---------------------------------------------------------------------
-- 4. Kartu anggota untuk pendaftaran
--    - tanpa sesi : hanya bila kebijakan mengizinkan `akun.daftar` untuk tamu
--    - dengan sesi: kartu wajib ber-email sama dengan akun yang masuk
--    - email kartu sudah ada → kartu lama dipakai kembali (anti duplikat)
-- ---------------------------------------------------------------------
create or replace function public.daftar_kartu(
  p_nama text,
  p_email text,
  p_telepon text default '',
  p_alamat text default '',
  p_jenis text default 'Umum',
  p_foto text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_nomor  text;
  v_izin   text;
  v_jenis  text := case when p_jenis in ('Pelajar', 'Umum', 'Staf') then p_jenis else 'Umum' end;
begin
  if char_length(trim(coalesce(p_nama, ''))) < 3 then
    raise exception 'Nama minimal 3 karakter.';
  end if;
  if p_email is null or p_email = '' then
    raise exception 'Email kartu anggota wajib diisi.';
  end if;

  if auth.uid() is null then
    select coalesce(k.izin -> 'tamu' ->> 'akun.daftar', 'false')
      into v_izin from public.kebijakan_akses k where k.id;
    if coalesce(v_izin, 'false') <> 'true' then
      raise exception 'Pendaftaran sedang ditutup oleh kebijakan akses. Hubungi pustakawan.';
    end if;
  else
    if not exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and lower(p.email) = lower(p_email)
    ) then
      raise exception 'Email kartu anggota harus sama dengan email akun.';
    end if;
  end if;

  -- Sudah ada kartu dengan email ini? pakai kembali (idempoten).
  select a.id into v_id from public.anggota a
   where lower(a.email) = lower(p_email) order by a.created_at limit 1;
  if v_id is not null then
    return (select to_jsonb(a) from public.anggota a where a.id = v_id);
  end if;

  v_nomor := 'AGT-' || lpad(nextval('public.nomor_anggota_seq')::text, 4, '0');
  insert into public.anggota (nomor_anggota, nama, email, telepon, alamat, jenis, foto)
  values (v_nomor, trim(p_nama), lower(p_email),
          coalesce(p_telepon, ''), coalesce(p_alamat, ''), v_jenis,
          nullif(coalesce(p_foto, ''), ''))
  returning id into v_id;

  return (select to_jsonb(a) from public.anggota a where a.id = v_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Sinkronkan sekuens dengan data impor (dijalankan setelah impor lama)
-- ---------------------------------------------------------------------
create or replace function public.sinkron_sekuens() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_agt bigint;
  v_pin bigint;
begin
  select coalesce(max(case when regexp_replace(nomor_anggota, '\D', '', 'g') ~ '^[0-9]+$'
                           then regexp_replace(nomor_anggota, '\D', '', 'g')::bigint end), 0)
    into v_agt from public.anggota;
  if v_agt > (select last_value from public.nomor_anggota_seq) then
    perform setval('public.nomor_anggota_seq', v_agt, true);
  end if;

  select coalesce(max(case when regexp_replace(kode_pinjam, '\D', '', 'g') ~ '^[0-9]+$'
                           then regexp_replace(kode_pinjam, '\D', '', 'g')::bigint end), 0)
    into v_pin from public.peminjaman;
  if v_pin > (select last_value from public.kode_pinjam_seq) then
    perform setval('public.kode_pinjam_seq', v_pin, true);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Hak eksekusi
-- ---------------------------------------------------------------------
revoke execute on function public.nomor_anggota_baru()                        from public;
revoke execute on function public.jumlah_dipinjam()                           from public;
revoke execute on function public.daftar_kartu(text, text, text, text, text, text) from public;
revoke execute on function public.sinkron_sekuens()                            from public;

-- ketersediaan stok: publik (hanya angka, tanpa identitas)
grant execute on function public.jumlah_dipinjam() to anon, authenticated, service_role;
-- pendaftaran: tamu maupun sesi login
grant execute on function public.daftar_kartu(text, text, text, text, text, text) to anon, authenticated, service_role;
-- hanya sesi login (dipakai endpoint admin)
grant execute on function public.nomor_anggota_baru() to authenticated, service_role;
grant execute on function public.sinkron_sekuens()     to authenticated, service_role;
