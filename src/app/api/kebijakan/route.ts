// Kebijakan akses (matriks RBAC): dibaca publik, diubah hanya SUPER ADMIN.
// Pengecualian yang sengaja di luar matriks izin — halaman Kelola Akses
// dijaga gerbang peran superadmin (RUTE_PERAN di src/lib/akses.ts), sehingga
// Admin tak bisa menaikkan haknya sendiri lewat endpoint ini.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  hapusCacheKebijakan,
  jalankan,
  json,
  konteksRoute,
  kebijakanPublik,
} from "@/lib/supabase/konteks";
import {
  bandingkanKebijakan,
  KEBIJAKAN_BAWAAN,
  normalisasiKebijakan,
  type Kebijakan,
} from "@/lib/izin";
import { catatJejakServer } from "@/lib/supabase/jejak";

export async function GET() {
  return jalankan(async () => {
    // Matriks global yang sama dengan yang dipakai seluruh route (dibaca publik,
    // divalidasi RLS + guard di endpoint tulis) — di-cache agar halaman tidak
    // menunggu roundtrip Supabase hanya untuk menentukan menu yang tampil.
    return json({ kebijakan: await kebijakanPublik() });
  });
}

export async function PUT(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const masuk = body?.kebijakan;
    if (!masuk || typeof masuk !== "object") throw new GalatApi("Kebijakan akses tidak valid.");

    // Normalisasi di server: izin tak dikenal dibuang, anti-lockout ditegakkan
    // — sama persis dengan yang dilakukan layar Kontrol Akses.
    const sebelum = normalisasiKebijakan(
      (await k.supabase.from("kebijakan_akses").select("versi, izin, diubah_pada, diubah_oleh").eq("id", true).maybeSingle())
        .data ?? KEBIJAKAN_BAWAAN
    );
    const kebijakan: Kebijakan = normalisasiKebijakan(masuk);
    kebijakan.diubahPada = new Date().toISOString();
    kebijakan.diubahOleh = k.pengguna?.nama ?? null;

    const { error } = await k.supabase
      .from("kebijakan_akses")
      .upsert(
        {
          id: true,
          versi: kebijakan.versi,
          izin: kebijakan.izin,
          diubah_pada: kebijakan.diubahPada,
          diubah_oleh: kebijakan.diubahOleh,
        },
        { onConflict: "id" }
      );
    if (error) throw dariSupabase(error);
    // Matriks baru langsung dipakai seluruh request berikutnya.
    hapusCacheKebijakan();

    const perubahan = bandingkanKebijakan(sebelum, kebijakan);
    if (perubahan.length > 0) {
      await catatJejakServer(k, {
        jenis: "sistem",
        aksi: "Kebijakan akses diubah",
        objek: "Kontrol Akses",
        detail: perubahan.join("; "),
      });
    }
    return json({ kebijakan });
  });
}
