// Kembalikan buku yang diarsipkan ke katalog.
//
// Kebalikan dari arsip di DELETE /api/buku/[id]: cukup mengosongkan
// `dihapus_pada`, sehingga buku tampil lagi di katalog dan bisa dipinjam.

import {
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  kolomBelumAda,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { keBuku, type BarisBuku } from "@/lib/supabase/peta";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibIzin: "katalog.kelola",
    });

    const { data: sebelum, error: errSebelum } = await k.supabase
      .from("buku")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errSebelum) throw dariSupabase(errSebelum);
    if (!sebelum) throw new GalatApi("Buku tidak ditemukan.", 404);

    const buku = sebelum as BarisBuku;
    if (!buku.dihapus_pada) {
      throw new GalatApi("Buku ini tidak sedang diarsipkan.", 400);
    }

    const { data, error } = await k.supabase
      .from("buku")
      .update({ dihapus_pada: null })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (kolomBelumAda(error)) {
        throw new GalatApi(
          "Kolom arsip belum ada di database. Jalankan migrasi supabase/migrations/202611120001_arsip_buku.sql.",
          409
        );
      }
      throw dariSupabase(error);
    }

    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Buku dipulihkan",
      objek: buku.judul,
      detail: `kembali ke katalog · ${buku.kategori}`,
    });

    return json({ ok: true, buku: keBuku(data as BarisBuku) });
  });
}
