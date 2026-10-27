// Profil akun sendiri: ubah nama / email (email juga diperbarui di Supabase Auth).

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { emailSah } from "@/lib/supabase/validasi";
import { kePengguna, type BarisProfil } from "@/lib/supabase/peta";

export async function PATCH(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "panel.profil" });
    const pengguna = k.pengguna!;

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const patch: { nama?: string; email?: string } = {};
    if (body?.nama !== undefined) {
      const nama = typeof body.nama === "string" ? body.nama.trim() : "";
      if (nama.length < 3) throw new GalatApi("Nama minimal 3 karakter.");
      patch.nama = nama;
    }
    if (body?.email !== undefined) patch.email = emailSah(body.email, { wajib: true });

    if (Object.keys(patch).length === 0) throw new GalatApi("Tidak ada perubahan yang dikirim.");

    const emailBaru = patch.email;
    const emailLama = pengguna.email;

    // 1) Profil dulu — indeks unik email menolak duplikat (409).
    const { data, error } = await k.supabase
      .from("profiles")
      .update(patch)
      .eq("id", pengguna.id)
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .single();
    if (error) {
      if (error.code === "23505") throw new GalatApi("Email sudah dipakai akun lain.", 409);
      throw dariSupabase(error);
    }

    // 2) Sinkronkan email di Supabase Auth bila berubah.
    if (emailBaru && emailBaru !== emailLama) {
      const { data: sesi, error: errAuth } = await k.supabase.auth.updateUser({
        email: emailBaru,
      });
      const hasil = sesi.user?.email?.toLowerCase();
      if (errAuth || (hasil && hasil !== emailBaru)) {
        // Kembalikan profil agar tidak berbeda dengan sistem autentikasi.
        await k.supabase.from("profiles").update({ email: emailLama }).eq("id", pengguna.id);
        throw new GalatApi(
          errAuth?.message || "Perubahan email menunggu konfirmasi — periksa kotak masuk email baru Anda."
        );
      }
    }

    const penggunaBaru = kePengguna(data as BarisProfil);
    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Profil diperbarui",
      objek: penggunaBaru.email,
      detail: patch.nama && emailBaru ? "nama & email" : patch.nama ? "nama" : "email",
    });
    return json({ pengguna: penggunaBaru, pesan: "Profil diperbarui." });
  });
}
