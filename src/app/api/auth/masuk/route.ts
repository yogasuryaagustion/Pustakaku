// Login: verifikasi kredensial lewat Supabase Auth (bukan hash buatan aplikasi).

import { bacaBody, dariSupabase, GalatApi, jalankan, json, konteksRoute } from "@/lib/supabase/konteks";
import { tautkanKartuSaya } from "@/lib/supabase/tautan";
import { kePengguna, type BarisProfil } from "@/lib/supabase/peta";

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute();
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const sandi = typeof body?.sandi === "string" ? body.sandi : "";
    if (!email || !sandi) throw new GalatApi("Email dan kata sandi wajib diisi.");

    const { data, error } = await k.supabase.auth.signInWithPassword({
      email,
      password: sandi,
    });
    if (error || !data.user) {
      if (/not confirmed|email not confirmed/i.test(error?.message ?? "")) {
        throw new GalatApi("Email belum dikonfirmasi. Cek kotak masuk email Anda.", 401);
      }
      // GoTrue sengaja tidak membedakan "belum terdaftar" vs "sandi salah".
      throw new GalatApi("Email atau kata sandi salah.", 401);
    }

    // Muat profil sesudah sesi terbentuk (konteks tadi dibuat sebelum login).
    const { data: profil, error: errProfil } = await k.supabase
      .from("profiles")
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .eq("id", data.user.id)
      .maybeSingle();
    if (errProfil) throw dariSupabase(errProfil);
    if (!profil) throw new GalatApi("Profil akun tidak ditemukan. Hubungi pustakawan.", 500);

    // Perbarui konteks agar tautan kartu & jejak memakai sesi yang baru.
    k.pengguna = kePengguna(profil as BarisProfil);
    k.peran = profil.peran === "admin" ? "admin" : "user";
    await tautkanKartuSaya(k);

    await k.supabase.from("log_aktivitas").insert({
      jenis: "masuk",
      aksi: "Berhasil masuk",
      objek: email,
      aktor_id: profil.id,
      anggota_id: profil.anggota_id,
      aktor: profil.nama,
      peran: profil.peran,
    });

    return json({
      pengguna: {
        id: profil.id,
        nama: profil.nama,
        email: profil.email,
        sandiHash: "",
        peran: profil.peran === "admin" ? "admin" : "user",
        anggotaId: profil.anggota_id ?? undefined,
        dibuatPada: profil.dibuat_pada,
      },
      pesan: `Selamat datang, ${profil.nama}.`,
    });
  });
}
