// Petugas memeriksa buku yang diajukan anggota lalu memilih kondisinya.
// Penutupan pinjaman memakai fungsi kembalikan_buku yang sudah ada sehingga
// aturan denda dan status eksemplar tidak berubah.

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

/** Kondisi fisik yang boleh ditetapkan petugas saat memvalidasi. */
const KONDISI = ["layak", "rusak_ringan"] as const;

export async function POST(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const mentah = body?.kondisi_fisik;
    const kondisi = typeof mentah === "string" ? mentah : "";
    if (!(KONDISI as readonly string[]).includes(kondisi)) {
      throw new GalatApi(
        'Kondisi buku harus "layak" atau "rusak_ringan" saat memvalidasi pengembalian.',
        400,
      );
    }

    const { data, error } = await k.supabase.rpc("verifikasi_kembali", {
      p_peminjaman_id: id,
      p_kondisi_fisik: kondisi,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) });
  });
}
