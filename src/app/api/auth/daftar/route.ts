// Pendaftaran publik: membuat akun Supabase Auth + kartu anggota.
//
// PERAN SELALU 'user' — pemicu saat_akun_dibuat() di database juga memaksa
// peran 'user', sehingga metadata yang dikirim klien tidak bisa dipakai untuk
// menaikkan hak. Kata sandi lama (hash SHA-256 buatan aplikasi) TIDAK dibawa.

import {
  bacaBody,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseAnon, createSupabaseServer } from "@/lib/supabase/server";
import { emailSah, sahkanSandi, teksOpsional } from "@/lib/supabase/validasi";
import { kePengguna, type BarisProfil } from "@/lib/supabase/peta";
import { tautkanKartuSaya } from "@/lib/supabase/tautan";
import { cekIzin } from "@/lib/izin";

interface KartuMasuk {
  nama?: string;
  email?: string;
  telepon?: string;
  alamat?: string;
  jenis?: string;
  foto?: string | null;
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute();

    // Kebijakan akses: pendaftaran publik bisa ditutup lewat /admin/akses.
    if (!cekIzin(k.kebijakan, "tamu", "akun.daftar")) {
      throw new GalatApi(
        "Pendaftaran sedang ditutup oleh kebijakan akses. Hubungi pustakawan.",
        403
      );
    }

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    const email = emailSah(body?.email, { wajib: true });
    const sandi = sahkanSandi(body?.sandi);
    if (nama.length < 3) throw new GalatApi("Nama minimal 3 karakter.");

    const kartuMasuk = (body?.anggota && typeof body.anggota === "object"
      ? body.anggota
      : {}) as KartuMasuk;

    // 1) Buat akun Auth lewat klien ANON agar cookie sesi admin tidak tertimpa.
    const anon = createSupabaseAnon();
    const { data: hasil, error } = await anon.auth.signUp({
      email,
      password: sandi,
      options: { data: { nama } },
    });
    if (error) {
      const pesan = error.message ?? "";
      if (/already registered|already been registered/i.test(pesan)) {
        throw new GalatApi("Email sudah terdaftar.", 409);
      }
      if (/password/i.test(pesan)) throw new GalatApi("Kata sandi terlalu lemah — minimal 6 karakter.");
      if (/rate limit/i.test(pesan)) throw new GalatApi("Terlalu banyak percobaan. Coba lagi beberapa saat.", 429);
      throw new GalatApi(pesan || "Pendaftaran gagal.");
    }
    const adaSesi = Boolean(hasil.session);

    // 2) Kartu anggota (dibuat lewat fungsi database — tamu tak punya hak tulis).
    const anonSekarang = createSupabaseAnon();
    const { data: kartuJson, error: errKartu } = await anonSekarang.rpc("daftar_kartu", {
      p_nama: kartuMasuk.nama?.trim() || nama,
      p_email: kartuMasuk.email?.trim() || email,
      p_telepon: teksOpsional(kartuMasuk.telepon, 40),
      p_alamat: teksOpsional(kartuMasuk.alamat, 500),
      p_jenis: teksOpsional(kartuMasuk.jenis, 20) || "Umum",
      p_foto:
        typeof kartuMasuk.foto === "string" && kartuMasuk.foto.startsWith("data:image/")
          ? kartuMasuk.foto.slice(0, 400_000)
          : null,
    });
    if (errKartu) throw new GalatApi(errKartu.message || "Kartu anggota gagal dibuat.");

    const kartu = (kartuJson ?? null) as { id?: string } | null;

    if (!adaSesi) {
      // Konfirmasi email aktif di proyek: pengguna harus konfirmasi dulu.
      return json(
        {
          ok: true,
          pesan:
            "Pendaftaran berhasil. Silakan konfirmasi email Anda melalui tautan yang dikirim, lalu masuk.",
          kartu: kartu?.id ?? null,
        },
        201
      );
    }

    // 3) Bangun sesi di server (cookie) lalu kaitkan kartu ke profil.
    const masuk = await createSupabaseServer();
    const { error: errMasuk } = await masuk.auth.signInWithPassword({
      email,
      password: sandi,
    });
    if (errMasuk) {
      return json({
        ok: true,
        pesan: "Pendaftaran berhasil. Silakan masuk untuk melanjutkan.",
        kartu: kartu?.id ?? null,
      });
    }

    const { data: profil } = await masuk
      .from("profiles")
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .eq("id", hasil.user?.id ?? "")
      .maybeSingle();

    if (profil && kartu?.id) {
      const { error: errTaut } = await masuk
        .from("profiles")
        .update({ anggota_id: kartu.id })
        .eq("id", profil.id)
        .is("anggota_id", null);
      if (errTaut) console.warn("[daftar] tautan kartu gagal:", errTaut.message);
    }

    if (profil) {
      await masuk.from("log_aktivitas").insert({
        jenis: "akun",
        aksi: "Pendaftaran akun",
        objek: email,
        detail: kartu?.id ? "terpaut kartu anggota" : null,
        aktor_id: profil.id,
        anggota_id: kartu?.id ?? null,
        aktor: profil.nama,
        peran: profil.peran,
      });
    }

    // Kembalikan pengguna lewat konteks yang sudah punya sesi.
    const kBaru = await konteksRoute();
    await tautkanKartuSaya(kBaru);
    const pengguna = kBaru.pengguna ?? (profil ? kePengguna(profil as BarisProfil) : null);

    return json({ ok: true, pesan: "Pendaftaran berhasil.", pengguna }, 201);
  });
}
