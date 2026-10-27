// Kebijakan akses (matriks RBAC): dibaca publik, diubah hanya admin.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
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
    const k = await konteksRoute();
    const { data, error } = await k.supabase
      .from("kebijakan_akses")
      .select("versi, izin, diubah_pada, diubah_oleh")
      .eq("id", true)
      .maybeSingle();
    if (error) throw dariSupabase(error);
    return json({ kebijakan: normalisasiKebijakan(data ?? KEBIJAKAN_BAWAAN) });
  });
}

export async function PUT(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });
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
