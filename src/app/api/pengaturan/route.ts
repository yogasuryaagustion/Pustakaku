// Pengaturan sistem perpustakaan: dibaca publik, diubah hanya admin.

import {
  bacaBody,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { sahkanSistem, SISTEM_DEFAULT, type SistemPengaturan } from "@/lib/sistem-nilai";
import { catatJejakServer } from "@/lib/supabase/jejak";

interface BarisSistem {
  nama: string;
  tagline: string;
  lama_pinjam: number;
  denda_per_hari: number;
  maks_pinjaman: number;
  diubah_pada: string | null;
  diubah_oleh: string | null;
}

function keSistem(r: BarisSistem | null): SistemPengaturan {
  if (!r) return SISTEM_DEFAULT;
  return sahkanSistem({
    nama: r.nama,
    tagline: r.tagline,
    lamaPinjam: r.lama_pinjam,
    dendaPerHari: r.denda_per_hari,
    maksPinjaman: r.maks_pinjaman,
  });
}

export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute();
    const { data, error } = await k.supabase
      .from("pengaturan_sistem")
      .select("nama, tagline, lama_pinjam, denda_per_hari, maks_pinjaman, diubah_pada, diubah_oleh")
      .eq("id", true)
      .maybeSingle();
    if (error) throw dariSupabase(error);
    return json({ pengaturan: keSistem((data as BarisSistem | null) ?? null) });
  });
}

export async function PUT(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    // Validasi identik dengan yang tampil di layar (modul murni sistem-nilai).
    const s = sahkanSistem(body?.pengaturan);

    const { error } = await k.supabase
      .from("pengaturan_sistem")
      .upsert(
        {
          id: true,
          nama: s.nama,
          tagline: s.tagline,
          lama_pinjam: s.lamaPinjam,
          denda_per_hari: s.dendaPerHari,
          maks_pinjaman: s.maksPinjaman,
          diubah_pada: new Date().toISOString(),
          diubah_oleh: k.pengguna?.nama ?? null,
        },
        { onConflict: "id" }
      );
    if (error) throw dariSupabase(error);

    await catatJejakServer(k, {
      jenis: "sistem",
      aksi: "Pengaturan disimpan",
      objek: s.nama,
      detail: `lama ${s.lamaPinjam} hr · denda Rp${s.dendaPerHari.toLocaleString("id-ID")}/hari`,
    });
    return json({ pengaturan: s });
  });
}
