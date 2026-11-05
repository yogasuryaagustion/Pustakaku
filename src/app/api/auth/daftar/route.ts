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
import { emailSah, sahkanSandi } from "@/lib/supabase/validasi";
import { kePengguna, type BarisProfil } from "@/lib/supabase/peta";
import { cekIzin, KEBIJAKAN_BAWAAN } from "@/lib/izin";

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
    let k: Awaited<ReturnType<typeof konteksRoute>> | null = null;
    try {
      k = await konteksRoute();
    } catch (error) {
      // signup tidak perlu database selain layanan Auth; biarkan Auth memberi
      // error konfigurasi yang tepat bila koneksi database belum tersedia.
      if (process.env.NODE_ENV !== "production") console.warn("[daftar] konteks awal tidak tersedia:", error);
    }
    const kebijakan = k?.kebijakan ?? KEBIJAKAN_BAWAAN;

    // Kebijakan akses: pendaftaran publik bisa ditutup lewat /admin/akses.
    if (!cekIzin(kebijakan, "tamu", "akun.daftar")) {
      throw new GalatApi(
        "Pendaftaran sedang ditutup oleh kebijakan akses. Hubungi pustakawan.",
        403
      );
    }

    const panjang = Number(request.headers.get("content-length") ?? 0);
    if (panjang > 600_000) throw new GalatApi("Ukuran data pendaftaran terlalu besar.", 413);
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    const email = emailSah(body?.email, { wajib: true });
    const sandi = sahkanSandi(body?.sandi);
    if (email.length > 200) throw new GalatApi("Email maksimal 200 karakter.");
    if (nama.length < 3 || nama.length > 120) throw new GalatApi("Nama harus berisi 3–120 karakter.");
    if (body?.setuju !== true) throw new GalatApi("Persetujuan syarat keanggotaan dan privasi wajib diberikan.");

    const kartuMasuk = (body?.anggota && typeof body.anggota === "object"
      ? body.anggota
      : {}) as KartuMasuk;
    if (typeof kartuMasuk.telepon !== "string" || !kartuMasuk.telepon.trim()) throw new GalatApi("Nomor telepon wajib diisi.");
    if (kartuMasuk.telepon.length > 40) throw new GalatApi("Nomor telepon maksimal 40 karakter.");
    if (kartuMasuk.foto !== undefined && kartuMasuk.foto !== null &&
      (typeof kartuMasuk.foto !== "string" || !/^data:image\/(jpeg|png|webp);base64,/i.test(kartuMasuk.foto) || kartuMasuk.foto.length > 400_000)) {
      throw new GalatApi("Format atau ukuran foto tidak valid.");
    }
    if (!(["Pelajar", "Mahasiswa", "Umum"].includes(kartuMasuk.jenis ?? ""))) throw new GalatApi("Jenis anggota tidak valid.");
    if (typeof kartuMasuk.alamat === "string" && kartuMasuk.alamat.length > 500) {
      throw new GalatApi("Alamat maksimal 500 karakter.");
    }
    if (k?.pengguna) throw new GalatApi("Sesi pengguna masih aktif; keluar dahulu untuk membuat akun baru.", 409);

    // 1) Buat akun Auth lewat klien ANON agar cookie sesi admin tidak tertimpa.
    const anon = createSupabaseAnon();
    const { data: hasil, error } = await anon.auth.signUp({
      email,
      password: sandi,
      options: {
        data: {
          nama,
          telepon: kartuMasuk.telepon.trim(),
          alamat: kartuMasuk.alamat?.trim() ?? "",
          jenis: kartuMasuk.jenis,
          foto: kartuMasuk.foto ?? null,
          setuju: true,
        },
      },
    });
    if (error) {
      const pesan = error.message ?? "";
      if (/over_email_send_rate_limit|email rate limit/i.test(error.code ?? "")) {
        throw new GalatApi("Terlalu banyak email dikirim. Tunggu sebelum mencoba lagi.", 429);
      }
      if (/already|registered|exists/i.test(pesan)) {
        throw new GalatApi("Email sudah terdaftar.", 409);
      }
      if (/password/i.test(pesan)) throw new GalatApi("Kata sandi terlalu lemah — minimal 6 karakter.");
      if (/rate limit/i.test(pesan)) throw new GalatApi("Terlalu banyak percobaan. Coba lagi beberapa saat.", 429);
      throw new GalatApi(pesan || "Pendaftaran gagal.");
    }
    if (!hasil.user) throw new GalatApi("Akun gagal dibuat.");
    const adaSesi = Boolean(hasil.session);

    // Trigger Auth membuat profil segera, dan membuat kartu dalam transaksi
    // yang sama hanya jika project tidak membutuhkan konfirmasi email. Jika
    // konfirmasi aktif, kartu akan dibuat idempoten saat email dikonfirmasi.
    if (!adaSesi) {
      return json(
        {
          ok: true,
          pesan:
            "Pendaftaran berhasil. Silakan konfirmasi email Anda melalui tautan yang dikirim, lalu masuk.",
        },
        201
      );
    }
    if (!k) throw new GalatApi("Pendaftaran berhasil, tetapi sesi belum dapat disiapkan. Silakan masuk kembali.", 503);

    // Bangun sesi server; akun baru normalnya sudah memiliki kartu dari trigger.
    const masuk = await createSupabaseServer();
    const { error: errMasuk } = await masuk.auth.signInWithPassword({
      email,
      password: sandi,
    });
    if (errMasuk) {
      return json({
        ok: true,
        pesan: "Pendaftaran berhasil. Silakan masuk untuk melanjutkan.",
      });
    }

    const { data: profil, error: errorProfil } = await masuk
      .from("profiles")
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .eq("id", hasil.user.id)
      .maybeSingle();
    if (errorProfil) throw new GalatApi(errorProfil.message || "Profil gagal dimuat.", 500);
    if (!profil) throw new GalatApi("Profil akun tidak ditemukan setelah registrasi.", 500);

    let anggotaId = profil.anggota_id;
    if (!anggotaId) {
      const { data, error: errorKartu } = await masuk.rpc("lengkapi_kartu_saya", {
        p_telepon: kartuMasuk.telepon.slice(0, 40),
        p_alamat: kartuMasuk.alamat?.slice(0, 500) ?? "",
        p_jenis: kartuMasuk.jenis,
        p_foto: kartuMasuk.foto ?? null,
      });
      if (errorKartu) throw new GalatApi(errorKartu.message || "Kartu anggota gagal ditautkan.");
      anggotaId = typeof data === "string" ? data : null;
    }

    await masuk.from("log_aktivitas").insert({
      jenis: "akun",
      aksi: "Pendaftaran akun",
      objek: email,
      detail: anggotaId ? "terpaut kartu anggota" : null,
      aktor_id: profil.id,
      anggota_id: anggotaId,
      aktor: profil.nama,
      peran: profil.peran,
    });

    const pengguna = kePengguna({ ...(profil as BarisProfil), anggota_id: anggotaId });
    const kartuAktif = Boolean(anggotaId);

    return json({
      ok: true,
      pesan: kartuAktif
        ? "Pendaftaran berhasil."
        : "Pendaftaran berhasil; kartu anggota akan aktif setelah email dikonfirmasi.",
      pengguna,
    }, 201);
  });
}
