// Logout: mengakhiri sesi Supabase Auth (cookie dihapus oleh @supabase/ssr).

import { jalankan, json, konteksRoute } from "@/lib/supabase/konteks";

export async function POST() {
  return jalankan(async () => {
    const k = await konteksRoute();
    if (k.pengguna) {
      await k.supabase.from("log_aktivitas").insert({
        jenis: "masuk",
        aksi: "Keluar dari sesi",
        objek: k.pengguna.nama,
        aktor_id: k.pengguna.id,
        anggota_id: k.pengguna.anggotaId ?? null,
        aktor: k.pengguna.nama,
        peran: k.peran,
      });
    }
    const { error } = await k.supabase.auth.signOut();
    if (error) console.warn("[auth] signOut:", error.message);
    return json({ ok: true });
  });
}
