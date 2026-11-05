// Kartu keanggotaan milik sesi yang sedang masuk — di gerbang izin `kartu.lihat`
// sehingga admin dapat menutup/membuka fitur kartu lewat Kelola Akses tanpa
// menyentuh kode. Baris yang dikembalikan SELALU milik sendiri: kepemilikan
// diambil dari tautan profil (fallback email lewat tautkanKartuSaya), dan RLS
// tetap berlaku sebagai lapisan pertahanan kedua.

import { dariSupabase, GalatApi, jalankan, json, konteksRoute } from "@/lib/supabase/konteks";
import { tautkanKartuSaya } from "@/lib/supabase/tautan";
import { keAnggota, type BarisAnggota } from "@/lib/supabase/peta";
import type { Anggota } from "@/lib/types";

export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "kartu.lihat" });
    const pengguna = k.pengguna;
    if (!pengguna) throw new GalatApi("Silakan masuk terlebih dahulu.", 401);

    let kartu: Anggota | null = null;

    // 1) Tautan profil yang sudah ada — sumber kebenaran kepemilikan.
    if (pengguna.anggotaId) {
      const { data, error } = await k.supabase
        .from("anggota")
        .select("*")
        .eq("id", pengguna.anggotaId)
        .maybeSingle();
      if (error) throw dariSupabase(error);
      if (data) kartu = keAnggota(data as BarisAnggota);
    }

    // 2) Fallback: kartu beremail sama dengan akun (sekaligus menyembuhkan
    //    tautan profil yang belum terpasang — perilaku yang sama dengan /api/auth/sesi).
    if (!kartu) {
      kartu = (await tautkanKartuSaya(k)).kartu;
    }

    // 200 dengan null = kartu belum ada; halaman menampilkan ajakan menghubungi
    // pustakawan (bukan galat).
    return json({ anggota: kartu });
  });
}
