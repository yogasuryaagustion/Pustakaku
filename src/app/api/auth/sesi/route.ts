// Sesi berjalan: profil akun yang sedang masuk (dibaca dari cookie sesi).

import { jalankan, json, konteksRoute } from "@/lib/supabase/konteks";
import { tautkanKartuSaya } from "@/lib/supabase/tautan";

export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute();
    if (!k.pengguna) return json({ pengguna: null });
    // Sembuhkan tautan kartu anggota yang belum terpasang (mis. akun lama
    // hasil impor): kartu ber-email sama dengan akun otomatis dikaitkan.
    await tautkanKartuSaya(k);
    return json({ pengguna: k.pengguna });
  });
}
