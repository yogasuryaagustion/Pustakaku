// Kelola akun login (admin): daftar akun & daftar semua profil.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseAdmin, createSupabaseAnon } from "@/lib/supabase/server";
import { envSupabase } from "@/lib/supabase/config";
import { emailSah, sahkanSandi } from "@/lib/supabase/validasi";
import { kePengguna, type BarisProfil } from "@/lib/supabase/peta";
import { catatJejakServer } from "@/lib/supabase/jejak";

export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });
    const { data, error } = await k.supabase
      .from("profiles")
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .order("created_at", { ascending: false });
    if (error) throw dariSupabase(error);
    return json({ akun: ((data ?? []) as BarisProfil[]).map(kePengguna) });
  });
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    const email = emailSah(body?.email, { wajib: true });
    const sandi = sahkanSandi(body?.sandi);
    const peran = body?.peran === "admin" ? "admin" : "user";
    const anggotaId = typeof body?.anggotaId === "string" && body.anggotaId ? body.anggotaId : null;
    if (nama.length < 3) throw new GalatApi("Nama minimal 3 karakter.");

    // 1) Buat akun Auth. Dengan kunci service role akun langsung terkonfirmasi;
    //    tanpa kunci, memakai signUp (proyek harus mematikan "Confirm email").
    const { serviceKey } = envSupabase();
    let uid: string | null = null;

    if (serviceKey) {
      const admin = createSupabaseAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: sandi,
        email_confirm: true,
        user_metadata: { nama },
      });
      if (error) {
        if (/already/i.test(error.message ?? "")) throw new GalatApi("Email sudah terdaftar.", 409);
        throw new GalatApi(error.message || "Akun gagal dibuat.");
      }
      uid = data.user?.id ?? null;
    } else {
      const anon = createSupabaseAnon();
      const { data, error } = await anon.auth.signUp({
        email,
        password: sandi,
        options: { data: { nama } },
      });
      if (error) {
        if (/already/i.test(error.message ?? "")) throw new GalatApi("Email sudah terdaftar.", 409);
        throw new GalatApi(
          `Akun gagal dibuat: ${error.message}. Tanpa SUPABASE_SERVICE_ROLE_KEY, matikan "Confirm email" pada Authentication → Providers → Email.`
        );
      }
      uid = data.user?.id ?? null;
      if (!data.session) {
        throw new GalatApi(
          "Akun dibuat tetapi belum terkonfirmasi. Matikan \"Confirm email\" atau isi SUPABASE_SERVICE_ROLE_KEY."
        );
      }
    }
    if (!uid) throw new GalatApi("Akun gagal dibuat (id pengguna tidak ditemukan).");

    // 2) Tetapkan peran & tautan kartu (oleh sesi admin — pemicu mengizinkan).
    const { data: profil, error: errProfil } = await k.supabase
      .from("profiles")
      .update({ peran, anggota_id: anggotaId })
      .eq("id", uid)
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .maybeSingle();
    if (errProfil) throw dariSupabase(errProfil);
    if (!profil) throw new GalatApi("Profil akun gagal dibuat.", 500);

    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Akun dibuat",
      objek: email,
      detail: `peran ${peran}`,
      anggotaId,
    });
    return json({ akun: kePengguna(profil as BarisProfil), pesan: "Akun dibuat." }, 201);
  });
}
