// Pengembalian satu pinjaman — dijalankan atomik di database
// (mencegah pengembalian ganda & status yang tidak konsisten).

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { kePeminjaman, type BarisPeminjaman } from "@/lib/supabase/peta";

interface Params {
  params: Promise<{ id: string }>;
}

/** Kondisi fisik yang boleh dicatat saat pengembalian. */
const KONDISI_KEMBALI = ["layak", "rusak_ringan"] as const;

export async function POST(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    // Opsional: petugas mencatat kondisi salinan yang diterima kembali.
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const mentah = body?.kondisi_fisik;
    const kondisi = typeof mentah === "string" && mentah ? mentah : null;
    if (kondisi && !(KONDISI_KEMBALI as readonly string[]).includes(kondisi)) {
      throw new GalatApi("Kondisi pengembalian harus \"layak\" atau \"rusak_ringan\".", 400);
    }

    const { data, error } = await k.supabase.rpc("kembalikan_buku", {
      p_peminjaman_id: id,
      p_kondisi_fisik: kondisi,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) });
  });
}
