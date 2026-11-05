-- PustakaKu — registrasi anggota atomik dan jenis Mahasiswa.
-- Aman untuk skema yang sudah ada: tidak membuat tabel/route baru dan tidak
-- menghapus atau mengubah data anggota yang sudah tersimpan.

-- Skema sebelumnya tidak mengenal Mahasiswa (form baru menerimanya).
alter table public.anggota drop constraint if exists anggota_jenis_check;
alter table public.anggota
  add constraint anggota_jenis_check
  check (jenis in ('Pelajar', 'Mahasiswa', 'Umum', 'Staf'));

-- Pertahankan nomor yang sudah ada; nomor berikutnya tetap dihasilkan oleh
-- sekuens PostgreSQL atomik, bukan dengan menghitung baris di aplikasi.
do $$
declare
  v_maks bigint;
  v_terakhir bigint;
begin
  select coalesce(max(nullif(regexp_replace(nomor_anggota, '[^0-9]', '', 'g'), '')::bigint), 0)
    into v_maks
    from public.anggota
   where nomor_anggota ~ '[0-9]';
  select last_value into v_terakhir from public.nomor_anggota_seq;
  if v_maks > v_terakhir then
    perform setval('public.nomor_anggota_seq', v_maks, true);
  end if;
end;
$$;

-- Auth.users + profiles + anggota lahir dalam transaksi trigger Auth yang sama.
-- Kartu untuk email terverifikasi dipakai ulang bila tersedia (idempoten);
-- kartu aktif/nonaktif maupun nomor lama tidak diubah.
create or replace function public.saat_akun_dibuat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nama text;
  v_jenis text;
  v_anggota_id uuid;
begin
  v_nama := left(trim(coalesce(v_meta ->> 'nama', '')), 120);
  if char_length(v_nama) < 3 then
    v_nama := left(trim(split_part(coalesce(new.email, ''), '@', 1)), 120);
  end if;
  if char_length(v_nama) < 3 then
    v_nama := 'Anggota';
  end if;

  -- Signup publik menerima data pilihan anggota. Metadata tidak pernah memuat
  -- status/role/nomor; role tetap literal 'user' dan status default aktif.
  v_jenis := case
    when v_meta ->> 'jenis' in ('Pelajar', 'Mahasiswa', 'Umum') then v_meta ->> 'jenis'
    else 'Umum'
  end;

  -- Jangan terbitkan kartu aktif untuk alamat yang belum diverifikasi.
  -- Trigger yang sama dipanggil lagi ketika Auth mengisi email_confirmed_at;
  -- proyek yang mematikan verifikasi sudah memiliki timestamp saat signup.
  if new.email_confirmed_at is not null then
    -- Pertama coba tautkan kartu yang memang telah ada dengan email ini.
    if new.email is not null then
      select a.id into v_anggota_id
        from public.anggota a
       where a.email <> '' and lower(a.email) = lower(new.email)
       order by a.created_at
       limit 1;
    end if;

    if v_anggota_id is null then
      insert into public.anggota
        (nomor_anggota, nama, email, telepon, alamat, jenis, foto)
      values
        (
          'AGT-' || lpad(nextval('public.nomor_anggota_seq')::text, 4, '0'),
          v_nama,
          coalesce(lower(new.email), ''),
          left(trim(coalesce(v_meta ->> 'telepon', '')), 40),
          left(trim(coalesce(v_meta ->> 'alamat', '')), 500),
          v_jenis,
          case
            when char_length(coalesce(v_meta ->> 'foto', '')) <= 400000
             and v_meta ->> 'foto' ~* '^data:image/(jpeg|png|webp);base64,'
              then v_meta ->> 'foto'
            else null
          end
        )
      on conflict (lower(email)) where email <> '' do nothing
      returning id into v_anggota_id;

      -- Menangani dua pendaftaran bersamaan untuk email anggota yang sama.
      if v_anggota_id is null then
        select a.id into v_anggota_id
          from public.anggota a
         where a.email <> '' and lower(a.email) = lower(new.email)
         limit 1;
      end if;
    end if;
  end if;

  insert into public.profiles (id, nama, email, peran, anggota_id)
  values (new.id, v_nama, new.email, 'user', v_anggota_id)
  on conflict (id) do nothing;

  -- Profil Auth baru hanya boleh menjadi role anggota. Email Auth harus unik.
  -- Jika trigger dipanggil lagi karena migrasi/recovery, identitas role dan
  -- kartu yang telah ditetapkan admin tidak ditimpa oleh metadata publik.
  update public.profiles
     set email = coalesce(new.email, email),
         anggota_id = coalesce(anggota_id, v_anggota_id)
   where id = new.id;
  return new;
end;
$$;

-- Existing trg_auth_daftar previously ran only on INSERT. Recreate it to also
-- create/link the membership card transactionally when email verification is
-- completed; duplicate confirmation updates remain safe and idempotent.
drop trigger if exists trg_auth_daftar on auth.users;
create trigger trg_auth_daftar
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.saat_akun_dibuat();

-- Atomic recovery for an account whose registration predates this migration.
-- Caller must be the authenticated, verified member and own this profile.
create or replace function public.lengkapi_kartu_saya(
  p_telepon text default '',
  p_alamat text default '',
  p_jenis text default 'Umum',
  p_foto text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_profil public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu.'; end if;
  select * into v_profil from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profil anggota tidak ditemukan.'; end if;
  if v_profil.peran <> 'user' then raise exception 'Kartu hanya dapat dilengkapi oleh akun anggota.'; end if;
  if v_profil.anggota_id is not null then return v_profil.anggota_id; end if;
  if v_profil.email is null or v_profil.email = '' then raise exception 'Email profil tidak valid.'; end if;
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'Konfirmasi email sebelum membuat kartu anggota.';
  end if;
  if p_telepon is null or trim(p_telepon) = '' or char_length(p_telepon) > 40 then
    raise exception 'Nomor telepon wajib diisi dan maksimal 40 karakter.';
  end if;
  if char_length(coalesce(p_alamat, '')) > 500 then raise exception 'Alamat maksimal 500 karakter.'; end if;
  if p_foto is not null and (char_length(p_foto) > 400000 or p_foto !~* '^data:image/(jpeg|png|webp);base64,') then
    raise exception 'Format atau ukuran foto tidak valid.';
  end if;

  select id into v_id from public.anggota where lower(email) = lower(v_profil.email) limit 1;
  if v_id is null then
    if coalesce(p_telepon, '') = '' then raise exception 'Nomor telepon wajib diisi.'; end if;
    insert into public.anggota (nomor_anggota, nama, email, telepon, alamat, jenis, foto)
    values (
      'AGT-' || lpad(nextval('public.nomor_anggota_seq')::text, 4, '0'),
      v_profil.nama, lower(v_profil.email), left(coalesce(p_telepon, ''), 40),
      left(coalesce(p_alamat, ''), 500),
      case when p_jenis in ('Pelajar', 'Mahasiswa', 'Umum') then p_jenis else 'Umum' end,
      case when p_foto is not null and char_length(p_foto) <= 400000 and p_foto ~* '^data:image/(jpeg|png|webp);base64,' then p_foto else null end
    )
    on conflict (lower(email)) where email <> '' do nothing
    returning id into v_id;
  end if;
  if v_id is null then select id into v_id from public.anggota where lower(email) = lower(v_profil.email) limit 1; end if;
  update public.profiles set anggota_id = v_id where id = auth.uid() and anggota_id is null;
  return v_id;
end;
$$;
revoke execute on function public.lengkapi_kartu_saya(text, text, text, text) from public, anon;
grant execute on function public.lengkapi_kartu_saya(text, text, text, text) to authenticated, service_role;

-- RPC lama mengizinkan tamu membuat kartu tanpa akun Auth. Kini RPC hanya
-- menerima sesi anggota yang emailnya sama, menghasilkan nomor dari sekuens,
-- dan membuat ulang kartu akun yang terhapus jika ada percobaan pemulihan.
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
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nama text := trim(coalesce(p_nama, ''));
  v_jenis text := case when p_jenis in ('Pelajar', 'Mahasiswa', 'Umum') then p_jenis else 'Umum' end;
begin
  if auth.uid() is null or v_email = '' or lower(public.email_saya()) <> v_email then
    raise exception 'Akun harus terverifikasi untuk membuat kartu anggota.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.peran = 'user') then
    raise exception 'Kartu hanya dapat dibuat untuk akun anggota.';
  end if;
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'Konfirmasi email sebelum membuat kartu anggota.';
  end if;
  if char_length(v_nama) < 3 or char_length(v_nama) > 120 then
    raise exception 'Nama harus berisi 3–120 karakter.';
  end if;
  if p_telepon is null or trim(p_telepon) = '' or char_length(p_telepon) > 40 then
    raise exception 'Nomor telepon wajib diisi dan maksimal 40 karakter.';
  end if;
  if char_length(coalesce(p_alamat, '')) > 500 then raise exception 'Alamat maksimal 500 karakter.'; end if;
  if p_foto is not null and (char_length(p_foto) > 400000 or p_foto !~* '^data:image/(jpeg|png|webp);base64,') then
    raise exception 'Format atau ukuran foto tidak valid.';
  end if;

  select anggota_id into v_id from public.profiles where id = auth.uid();
  if v_id is not null then
    return (select to_jsonb(a) from public.anggota a where a.id = v_id);
  end if;

  select id into v_id from public.anggota where lower(email) = v_email limit 1;
  if v_id is null then
    insert into public.anggota (nomor_anggota, nama, email, telepon, alamat, jenis, foto)
    values (
      'AGT-' || lpad(nextval('public.nomor_anggota_seq')::text, 4, '0'),
      v_nama, v_email, left(coalesce(p_telepon, ''), 40), left(coalesce(p_alamat, ''), 500), v_jenis,
      case when p_foto is not null and char_length(p_foto) <= 400000 and p_foto ~* '^data:image/(jpeg|png|webp);base64,' then p_foto else null end
    )
    on conflict (lower(email)) where email <> '' do nothing
    returning id into v_id;
  end if;

  if v_id is null then
    select id into v_id from public.anggota where lower(email) = v_email limit 1;
  end if;
  update public.profiles set anggota_id = v_id where id = auth.uid() and anggota_id is null;
  return (select to_jsonb(a) from public.anggota a where a.id = v_id);
end;
$$;

revoke execute on function public.daftar_kartu(text, text, text, text, text, text) from public, anon;
grant execute on function public.daftar_kartu(text, text, text, text, text, text) to authenticated, service_role;
