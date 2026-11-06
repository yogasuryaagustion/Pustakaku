-- Nomor inventaris otomatis.
--
-- Petugas bisa menentukan pola penomoran (mis. "INV-{tahun}-{urut}") di
-- Pengaturan. Saat eksemplar baru ditambahkan tanpa nomor, database membuat
-- nomor berikutnya dari pola itu — bukan dari hitungan di aplikasi — sehingga
-- dua penambahan bersamaan tidak mungkin mendapat nomor yang sama.

alter table public.pengaturan_sistem
  add column if not exists format_inventaris text not null default 'INV-{tahun}-{urut}';

-- ---------------------------------------------------------------------
-- Nomor berikutnya menurut pola tersimpan.
-- Token: {tahun} (4 digit), {bulan} (2 digit), {urut} atau {urut:N}.
-- Nomor yang sudah terpakai dilewati, jadi hasilnya selalu unik.
create or replace function public.nomor_inventaris_berikutnya(p_format text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_format text;
  v_urut   integer;
  v_pad    integer := 4;
  v_digit  text;
  v_nomor  text;
  v_coba   integer := 0;
begin
  select coalesce(nullif(btrim(p_format), ''), format_inventaris)
    into v_format
    from public.pengaturan_sistem
   where id = true;

  v_format := coalesce(v_format, 'INV-{tahun}-{urut}');
  if position('{urut' in lower(v_format)) = 0 then
    raise exception 'Format nomor inventaris harus memuat token {urut}.';
  end if;

  v_digit := substring(v_format from '\{urut:(\d{1,2})\}');
  if v_digit is not null then
    v_pad := v_digit::int;
  end if;

  -- Mulai dari jumlah salinan yang ada supaya penomoran terus maju.
  v_urut := greatest(1, (select count(*) from public.eksemplar_buku) + 1);

  loop
    v_coba := v_coba + 1;
    v_nomor := regexp_replace(
      replace(
        replace(v_format, '{tahun}', to_char(current_date, 'YYYY')),
        '{bulan}', to_char(current_date, 'MM')
      ),
      '\{urut(:\d{1,2})?\}',
      lpad(v_urut::text, greatest(v_pad, char_length(v_urut::text)), '0'),
      'i'
    );
    exit when not exists (
      select 1 from public.eksemplar_buku e where e.nomor_inventaris = v_nomor
    );
    if v_coba > 10000 then
      raise exception 'Tidak menemukan nomor inventaris yang masih kosong.';
    end if;
    v_urut := v_urut + 1;
  end loop;

  return v_nomor;
end;
$$;

-- ---------------------------------------------------------------------
-- Tambah satu eksemplar; nomor diisi otomatis bila tidak dikirim.
create or replace function public.tambah_eksemplar(
  p_buku_id uuid,
  p_nomor text default null,
  p_status text default 'tersedia',
  p_kondisi text default 'layak',
  p_tanggal date default null,
  p_keterangan text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nomor text := nullif(btrim(coalesce(p_nomor, '')), '');
  v_otomatis boolean := v_nomor is null;
  v_coba integer := 0;
  v_baru public.eksemplar_buku%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;
  if not public.boleh('katalog.kelola') then
    raise exception 'Anda tidak memiliki izin untuk menambah eksemplar.';
  end if;
  if not exists (select 1 from public.buku b where b.id = p_buku_id) then
    raise exception 'Buku tidak ditemukan.';
  end if;
  if p_status not in ('tersedia', 'dipinjam', 'rusak', 'hilang') then
    raise exception 'Status eksemplar "%" tidak dikenal.', p_status;
  end if;
  if p_kondisi not in ('layak', 'rusak_ringan', 'rusak_beda', 'hilang') then
    raise exception 'Kondisi fisik "%" tidak dikenal.', p_kondisi;
  end if;

  -- Satu transaksi per pemanggilan, jadi kunci ini menahan pembuatan nomor
  -- otomatis yang bersamaan sampai baris ini selesai disisipkan.
  perform pg_advisory_xact_lock(hashtext('inventaris-nomor'));

  loop
    v_coba := v_coba + 1;
    if v_nomor is null then
      v_nomor := public.nomor_inventaris_berikutnya();
      v_otomatis := true;
    end if;

    begin
      insert into public.eksemplar_buku
        (buku_id, nomor_inventaris, status, kondisi_fisik, tanggal_pengadaan, keterangan)
      values
        (p_buku_id, v_nomor, p_status, p_kondisi, coalesce(p_tanggal, current_date), p_keterangan)
      returning * into v_baru;
      exit;
    exception when unique_violation then
      if not v_otomatis then
        raise exception 'Nomor inventaris "%" sudah dipakai.', v_nomor;
      end if;
      if v_coba > 5 then
        raise exception 'Gagal membuat nomor inventaris unik.';
      end if;
      v_nomor := null; -- bentrok walau sudah dikunci: coba nomor berikutnya
    end;
  end loop;

  return to_jsonb(v_baru);
end;
$$;

revoke execute on function public.tambah_eksemplar(uuid, text, text, text, date, text) from anon;
revoke execute on function public.nomor_inventaris_berikutnya(text) from anon;

grant execute on function public.tambah_eksemplar(uuid, text, text, text, date, text)
  to authenticated, service_role;
grant execute on function public.nomor_inventaris_berikutnya(text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
