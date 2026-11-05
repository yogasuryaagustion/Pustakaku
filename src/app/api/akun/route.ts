// Kelola akun login (Super Admin): daftar akun & daftar semua profil.
// Gerbang: izin `akun.kelola` — bawaan hanya SUPER ADMIN yang punya,
// tetap bisa dibuka lewat Kelola Akses bila sengaja diberikan ke Admin.

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
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibIzin: "akun.kelola",
    });
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
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibIzin: "akun.kelola",
    });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    const email = emailSah(body?.email, { wajib: true });
    const sandi = sahkanSandi(body?.sandi);
    const peranDiminta =
      body?.peran === "superadmin"
        ? "superadmin"
        : body?.peran === "admin"
          ? "admin"
          : "user";

    // Hanya Super Admin yang boleh membuat akun Admin
    // maupun Super Admin.
    if (
      (peranDiminta === "admin" || peranDiminta === "superadmin") &&
      k.peran !== "superadmin"
    ) {
      throw new GalatApi(
        "Hanya Super Admin yang dapat membuat akun Admin atau Super Admin.",
        403,
      );
    }

    const peran = peranDiminta;
    const anggotaId =
      typeof body?.anggotaId === "string" && body.anggotaId
        ? body.anggotaId
        : null;
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
        if (/already/i.test(error.message ?? ""))
          throw new GalatApi("Email sudah terdaftar.", 409);
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
        if (/already/i.test(error.message ?? ""))
          throw new GalatApi("Email sudah terdaftar.", 409);
        throw new GalatApi(
          `Akun gagal dibuat: ${error.message}. Tanpa SUPABASE_SERVICE_ROLE_KEY, matikan "Confirm email" pada Authentication → Providers → Email.`,
        );
      }
      uid = data.user?.id ?? null;
      if (!data.session) {
        throw new GalatApi(
          'Akun dibuat tetapi belum terkonfirmasi. Matikan "Confirm email" atau isi SUPABASE_SERVICE_ROLE_KEY.',
        );
      }
    }
    if (!uid)
      throw new GalatApi("Akun gagal dibuat (id pengguna tidak ditemukan).");

    // 2) Tetapkan peran dan tautan kartu.
    const { data: profil, error: errProfil } = await k.supabase
      .from("profiles")
      .update({ peran, anggota_id: anggotaId })
      .eq("id", uid)
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .maybeSingle();

    // 3) Jika profil gagal diperbarui, bersihkan akun Auth yang baru dibuat.
    if (errProfil || !profil) {
      if (serviceKey) {
        const { error: errHapus } =
          await createSupabaseAdmin().auth.admin.deleteUser(uid);

        if (errHapus) {
          throw new GalatApi(
            `Profil gagal disimpan dan akun Auth gagal dibersihkan: ${errHapus.message}`,
            500,
          );
        }
      }

      if (errProfil) throw dariSupabase(errProfil);

      throw new GalatApi(
        "Profil akun gagal dibuat. Akun Auth yang baru dibuat sudah dibersihkan.",
        500,
      );
    }

    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Akun dibuat",
      objek: email,
      detail: `peran ${peran}`,
      anggotaId,
    });
    return json(
      { akun: kePengguna(profil as BarisProfil), pesan: "Akun dibuat." },
      201,
    );
  });
}
