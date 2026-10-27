// Ganti kata sandi: sandi LAMA diverifikasi ulang ke Supabase Auth sebelum
// sandi baru dipasang (Supabase tidak menyimpan hash sandi buatan aplikasi).

import {
  bacaBody,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { sahkanSandi } from "@/lib/supabase/validasi";

export async function PATCH(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "panel.profil" });
    const pengguna = k.pengguna!;

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const sandiLama = typeof body?.sandiLama === "string" ? body.sandiLama : "";
    const sandiBaru = sahkanSandi(body?.sandiBaru, "Kata sandi baru");
    const ulangi = typeof body?.ulangiSandi === "string" ? body.ulangiSandi : "";
    if (!sandiLama) throw new GalatApi("Kata sandi lama wajib diisi.");
    if (sandiBaru !== ulangi) throw new GalatApi("Konfirmasi sandi baru tidak sama.");

    // Verifikasi kredensial lama (menggantikan pemeriksaan hash lama).
    const { error: errLama } = await k.supabase.auth.signInWithPassword({
      email: pengguna.email,
      password: sandiLama,
    });
    if (errLama) throw new GalatApi("Kata sandi lama salah.");

    const { error: errGanti } = await k.supabase.auth.updateUser({ password: sandiBaru });
    if (errGanti) throw new GalatApi(errGanti.message || "Kata sandi gagal diperbarui.");

    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Kata sandi diubah",
      objek: pengguna.nama,
    });
    return json({ ok: true, pesan: "Kata sandi berhasil diperbarui." });
  });
}
